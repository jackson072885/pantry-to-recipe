from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.ingredient_alias import IngredientAlias
from app.models.recipe import Recipe, RecipeIngredient, RecipeStep
from app.services.recipe_enrichment_service import (
    QUALITY_BUCKETS,
    build_enriched_recipe,
    find_duplicate_pairs,
    ingredient_aliases,
    score_recipe,
)

_ARCHIVE_PREFIX = "[ARCHIVED:"
_KEEP_REASONS = {"KEEP_AS_IS", "KEEP_AND_ENRICH", "KEEP_BUT_FLAG_FOR_REVIEW"}


def audit_recipes(db: Session) -> dict:
    recipes = _active_recipes(db)
    enriched_rows = [_serialize_recipe(recipe) for recipe in recipes]
    bucket_counts: dict[str, int] = {bucket: 0 for bucket in QUALITY_BUCKETS}
    flagged: list[dict] = []

    for row in enriched_rows:
        bucket = row.get("quality_bucket") or "KEEP_BUT_FLAG_FOR_REVIEW"
        if bucket not in bucket_counts:
            bucket_counts[bucket] = 0
        bucket_counts[bucket] += 1

        if bucket not in _KEEP_REASONS:
            flagged.append(
                {
                    "recipe_id": row["id"],
                    "recipe_name": row["name"],
                    "bucket": bucket,
                    "reason": row.get("quality_reason"),
                }
            )

    return {
        "total_active": len(enriched_rows),
        "bucket_counts": bucket_counts,
        "flagged": flagged,
        "duplicates": find_duplicate_pairs(enriched_rows),
    }


def archive_flagged_recipes(db: Session) -> dict:
    report = audit_recipes(db)
    archive_ids = {row["recipe_id"] for row in report["flagged"]}
    archived: list[dict] = []
    for recipe in _active_recipes(db):
        if recipe.id not in archive_ids:
            continue
        original_name = recipe.name
        recipe.name = f"{_ARCHIVE_PREFIX}{recipe.id}] {original_name}"
        archived.append(
            {
                "recipe_id": recipe.id,
                "original_name": original_name,
                "reason": recipe.quality_reason or "quality_gate",
            }
        )
    if archived:
        db.commit()
    return {"archived_count": len(archived), "archived": archived}


def seed_real_recipe_pack(db: Session) -> dict:
    payload = _load_source_payload()
    enriched_source = [
        build_enriched_recipe(row, index)
        for index, row in enumerate(payload, start=1)
        if str(row.get("name", "")).strip()
    ]
    curated_names = {row["name"] for row in enriched_source}

    archived_legacy = _archive_non_curated_active_recipes(db, curated_names)
    created = 0
    updated = 0

    for row in enriched_source:
        recipe = (
            db.query(Recipe)
            .filter(Recipe.name == row["name"], ~Recipe.name.like(f"{_ARCHIVE_PREFIX}%"))
            .first()
        )
        if recipe is None:
            recipe = Recipe(name=row["name"])
            db.add(recipe)
            db.flush()
            created += 1
        else:
            updated += 1

        _apply_recipe_fields(recipe, row)
        _sync_recipe_ingredients(db, recipe, row["ingredients"])
        _sync_recipe_steps(db, recipe, row["steps"])

    db.commit()
    return {
        "created": created,
        "updated": updated,
        "archived_legacy_count": archived_legacy,
        "total_source": len(enriched_source),
    }


def _load_source_payload() -> list[dict]:
    path = _data_path()
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError("recipes_real_v1.json must contain a list")
    return payload


def _active_recipes(db: Session) -> list[Recipe]:
    return (
        db.query(Recipe)
        .filter(~Recipe.name.like(f"{_ARCHIVE_PREFIX}%"), Recipe.is_production_ready.is_(True))
        .order_by(Recipe.id.asc())
        .all()
    )


def _archive_non_curated_active_recipes(db: Session, curated_names: set[str]) -> int:
    archived_count = 0
    for recipe in _active_recipes(db):
        if recipe.name in curated_names:
            continue
        recipe.name = f"{_ARCHIVE_PREFIX}{recipe.id}] {recipe.name}"
        archived_count += 1
    if archived_count:
        db.flush()
    return archived_count


def _apply_recipe_fields(recipe: Recipe, row: dict) -> None:
    recipe.short_description = row.get("short_description")
    recipe.instructions = row.get("instructions")
    recipe.cook_method = row.get("cook_method")
    recipe.prep_time_minutes = row.get("prep_time_minutes")
    recipe.cook_time_minutes = row.get("cook_time_minutes")
    recipe.total_time_minutes = row.get("total_time_minutes")
    recipe.oven_temp_f = row.get("oven_temp_f")
    recipe.air_fryer_temp_f = row.get("air_fryer_temp_f")
    recipe.servings = row.get("servings", 2)
    recipe.difficulty = row.get("difficulty")
    recipe.primary_method = row.get("primary_method")
    recipe.primary_protein = row.get("primary_protein")
    recipe.cuisine = row.get("cuisine")
    recipe.cleanup_score = row.get("cleanup_score")
    recipe.prep_complexity = row.get("prep_complexity")
    recipe.meal_type = row.get("meal_type")
    recipe.equipment_json = row.get("equipment_json")
    recipe.substitutions_json = row.get("substitutions_json")
    recipe.tips_json = row.get("tips_json")
    recipe.warnings_json = row.get("warnings_json")
    recipe.storage_json = row.get("storage_json")
    recipe.tags_json = row.get("tags_json")
    recipe.quality_score = row.get("quality_score")
    recipe.quality_bucket = row.get("quality_bucket")
    recipe.quality_reason = row.get("quality_reason")
    recipe.review_status = row.get("review_status")
    recipe.is_weeknight_friendly = row.get("is_weeknight_friendly")
    recipe.is_beginner_friendly = row.get("is_beginner_friendly")
    recipe.is_production_ready = bool(row.get("is_production_ready", True))


