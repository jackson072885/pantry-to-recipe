from __future__ import annotations

import re

from app.db import SessionLocal
from app.models.ingredient import Ingredient
from app.models.recipe import Recipe, RecipeIngredient, RecipeStep
from app.services.recipe_dataset_service import production_recipe_query


_PLACEHOLDER_PATTERNS = ("pantry snack plate", "placeholder", "todo", "lorem ipsum", "tbd")


def _normalize_title(value: str) -> str:
    lowered = value.strip().lower()
    lowered = re.sub(r"[^a-z0-9\\s]", "", lowered)
    lowered = re.sub(r"\\s+", " ", lowered).strip()
    return lowered


def test_recipe_quality_gate(client) -> None:  # noqa: ARG001 - startup fixture ensures DB + seed
    db = SessionLocal()
    try:
        rows = production_recipe_query(db).order_by(Recipe.id.asc()).all()
        assert len(rows) >= 50

        title_groups: dict[str, list[int]] = {}
        for recipe in rows:
            norm = _normalize_title(recipe.name)
            title_groups.setdefault(norm, []).append(recipe.id)

        duplicate_groups = [ids for ids in title_groups.values() if len(ids) > 1]
        assert len(duplicate_groups) <= 1

        for recipe in rows:
            instructions = (recipe.instructions or "").strip().lower()
            assert instructions != ""
            assert not any(token in instructions for token in _PLACEHOLDER_PATTERNS)
            assert not any(token in recipe.name.lower() for token in _PLACEHOLDER_PATTERNS)
            assert (recipe.short_description or "").strip() != ""
            assert recipe.meal_type != "breakfast"
            assert recipe.quality_bucket in {"KEEP_AS_IS", "KEEP_AND_ENRICH"}
            assert recipe.quality_score is not None
            assert recipe.review_status == "approved"

            required_count = (
                db.query(RecipeIngredient)
                .filter(RecipeIngredient.recipe_id == recipe.id, RecipeIngredient.is_required.is_(True))
                .count()
            )
            assert required_count >= 2

            ingredient_rows = (
                db.query(RecipeIngredient)
                .filter(RecipeIngredient.recipe_id == recipe.id)
                .all()
            )
            assert ingredient_rows
            assert all((row.display_name or "").strip() != "" for row in ingredient_rows)
            assert all((row.pantry_name or "").strip() != "" for row in ingredient_rows)
            assert all(row.measurement_is_estimated in {True, False} for row in ingredient_rows)
            assert all(row.sort_order is not None for row in ingredient_rows)

            step_count = (
                db.query(RecipeStep)
                .filter(RecipeStep.recipe_id == recipe.id)
                .count()
            )
            assert step_count >= 2
    finally:
        db.close()


def test_flagged_recipe_quality_is_kept_out_of_production_flow(client) -> None:  # noqa: ARG001
    db = SessionLocal()
    try:
        flagged = Recipe(
            name="quality-gate-flagged-fixture",
            instructions="Cook the chicken with rice until the pan is hot and the meat is cooked through. Stir in spinach and finish with lemon before serving.",
            short_description="Fixture recipe used to verify flagged rows stay out of production queries.",
            servings=2,
            difficulty="easy",
            meal_type="dinner",
            quality_bucket="KEEP_BUT_FLAG_FOR_REVIEW",
            review_status="needs_editor_review",
            is_production_ready=False,
        )
        db.add(flagged)
        db.flush()

        for idx, ingredient_name in enumerate(("fixture chicken", "fixture rice"), start=1):
            ingredient = Ingredient(canonical_name=ingredient_name)
            db.add(ingredient)
            db.flush()
            db.add(
                RecipeIngredient(
                    recipe_id=flagged.id,
                    ingredient_id=ingredient.id,
                    is_required=True,
                    required_quantity=1.0,
                    unit="ea",
                    display_name=ingredient_name,
                    pantry_name=ingredient_name,
                    sort_order=idx,
                    measurement_is_estimated=False,
                )
            )

        db.add(
            RecipeStep(
                recipe_id=flagged.id,
                step_number=1,
                instruction_text="Cook the chicken with rice over medium heat until the chicken is cooked through.",
            )
        )
        db.add(
            RecipeStep(
                recipe_id=flagged.id,
                step_number=2,
                instruction_text="Fold in spinach, finish with lemon, and serve hot.",
            )
        )
        db.commit()

        production_ids = {row.id for row in production_recipe_query(db).all()}
        assert flagged.id not in production_ids
    finally:
        db.close()
