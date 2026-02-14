from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import select

from app.cook_service import normalize_item, STAPLES
from app.db import init_db, db_session
from app.models import Ingredient, IngredientAlias, Recipe, RecipeIngredient

DATA_DIR = Path(__file__).parent / "data"
RECIPES_JSON = DATA_DIR / "recipes.json"
CATALOG_JSON = DATA_DIR / "ingredient_catalog_v1.json"


def upsert_ingredient(canonical_name: str, *, is_staple: bool, category: str = "other", measurement_type: str = "each", default_unit: str = "ea") -> Ingredient:
    canonical_name = normalize_item(canonical_name)
    with db_session() as db:
        existing = db.execute(select(Ingredient).where(Ingredient.canonical_name == canonical_name)).scalar_one_or_none()
        if existing:
            if is_staple and not existing.is_staple:
                existing.is_staple = True
            # Fill optional metadata if blank
            if not existing.category:
                existing.category = category
            if not existing.measurement_type:
                existing.measurement_type = measurement_type
            if not existing.default_unit:
                existing.default_unit = default_unit
            db.add(existing)
            return existing

        ing = Ingredient(
            canonical_name=canonical_name,
            is_staple=is_staple,
            category=category,
            measurement_type=measurement_type,
            default_unit=default_unit,
        )
        db.add(ing)
        db.flush()
        return ing


def ensure_alias(ingredient_id: int, alias: str) -> None:
    alias = (alias or "").strip()
    if not alias:
        return
    normalized_alias = normalize_item(alias)
    with db_session() as db:
        exists = db.execute(select(IngredientAlias).where(IngredientAlias.normalized_alias == normalized_alias)).scalar_one_or_none()
        if exists:
            return
        db.add(IngredientAlias(ingredient_id=ingredient_id, alias=alias, normalized_alias=normalized_alias))


def seed_ingredient_catalog() -> None:
    if not CATALOG_JSON.exists():
        print(f"[seed] No ingredient catalog found at {CATALOG_JSON} (skipping)")
        return

    catalog = json.loads(CATALOG_JSON.read_text(encoding="utf-8"))
    created_ings = 0
    created_aliases = 0

    for item in catalog:
        canonical = item.get("canonical_name", "").strip()
        if not canonical:
            continue

        ing = upsert_ingredient(
            canonical,
            is_staple=(normalize_item(canonical) in STAPLES),
            category=item.get("category", "other"),
            measurement_type=item.get("measurement_type", "each"),
            default_unit=item.get("default_unit", "ea"),
        )

        # Canonical itself as alias is optional; we keep it clean.
        for a in item.get("aliases", []) or []:
            before = a
            ensure_alias(ing.id, before)
            created_aliases += 1

        created_ings += 1

    print(f"[seed] Ingredient catalog loaded: {created_ings} entries, {created_aliases} aliases added (dedupe-safe).")


def seed_staples() -> None:
    for s in sorted(STAPLES):
        ing = upsert_ingredient(s, is_staple=True, category="spice" if s in {"salt", "pepper"} else "other")
        ensure_alias(ing.id, s)


def seed_recipes() -> None:
    if not RECIPES_JSON.exists():
        print(f"[seed] No recipes.json found at {RECIPES_JSON} (skipping)")
        return

    recipes = json.loads(RECIPES_JSON.read_text(encoding="utf-8"))

    for r in recipes:
        rid = int(r.get("id")) if r.get("id") is not None else None
        name = (r.get("name") or "").strip() or "Untitled"
        raw_ings = r.get("ingredients", []) or []

        with db_session() as db:
            recipe = None
            if rid is not None:
                recipe = db.execute(select(Recipe).where(Recipe.id == rid)).scalar_one_or_none()

            if recipe is None:
                recipe = Recipe(
                    id=rid if rid is not None else None,
                    name=name,
                    cuisine_region=r.get("cuisine_region"),
                    cuisine_substyle=r.get("cuisine_substyle"),
                    attributes=r.get("attributes") or {},
                    servings_default=r.get("servings_default"),
                    prep_minutes=r.get("prep_minutes"),
                    cook_minutes=r.get("cook_minutes"),
                    instructions=r.get("instructions"),
                )
                db.add(recipe)
                db.flush()
            else:
                recipe.name = name
                db.add(recipe)
                db.flush()

            # Clear existing recipe ingredients for idempotency
            existing_ris = db.execute(select(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe.id)).scalars().all()
            for eri in existing_ris:
                db.delete(eri)
            db.flush()

        # Add ingredients
        for raw in raw_ings:
            canon = normalize_item(raw)
            if not canon:
                continue

            ing = upsert_ingredient(
                canon,
                is_staple=(canon in STAPLES),
            )
            ensure_alias(ing.id, raw)

            with db_session() as db:
                db.add(
                    RecipeIngredient(
                        recipe_id=recipe.id,
                        ingredient_id=ing.id,
                        required=True,
                        importance=1.0,
                    )
                )


def seed() -> None:
    init_db()

    # 1) Ingredient catalog first (if present)
    seed_ingredient_catalog()

    # 2) Staples always
    seed_staples()

    # 3) Recipes
    seed_recipes()

    # Summary
    with db_session() as db:
        ing_count = db.execute(select(Ingredient)).scalars().all()
        recipe_count = db.execute(select(Recipe)).scalars().all()
        print("✅ Seed complete.")
        print(f"   Ingredients: {len(ing_count)}")
        print(f"   Recipes:      {len(recipe_count)}")
        print("   DB: onhand.db (SQLite) unless DATABASE_URL overrides it.")


if __name__ == "__main__":
    seed()
