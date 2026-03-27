from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy import select

from app.db import init_db, db_session
from app.models import Ingredient, IngredientAlias, Recipe, RecipeIngredient
from app.services.normalize_service import normalize_item

DATA_DIR = Path(__file__).parent / "data"
RECIPES_JSON = DATA_DIR / "recipes_seed_v1.json"


def _ingredient_id_for_name(name: str) -> int | None:
    """Resolve an ingredient name to Ingredient.id using alias and canonical lookup."""
    with db_session() as db:
        n = normalize_item(name, db)
        alias = db.execute(
            select(IngredientAlias).where(IngredientAlias.normalized_alias == n)
        ).scalar_one_or_none()
        if alias:
            return alias.ingredient_id
        ing = db.execute(select(Ingredient).where(Ingredient.canonical_name == n)).scalar_one_or_none()
        if ing:
            return ing.id
    return None


def seed_recipes() -> None:
    init_db()

    if not RECIPES_JSON.exists():
        raise FileNotFoundError(f"Recipes seed file not found: {RECIPES_JSON}")

    recipes = json.loads(RECIPES_JSON.read_text(encoding="utf-8"))

    inserted = 0
    skipped = 0

    for r in recipes:
        rid = r.get("id")
        name = (r.get("name") or "Untitled").strip()
        ingredients = r.get("ingredients") or []

        # Upsert recipe by id or name
        with db_session() as db:
            existing = None
            if rid is not None:
                existing = db.execute(select(Recipe).where(Recipe.id == rid)).scalar_one_or_none()
            if existing is None:
                existing = db.execute(select(Recipe).where(Recipe.name == name)).scalar_one_or_none()

            if existing:
                # don't duplicate in MVP seed
                skipped += 1
                continue

            recipe = Recipe(
                id=int(rid) if rid is not None else None,
                name=name,
                cuisine=r.get("cuisine_region") or r.get("cuisine"),
                cook_time_minutes=r.get("cook_minutes"),
            )
            db.add(recipe)
            db.flush()

            # Add recipe ingredients
            for ing_name in ingredients:
                ing_id = _ingredient_id_for_name(ing_name)
                if ing_id is None:
                    continue
                existing_link = db.execute(
                    select(RecipeIngredient).where(
                        RecipeIngredient.recipe_id == recipe.id,
                        RecipeIngredient.ingredient_id == ing_id,
                    )
                ).scalar_one_or_none()
                if existing_link:
                    continue
                db.add(
                    RecipeIngredient(
                        recipe_id=recipe.id,
                        ingredient_id=ing_id,
                        is_required=True,
                    )
                )

            inserted += 1

    print(f"[seed] Recipes inserted: {inserted}, skipped(existing): {skipped}.")


if __name__ == "__main__":
    seed_recipes()