def _upsert_ingredient(db: Session, name: str, aliases: list[str]) -> Ingredient:
    canonical = name.strip().lower()
    ingredient = db.query(Ingredient).filter(Ingredient.canonical_name == canonical).first()
    if not ingredient:
        ingredient = Ingredient(canonical_name=canonical)
        db.add(ingredient)
        db.flush()

    for alias in aliases:
        alias_value = alias.strip().lower()
        if not alias_value or alias_value == canonical:
            continue
        exists = (
            db.query(IngredientAlias)
            .filter(
                IngredientAlias.ingredient_id == ingredient.id,
                IngredientAlias.normalized_alias == alias_value,
            )
            .first()
        )
        if not exists:
            db.add(IngredientAlias(ingredient_id=ingredient.id, alias=alias_value))

    return ingredient


def _sync_recipe_ingredients(db: Session, recipe: Recipe, ingredient_rows: list[dict]) -> None:
    existing = db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe.id).all()
    existing_by_ingredient = {row.ingredient_id: row for row in existing}
    desired_ids: set[int] = set()

    for row in ingredient_rows:
        ingredient = _upsert_ingredient(
            db,
            str(row["canonical_name"]).strip().lower(),
            list(row.get("aliases", [])) + ingredient_aliases(str(row["canonical_name"]).strip().lower()),
        )
        desired_ids.add(ingredient.id)
        link = existing_by_ingredient.get(ingredient.id)
        if link is None:
            link = RecipeIngredient(recipe_id=recipe.id, ingredient_id=ingredient.id)
            db.add(link)
        link.is_required = bool(row.get("is_required", True))
        link.required_quantity = float(row.get("required_quantity") or 1.0)
        link.unit = str(row.get("unit") or "ea")
        link.display_quantity = row.get("display_quantity")
        link.display_unit = row.get("display_unit")
        link.display_name = row.get("display_name")
        link.pantry_name = row.get("pantry_name")
        link.prep_state = row.get("prep_state")
        link.notes = row.get("notes")
        link.sort_order = row.get("sort_order")
        link.measurement_is_estimated = bool(row.get("measurement_is_estimated", True))

    for row in existing:
        if row.ingredient_id not in desired_ids:
            db.delete(row)


def _sync_recipe_steps(db: Session, recipe: Recipe, step_rows: list[dict]) -> None:
    existing = db.query(RecipeStep).filter(RecipeStep.recipe_id == recipe.id).all()
    existing_by_number = {row.step_number: row for row in existing}
    desired_numbers: set[int] = set()

    for payload in step_rows:
        step_number = int(payload["step_number"])
        desired_numbers.add(step_number)
        step = existing_by_number.get(step_number)
        if step is None:
            step = RecipeStep(recipe_id=recipe.id, step_number=step_number)
            db.add(step)
        step.instruction_text = str(payload["instruction_text"]).strip()
        step.timing_minutes = payload.get("timing_minutes")
        step.temperature_f = payload.get("temperature_f")
        step.equipment = payload.get("equipment")
        step.doneness_cue = payload.get("doneness_cue")

    for row in existing:
        if row.step_number not in desired_numbers:
            db.delete(row)


def _serialize_recipe(recipe: Recipe) -> dict:
    equipment = _json_list(recipe.equipment_json)
    substitutions = _json_list(recipe.substitutions_json)
    tips = _json_list(recipe.tips_json)
    warnings = _json_list(recipe.warnings_json)
    storage = _json_list(recipe.storage_json)
    tags = _json_list(recipe.tags_json)
    ingredients = [
        {
            "pantry_name": ingredient.pantry_name or "",
            "is_required": ingredient.is_required,
        }
        for ingredient in sorted(
            recipe.ingredients,
            key=lambda row: (row.sort_order or 0, row.id or 0),
        )
    ]
    steps = [
        {
            "step_number": step.step_number,
            "instruction_text": step.instruction_text,
        }
        for step in recipe.steps
    ]
    row = {
        "id": recipe.id,
        "name": recipe.name,
        "short_description": recipe.short_description,
        "servings": recipe.servings,
        "total_time_minutes": recipe.total_time_minutes,
        "difficulty": recipe.difficulty,
        "meal_type": recipe.meal_type,
        "equipment": equipment,
        "substitutions": substitutions,
        "tips": tips,
        "warnings": warnings,
        "storage": storage,
        "tags": tags,
        "ingredients": ingredients,
        "steps": steps,
        "quality_score": recipe.quality_score,
        "quality_bucket": recipe.quality_bucket,
        "quality_reason": recipe.quality_reason,
        "review_status": recipe.review_status,
        "is_production_ready": recipe.is_production_ready,
    }
    if not row["quality_bucket"]:
        row.update(score_recipe(row))
    return row


def _json_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return [str(item) for item in parsed] if isinstance(parsed, list) else []


def _data_path() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "recipes_real_v1.json"
