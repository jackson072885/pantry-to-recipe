from __future__ import annotations

import json

from app.db import SessionLocal
from app.models.ingredient import Ingredient
from app.models.recipe import Recipe, RecipeIngredient
from app.models.user_action import UserAction
from app.services.recommendation_service import _group_for_recipe, recommend_recipes


def _ensure_ingredient(db, canonical_name: str) -> Ingredient:
    ingredient = db.query(Ingredient).filter(Ingredient.canonical_name == canonical_name).first()
    if ingredient is not None:
        return ingredient

    ingredient = Ingredient(canonical_name=canonical_name)
    db.add(ingredient)
    db.flush()
    return ingredient


def _create_recipe(
    db,
    *,
    recipe_name: str,
    ingredient_names: list[str],
    total_time_minutes: int = 20,
) -> Recipe:
    recipe = Recipe(
        name=recipe_name,
        total_time_minutes=total_time_minutes,
        difficulty="easy",
        prep_complexity="simple",
        quality_score=24,
        quality_bucket="KEEP_AS_IS",
        review_status="approved",
        is_weeknight_friendly=True,
        is_beginner_friendly=True,
        is_production_ready=True,
    )
    db.add(recipe)
    db.flush()

    for ingredient_name in ingredient_names:
        ingredient = _ensure_ingredient(db, ingredient_name)
        db.add(
            RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=ingredient.id,
                is_required=True,
                required_quantity=1.0,
                unit="ea",
                measurement_is_estimated=False,
            )
        )

    db.commit()
    db.refresh(recipe)
    return recipe


def _record_action(db, *, recipe_id: int, event: str) -> None:
    db.add(
        UserAction(
            event=event,
            recipe_id=recipe_id,
            metadata_json=json.dumps({"source": "test"}, sort_keys=True),
        )
    )
    db.commit()


def test_zero_coverage_single_missing_recipe_is_not_almost_there():
    assert _group_for_recipe(0, 1, 0) == "not_worth_it"


def test_single_missing_recipe_with_real_coverage_stays_almost_there():
    assert _group_for_recipe(67, 1, 2) == "almost_there"


def test_recommendations_keep_deterministic_fallback_without_behavior_history(client):
    with SessionLocal() as db:
        pantry_items = [
            "ranking_no_signal_a",
            "ranking_no_signal_b",
            "ranking_no_signal_c",
        ]
        recipe_a = _create_recipe(
            db,
            recipe_name="A No Signal Skillet",
            ingredient_names=[pantry_items[0], pantry_items[1]],
        )
        recipe_a_id = recipe_a.id
        _create_recipe(
            db,
            recipe_name="B No Signal Skillet",
            ingredient_names=[pantry_items[0], pantry_items[2]],
        )

        result = recommend_recipes(db, pantry_items)

    assert result["best_tonight"] is not None
    assert result["best_tonight"]["recipe"]["recipe_id"] == recipe_a_id
    assert result["best_tonight"]["behavior"]["has_signal"] is False
    assert result["best_tonight"]["score_breakdown"]["behavior_applied"] is False


def test_recommendations_use_persisted_history_to_break_ties_between_equal_fits(client):
    with SessionLocal() as db:
        pantry_items = [
            "ranking_behavior_a",
            "ranking_behavior_b",
            "ranking_behavior_c",
        ]
        recipe_a = _create_recipe(
            db,
            recipe_name="A Behavior Bowl",
            ingredient_names=[pantry_items[0], pantry_items[1]],
        )
        recipe_b = _create_recipe(
            db,
            recipe_name="B Behavior Bowl",
            ingredient_names=[pantry_items[0], pantry_items[2]],
        )
        recipe_a_id = recipe_a.id
        recipe_b_id = recipe_b.id

        _record_action(db, recipe_id=recipe_b_id, event="recipe_selected")
        _record_action(db, recipe_id=recipe_b_id, event="cook_clicked")

        result = recommend_recipes(db, pantry_items)

    assert result["best_tonight"] is not None
    assert result["best_tonight"]["recipe"]["recipe_id"] == recipe_b_id
    assert result["best_tonight"]["behavior"]["has_signal"] is True
    assert result["best_tonight"]["behavior"]["points"] > 0
    assert result["best_tonight"]["score_breakdown"]["behavior_applied"] is True
    assert "small ranking boost" in result["best_tonight"]["explanation"]
    assert any(
        alternative["recipe"]["recipe_id"] == recipe_a_id for alternative in result["alternatives"]
    )


def test_behavior_history_cannot_overrule_a_clearly_better_pantry_fit(client):
    with SessionLocal() as db:
        pantry_items = [
            "ranking_strong_fit_a",
            "ranking_strong_fit_b",
        ]
        strong_fit = _create_recipe(
            db,
            recipe_name="A Strong Pantry Fit",
            ingredient_names=pantry_items,
        )
        weak_fit = _create_recipe(
            db,
            recipe_name="B Weak Pantry Fit",
            ingredient_names=[
                pantry_items[0],
                "ranking_strong_fit_missing_1",
                "ranking_strong_fit_missing_2",
            ],
            total_time_minutes=15,
        )
        strong_fit_id = strong_fit.id
        weak_fit_id = weak_fit.id

        for _ in range(6):
            _record_action(db, recipe_id=weak_fit_id, event="recipe_cooked_confirmed")

        result = recommend_recipes(db, pantry_items)

    assert result["best_tonight"] is not None
    assert result["best_tonight"]["recipe"]["recipe_id"] == strong_fit_id
    weak_entry = next(
        entry for entry in result["almost_there"] + result["not_worth_it"]
        if entry["recipe"]["recipe_id"] == weak_fit_id
    )
    assert weak_entry["behavior"]["has_signal"] is True
    assert weak_entry["behavior"]["points"] <= 6.0
