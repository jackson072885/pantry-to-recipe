from __future__ import annotations

import json
import re
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.ingredient_alias import IngredientAlias
from app.models.recipe import Recipe, RecipeIngredient

_PLACEHOLDER_NAME_PATTERNS = (
    "pantry snack plate",
    "placeholder",
    "todo",
    "test recipe",
)

_PLACEHOLDER_TEXT_PATTERNS = (
    "placeholder",
    "lorem ipsum",
    "todo",
    "tbd",
)

_ARCHIVE_PREFIX = "[ARCHIVED:"


def _normalize_title(value: str) -> str:
    lowered = value.strip().lower()
    lowered = re.sub(r"[^a-z0-9\s]", "", lowered)
    lowered = re.sub(r"\s+", " ", lowered).strip()
    return lowered


def _is_placeholder_recipe(name: str, instructions: str | None) -> bool:
    lowered_name = name.strip().lower()
    if any(pattern in lowered_name for pattern in _PLACEHOLDER_NAME_PATTERNS):
        return True

    content = (instructions or "").strip().lower()
    if not content:
        return True
    if any(pattern in content for pattern in _PLACEHOLDER_TEXT_PATTERNS):
        return True
    return False


def _required_ingredient_count(db: Session, recipe_id: int) -> int:
    return (
        db.query(RecipeIngredient)
        .filter(RecipeIngredient.recipe_id == recipe_id, RecipeIngredient.is_required.is_(True))
        .count()
    )


def audit_recipes(db: Session) -> dict:
    recipes = (
        db.query(Recipe)
        .filter(~Recipe.name.like(f"{_ARCHIVE_PREFIX}%"))
        .order_by(Recipe.id.asc())
        .all()
    )
    by_norm: dict[str, list[Recipe]] = {}
    missing_instructions: list[int] = []
    suspicious: list[int] = []

    for recipe in recipes:
        norm = _normalize_title(recipe.name)
        by_norm.setdefault(norm, []).append(recipe)

        if not (recipe.instructions or "").strip():
            missing_instructions.append(recipe.id)

        required_count = _required_ingredient_count(db, recipe.id)
        if _is_placeholder_recipe(recipe.name, recipe.instructions) or required_count < 2:
            suspicious.append(recipe.id)

    duplicates = {
        key: [r.id for r in value]
        for key, value in by_norm.items()
        if key and len(value) > 1
    }

    return {
        "total_active": len(recipes),
        "duplicate_groups": duplicates,
        "missing_instructions": sorted(set(missing_instructions)),
        "suspicious_recipe_ids": sorted(set(suspicious)),
    }


def archive_flagged_recipes(db: Session) -> dict:
    report = audit_recipes(db)
    duplicate_ids: set[int] = set()
    for ids in report["duplicate_groups"].values():
        duplicate_ids.update(ids[1:])

    flagged = set(report["missing_instructions"]) | set(report["suspicious_recipe_ids"]) | duplicate_ids
    archived_count = 0
    for recipe_id in sorted(flagged):
        recipe = db.get(Recipe, recipe_id)
        if not recipe:
            continue
        if recipe.name.startswith(_ARCHIVE_PREFIX):
            continue
        recipe.name = f"{_ARCHIVE_PREFIX}{recipe.id}] {recipe.name}"
        archived_count += 1

    if archived_count:
        db.commit()

    return {"archived_count": archived_count, "flagged_count": len(flagged)}


def _upsert_ingredient(db: Session, name: str, aliases: list[str] | None = None) -> Ingredient:
    canonical = name.strip().lower()
    ingredient = db.query(Ingredient).filter(Ingredient.canonical_name == canonical).first()
    if not ingredient:
        ingredient = Ingredient(canonical_name=canonical)
        db.add(ingredient)
        db.flush()

    for alias in aliases or []:
        alias_value = alias.strip().lower()
        if not alias_value:
            continue
        exists = (
            db.query(IngredientAlias)
            .filter(
                IngredientAlias.ingredient_id == ingredient.id,
                IngredientAlias.alias == alias_value,
            )
            .first()
        )
        if not exists:
            db.add(IngredientAlias(ingredient_id=ingredient.id, alias=alias_value))

    return ingredient


def _sync_recipe_ingredients(
    db: Session,
    recipe: Recipe,
    required: list[str],
    optional: list[str],
) -> None:
    desired: dict[int, bool] = {}
    for item in required:
        ingredient = _upsert_ingredient(db, item)
        desired[ingredient.id] = True
    for item in optional:
        ingredient = _upsert_ingredient(db, item)
        desired.setdefault(ingredient.id, False)

    existing = db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe.id).all()
    existing_by_ingredient = {row.ingredient_id: row for row in existing}

    for ingredient_id, is_required in desired.items():
        row = existing_by_ingredient.get(ingredient_id)
        if row:
            row.is_required = is_required
            if not row.required_quantity or row.required_quantity <= 0:
                row.required_quantity = 1.0
            if not row.unit:
                row.unit = "ea"
        else:
            db.add(
                RecipeIngredient(
                    recipe_id=recipe.id,
                    ingredient_id=ingredient_id,
                    is_required=is_required,
                    required_quantity=1.0,
                    unit="ea",
                )
            )

    for row in existing:
        if row.ingredient_id not in desired:
            db.delete(row)


def _data_path() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "recipes_real_v1.json"


def seed_real_recipe_pack(db: Session) -> dict:
    path = _data_path()
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError("recipes_real_v1.json must contain a list")

    created = 0
    updated = 0
    for row in payload:
        name = str(row.get("name", "")).strip()
        if not name:
            continue
        required = [str(item).strip().lower() for item in row.get("required", []) if str(item).strip()]
        optional = [str(item).strip().lower() for item in row.get("optional", []) if str(item).strip()]
        instructions = str(row.get("instructions", "")).strip()
        if len(required) < 2 or not instructions:
            continue

        recipe = (
            db.query(Recipe)
            .filter(Recipe.name == name, ~Recipe.name.like(f"{_ARCHIVE_PREFIX}%"))
            .first()
        )
        if recipe is None:
            recipe = Recipe(name=name)
            db.add(recipe)
            db.flush()
            created += 1
        else:
            updated += 1

        recipe.instructions = instructions
        recipe.cook_method = row.get("cook_method")
        recipe.prep_time_minutes = row.get("prep_time_minutes")
        recipe.cook_time_minutes = row.get("cook_time_minutes")
        recipe.total_time_minutes = row.get("total_time_minutes")
        recipe.servings = row.get("servings", 2)

        _sync_recipe_ingredients(db, recipe, required, optional)

    db.commit()
    return {"created": created, "updated": updated, "total_source": len(payload)}
