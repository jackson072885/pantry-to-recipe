from __future__ import annotations

import json

from app.db import SessionLocal
from app.models.ingredient import Ingredient
from app.models.pantry_item import PantryItem
from app.models.recipe import Recipe, RecipeIngredient
from app.models.user_action import UserAction
from app.services.recommendation_service import (
    RecommendationMode,
    _group_for_recipe,
    recommend_recipes,
)


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
    difficulty: str = "easy",
    prep_complexity: str = "simple",
    quality_score: int = 24,
    is_weeknight_friendly: bool = True,
    is_beginner_friendly: bool = True,
) -> Recipe:
    recipe = Recipe(
        name=recipe_name,
        total_time_minutes=total_time_minutes,
        difficulty=difficulty,
        prep_complexity=prep_complexity,
        quality_score=quality_score,
        quality_bucket="KEEP_AS_IS",
        review_status="approved",
        is_weeknight_friendly=is_weeknight_friendly,
        is_beginner_friendly=is_beginner_friendly,
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


def _create_recipe_with_rows(
    db,
    *,
    recipe_name: str,
    ingredient_rows: list[dict],
    total_time_minutes: int = 20,
    difficulty: str = "easy",
    prep_complexity: str = "simple",
    quality_score: int = 24,
    is_weeknight_friendly: bool = True,
    is_beginner_friendly: bool = True,
) -> Recipe:
    recipe = Recipe(
        name=recipe_name,
        total_time_minutes=total_time_minutes,
        difficulty=difficulty,
        prep_complexity=prep_complexity,
        quality_score=quality_score,
        quality_bucket="KEEP_AS_IS",
        review_status="approved",
        is_weeknight_friendly=is_weeknight_friendly,
        is_beginner_friendly=is_beginner_friendly,
        is_production_ready=True,
    )
    db.add(recipe)
    db.flush()

    for index, row in enumerate(ingredient_rows, start=1):
        ingredient = _ensure_ingredient(db, row["ingredient_name"])
        db.add(
            RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=ingredient.id,
                is_required=row.get("is_required", True),
                required_quantity=row.get("required_quantity", 1.0),
                unit=row.get("unit", "ea"),
                measurement_is_estimated=row.get("measurement_is_estimated", False),
                notes=row.get("notes"),
                display_name=row.get("display_name"),
                sort_order=row.get("sort_order", index),
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


def _save_pantry_item(
    db,
    *,
    canonical_name: str,
    quantity: float = 1.0,
    unit: str = "ea",
    use_soon: bool = False,
) -> None:
    ingredient = _ensure_ingredient(db, canonical_name)
    pantry_item = db.query(PantryItem).filter(PantryItem.ingredient_id == ingredient.id).first()
    if pantry_item is None:
        pantry_item = PantryItem(
            ingredient_id=ingredient.id,
            quantity=quantity,
            unit=unit,
            use_soon=use_soon,
        )
        db.add(pantry_item)
    else:
        pantry_item.quantity = quantity
        pantry_item.unit = unit
        pantry_item.use_soon = use_soon
    db.commit()


def _save_pantry_items(db, canonical_names: list[str]) -> None:
    for canonical_name in canonical_names:
        _save_pantry_item(db, canonical_name=canonical_name)


def test_zero_coverage_single_missing_recipe_is_not_almost_there():
    assert _group_for_recipe(0, 1, 0) == "not_worth_it"


def test_single_missing_recipe_with_real_coverage_stays_almost_there():
    assert _group_for_recipe(67, 1, 2) == "almost_there"


def test_recommendations_do_not_invent_missing_saved_pantry_rows_as_ready_counts(client):
    with SessionLocal() as db:
        recipe = _create_recipe(
            db,
            recipe_name="Fallback Count Trap",
            ingredient_names=["fallback_count_item"],
        )

        result = recommend_recipes(db, ["fallback_count_item"])

    all_rows = result["cook_now"] + result["almost_there"] + result["not_worth_it"]
    matching = next(row for row in all_rows if row["recipe"]["recipe_id"] == recipe.id)

    assert matching["recipe"]["missing_count"] == 1
    assert matching["recipe"]["missing_ingredients"] == ["fallback_count_item"]
    assert matching["recommendation_type"] != "cook_now"
    assert matching["cta"]["pantry_ready"] is False


def test_recommendations_keep_missing_staples_honest_with_cook_readiness(client):
    with SessionLocal() as db:
        recipe = _create_recipe(
            db,
            recipe_name="Chicken Needs Salt",
            ingredient_names=["phase1_chicken", "salt"],
        )
        recipe_id = recipe.id
        _save_pantry_item(db, canonical_name="phase1_chicken")

        result = recommend_recipes(db, ["phase1_chicken"])

    all_rows = result["cook_now"] + result["almost_there"] + result["not_worth_it"]
    matching = next(row for row in all_rows if row["recipe"]["recipe_id"] == recipe_id)

    assert matching["recipe"]["missing_count"] == 1
    assert matching["recipe"]["missing_ingredients"] == ["salt"]
    assert matching["recommendation_type"] == "almost_there"
    assert matching["cta"]["pantry_ready"] is False


def test_minor_garnish_missing_stays_top_closest_option_without_claiming_strong_match(client):
    with SessionLocal() as db:
        pantry_items = ["phase2_salmon", "rice", "broccoli", "butter", "garlic"]
        practical_winner = _create_recipe_with_rows(
            db,
            recipe_name="A Practical Salmon Plate",
            ingredient_rows=[
                {"ingredient_name": "phase2_salmon"},
                {"ingredient_name": "rice"},
                {"ingredient_name": "broccoli"},
                {"ingredient_name": "butter"},
                {"ingredient_name": "garlic"},
                {"ingredient_name": "parsley", "notes": "for serving garnish"},
            ],
            total_time_minutes=25,
            quality_score=22,
        )
        weaker_shorter = _create_recipe(
            db,
            recipe_name="B Weaker Salmon Plate",
            ingredient_names=["phase2_salmon", "rice", "lemon"],
            total_time_minutes=25,
            quality_score=22,
        )
        practical_winner_id = practical_winner.id
        _save_pantry_items(db, pantry_items)

        result = recommend_recipes(db, pantry_items)

    assert result["recommendation_status"] == "no_strong_match"
    assert result["best_tonight"] is None
    assert result["closest_options"][0]["recipe"]["recipe_id"] == practical_winner_id
    assert result["closest_options"][0]["missing"]["ingredients"] == ["parsley"]


def test_missing_core_ingredient_still_penalizes_meaningfully(client):
    with SessionLocal() as db:
        pantry_items = ["tortilla", "lettuce", "salsa"]
        core_missing = _create_recipe_with_rows(
            db,
            recipe_name="A Chicken Taco Plate",
            ingredient_rows=[
                {"ingredient_name": "phase2_core_chicken"},
                {"ingredient_name": "tortilla"},
                {"ingredient_name": "lettuce"},
                {"ingredient_name": "salsa", "notes": "for serving"},
            ],
            total_time_minutes=20,
            quality_score=24,
        )
        complete_option = _create_recipe(
            db,
            recipe_name="B Bean Taco Plate",
            ingredient_names=["tortilla", "lettuce"],
            total_time_minutes=20,
            quality_score=18,
        )
        core_missing_id = core_missing.id
        complete_option_id = complete_option.id
        _save_pantry_items(db, pantry_items)

        result = recommend_recipes(db, pantry_items)

    assert result["best_tonight"] is not None
    assert result["best_tonight"]["recipe"]["recipe_id"] == complete_option_id
    all_rows = result["cook_now"] + result["almost_there"] + result["not_worth_it"]
    core_missing_entry = next(row for row in all_rows if row["recipe"]["recipe_id"] == core_missing_id)
    assert "phase2_core_chicken" in core_missing_entry["missing"]["ingredients"]
    assert core_missing_entry["recommendation_type"] != "cook_now"


def test_longer_practical_recipe_is_not_overpenalized_for_minor_finishers(client):
    with SessionLocal() as db:
        pantry_items = ["pasta", "chicken", "spinach", "cream", "garlic", "parmesan"]
        long_practical = _create_recipe_with_rows(
            db,
            recipe_name="A Creamy Chicken Pasta",
            ingredient_rows=[
                {"ingredient_name": "pasta"},
                {"ingredient_name": "chicken"},
                {"ingredient_name": "spinach"},
                {"ingredient_name": "cream"},
                {"ingredient_name": "garlic"},
                {"ingredient_name": "parmesan"},
                {"ingredient_name": "lemon", "notes": "optional finish"},
                {"ingredient_name": "parsley", "notes": "for serving garnish"},
            ],
            total_time_minutes=30,
            quality_score=24,
        )
        weaker_short = _create_recipe_with_rows(
            db,
            recipe_name="B Simpler But Missing Protein",
            ingredient_rows=[
                {"ingredient_name": "pasta"},
                {"ingredient_name": "phase2_missing_sausage"},
                {"ingredient_name": "garlic"},
            ],
            total_time_minutes=18,
            quality_score=24,
        )
        long_practical_id = long_practical.id
        weaker_short_id = weaker_short.id
        _save_pantry_items(db, pantry_items)

        result = recommend_recipes(db, pantry_items)

    ranked_ids = [row["recipe"]["recipe_id"] for row in [result["best_tonight"], *result["alternatives"]] if row]
    assert long_practical_id in ranked_ids
    assert weaker_short_id in ranked_ids
    assert ranked_ids.index(long_practical_id) < ranked_ids.index(weaker_short_id)


def test_explanations_distinguish_core_blockers_from_minor_missing_friction(client):
    with SessionLocal() as db:
        pantry_items = ["phase2_shrimp", "rice", "garlic", "butter"]
        recipe = _create_recipe_with_rows(
            db,
            recipe_name="A Shrimp Rice Bowl",
            ingredient_rows=[
                {"ingredient_name": "phase2_shrimp"},
                {"ingredient_name": "rice"},
                {"ingredient_name": "garlic"},
                {"ingredient_name": "butter"},
                {"ingredient_name": "lemon", "notes": "for serving"},
                {"ingredient_name": "parsley", "notes": "garnish"},
            ],
            total_time_minutes=20,
        )
        recipe_id = recipe.id
        _save_pantry_items(db, pantry_items)

        result = recommend_recipes(db, pantry_items)

    all_rows = result["cook_now"] + result["almost_there"] + result["not_worth_it"]
    entry = next(row for row in all_rows if row["recipe"]["recipe_id"] == recipe_id)

    assert entry["missing"]["ingredients"] == ["lemon", "parsley"]
    assert entry["missing"]["summary"] == "Missing 2 ingredients: lemon, parsley."
    assert "minor" in entry["explanation"].lower()


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
        _save_pantry_items(db, pantry_items)

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
        _save_pantry_items(db, pantry_items)

        result = recommend_recipes(db, pantry_items)

    assert result["best_tonight"] is not None
    assert result["best_tonight"]["recipe"]["recipe_id"] == recipe_b_id
    assert result["best_tonight"]["behavior"]["has_signal"] is True
    assert result["best_tonight"]["behavior"]["points"] > 0
    assert result["best_tonight"]["behavior"]["signal_scope"] == "global_activity"
    assert result["best_tonight"]["score_breakdown"]["behavior_applied"] is True
    assert result["best_tonight"]["score_breakdown"]["behavior_points"] <= 0.35
    assert "recent app-wide activity" in result["best_tonight"]["explanation"].lower()
    assert any(
        alternative["recipe"]["recipe_id"] == recipe_a_id for alternative in result["alternatives"]
    )


def test_weak_fallback_history_does_not_keep_not_worth_it_recipe_near_top(client):
    with SessionLocal() as db:
        pantry_items = ["fallback_guard_anchor"]
        pantry_led_recipe = _create_recipe(
            db,
            recipe_name="A Pantry-Led Fallback",
            ingredient_names=[
                "fallback_guard_anchor",
                "fallback_guard_missing_1",
                "fallback_guard_missing_2",
                "fallback_guard_missing_3",
            ],
            total_time_minutes=25,
        )
        sticky_recipe = _create_recipe(
            db,
            recipe_name="B Sticky Bass Fallback",
            ingredient_names=[
                "fallback_guard_anchor",
                "fallback_guard_missing_4",
                "fallback_guard_missing_5",
                "fallback_guard_missing_6",
            ],
            total_time_minutes=25,
        )
        pantry_led_recipe_id = pantry_led_recipe.id
        sticky_recipe_id = sticky_recipe.id

        for _ in range(4):
            _record_action(db, recipe_id=sticky_recipe_id, event="recipe_liked")
        _save_pantry_items(db, pantry_items)

        first_result = recommend_recipes(db, pantry_items)
        second_result = recommend_recipes(db, pantry_items)

    assert first_result["recommendation_status"] == "no_strong_match"
    assert first_result["best_tonight"] is None

    first_ids = [entry["recipe"]["recipe_id"] for entry in first_result["closest_options"][:2]]
    second_ids = [entry["recipe"]["recipe_id"] for entry in second_result["closest_options"][:2]]
    assert first_ids == [pantry_led_recipe_id, sticky_recipe_id]
    assert second_ids == first_ids

    sticky_entry = next(
        entry for entry in first_result["closest_options"]
        if entry["recipe"]["recipe_id"] == sticky_recipe_id
    )
    assert sticky_entry["behavior"]["has_signal"] is True
    assert sticky_entry["score_breakdown"]["behavior_applied"] is False
    assert sticky_entry["score_breakdown"]["behavior_points"] == 0.0
    assert "recent app-wide activity" not in sticky_entry["explanation"].lower()


def test_behavior_history_still_breaks_close_ties_between_near_ready_fallbacks(client):
    with SessionLocal() as db:
        pantry_items = [
            "fallback_tiebreak_a_chicken",
            "fallback_tiebreak_a_rice",
            "fallback_tiebreak_a_garlic",
            "fallback_tiebreak_a_butter",
            "fallback_tiebreak_a_pepper",
            "fallback_tiebreak_b_chicken",
            "fallback_tiebreak_b_rice",
            "fallback_tiebreak_b_garlic",
            "fallback_tiebreak_b_butter",
            "fallback_tiebreak_b_pepper",
        ]
        baseline_recipe = _create_recipe_with_rows(
            db,
            recipe_name="A Near-Ready Fallback",
            ingredient_rows=[
                {"ingredient_name": "fallback_tiebreak_a_chicken"},
                {"ingredient_name": "fallback_tiebreak_a_rice"},
                {"ingredient_name": "fallback_tiebreak_a_garlic"},
                {"ingredient_name": "fallback_tiebreak_a_butter"},
                {"ingredient_name": "fallback_tiebreak_a_pepper"},
                {"ingredient_name": "fallback_tiebreak_parsley", "notes": "for serving garnish"},
            ],
            total_time_minutes=40,
        )
        preferred_recipe = _create_recipe_with_rows(
            db,
            recipe_name="B Near-Ready Fallback",
            ingredient_rows=[
                {"ingredient_name": "fallback_tiebreak_b_chicken"},
                {"ingredient_name": "fallback_tiebreak_b_rice"},
                {"ingredient_name": "fallback_tiebreak_b_garlic"},
                {"ingredient_name": "fallback_tiebreak_b_butter"},
                {"ingredient_name": "fallback_tiebreak_b_pepper"},
                {"ingredient_name": "fallback_tiebreak_lemon", "notes": "for serving garnish"},
            ],
            total_time_minutes=40,
        )
        baseline_recipe_id = baseline_recipe.id
        preferred_recipe_id = preferred_recipe.id

        _record_action(db, recipe_id=preferred_recipe_id, event="recipe_selected")
        _record_action(db, recipe_id=preferred_recipe_id, event="cook_clicked")
        _save_pantry_items(db, pantry_items)

        result = recommend_recipes(db, pantry_items)

    assert result["recommendation_status"] == "no_strong_match"
    assert result["best_tonight"] is None
    assert result["closest_options"][0]["recipe"]["recipe_id"] == preferred_recipe_id
    assert any(
        entry["recipe"]["recipe_id"] == baseline_recipe_id for entry in result["closest_options"]
    )

    preferred_entry = result["closest_options"][0]
    assert preferred_entry["behavior"]["has_signal"] is True
    assert preferred_entry["score_breakdown"]["behavior_applied"] is True
    assert 0.0 < preferred_entry["score_breakdown"]["behavior_points"] <= 0.15
    assert "recent app-wide activity" in preferred_entry["explanation"].lower()


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
        _save_pantry_items(db, pantry_items)

        result = recommend_recipes(db, pantry_items)

    assert result["best_tonight"] is not None
    assert result["best_tonight"]["recipe"]["recipe_id"] == strong_fit_id
    weak_entry = next(
        entry for entry in result["almost_there"] + result["not_worth_it"]
        if entry["recipe"]["recipe_id"] == weak_fit_id
    )
    assert weak_entry["behavior"]["has_signal"] is True
    assert weak_entry["score_breakdown"]["behavior_applied"] is False
    assert weak_entry["score_breakdown"]["behavior_points"] == 0.0


def test_explicit_positive_preference_can_break_a_close_tie(client):
    with SessionLocal() as db:
        pantry_items = [
            "preference_positive_a",
            "preference_positive_b",
            "preference_positive_c",
        ]
        baseline_recipe = _create_recipe(
            db,
            recipe_name="A Baseline Dinner",
            ingredient_names=[pantry_items[0], pantry_items[1]],
        )
        preferred_recipe = _create_recipe(
            db,
            recipe_name="B Preferred Dinner",
            ingredient_names=[pantry_items[0], pantry_items[2]],
        )
        baseline_recipe_id = baseline_recipe.id
        preferred_recipe_id = preferred_recipe.id

        _record_action(db, recipe_id=preferred_recipe_id, event="recipe_liked")
        _save_pantry_items(db, pantry_items)

        result = recommend_recipes(db, pantry_items)

    assert result["best_tonight"] is not None
    assert result["best_tonight"]["recipe"]["recipe_id"] == preferred_recipe_id
    assert result["best_tonight"]["behavior"]["positive_preference"] is True
    assert result["best_tonight"]["behavior"]["negative_preference"] is False
    assert "recent app-wide activity" in result["best_tonight"]["explanation"].lower()
    assert any(
        alternative["recipe"]["recipe_id"] == baseline_recipe_id for alternative in result["alternatives"]
    )


def test_explicit_negative_preference_can_push_recipe_behind_equivalent_option(client):
    with SessionLocal() as db:
        pantry_items = [
            "preference_negative_a",
            "preference_negative_b",
            "preference_negative_c",
        ]
        skipped_recipe = _create_recipe(
            db,
            recipe_name="A Skip For Tonight",
            ingredient_names=[pantry_items[0], pantry_items[1]],
        )
        neutral_recipe = _create_recipe(
            db,
            recipe_name="B Neutral Tonight",
            ingredient_names=[pantry_items[0], pantry_items[2]],
        )
        skipped_recipe_id = skipped_recipe.id
        neutral_recipe_id = neutral_recipe.id

        _record_action(db, recipe_id=skipped_recipe_id, event="recipe_skipped")
        _save_pantry_items(db, pantry_items)

        result = recommend_recipes(db, pantry_items)

    assert result["best_tonight"] is not None
    assert result["best_tonight"]["recipe"]["recipe_id"] == neutral_recipe_id
    skipped_entry = next(
        entry
        for entry in result["cook_now"] + result["almost_there"] + result["not_worth_it"]
        if entry["recipe"]["recipe_id"] == skipped_recipe_id
    )
    assert skipped_entry["behavior"]["negative_preference"] is True
    assert skipped_entry["behavior"]["positive_preference"] is False
    assert skipped_entry["behavior"]["points"] < 0
    assert "recent app-wide activity" in skipped_entry["explanation"].lower()


def test_repeated_recent_winner_gets_fatigue_penalty_when_equal_alternative_exists(client):
    with SessionLocal() as db:
        pantry_items = [
            "hero_fatigue_a",
            "hero_fatigue_b",
            "hero_fatigue_c",
        ]
        repeated_hero = _create_recipe(
            db,
            recipe_name="A Repeated Hero",
            ingredient_names=[pantry_items[0], pantry_items[1]],
        )
        fresher_option = _create_recipe(
            db,
            recipe_name="B Fresher Hero",
            ingredient_names=[pantry_items[0], pantry_items[2]],
        )
        repeated_hero_id = repeated_hero.id
        fresher_option_id = fresher_option.id

        for _ in range(5):
            _record_action(db, recipe_id=repeated_hero_id, event="recipe_selected")
        _save_pantry_items(db, pantry_items)

        result = recommend_recipes(db, pantry_items)

    assert result["best_tonight"] is not None
    assert result["best_tonight"]["recipe"]["recipe_id"] == fresher_option_id
    repeated_entry = next(
        entry for entry in result["cook_now"]
        if entry["recipe"]["recipe_id"] == repeated_hero_id
    )
    assert repeated_entry["behavior"]["has_signal"] is True
    assert repeated_entry["score_breakdown"]["behavior_applied"] is True
    assert repeated_entry["score_breakdown"]["hero_fatigue_applied"] is True
    assert repeated_entry["score_breakdown"]["hero_fatigue_points"] >= 0.45


def test_lowest_effort_mode_can_flip_close_full_pantry_ranking_toward_easier_prep(client):
    with SessionLocal() as db:
        pantry_items = [
            "effort_mode_a",
            "effort_mode_b",
        ]
        fast_complex = _create_recipe(
            db,
            recipe_name="A Faster But Complex",
            ingredient_names=pantry_items,
            total_time_minutes=18,
            difficulty="hard",
            prep_complexity="complex",
            quality_score=28,
            is_weeknight_friendly=False,
            is_beginner_friendly=False,
        )
        easier_recipe = _create_recipe(
            db,
            recipe_name="B Slightly Slower Easy",
            ingredient_names=pantry_items,
            total_time_minutes=22,
            difficulty="easy",
            prep_complexity="simple",
            quality_score=18,
        )

        fast_complex_id = fast_complex.id
        easier_recipe_id = easier_recipe.id
        _save_pantry_items(db, pantry_items)
        balanced = recommend_recipes(db, pantry_items, RecommendationMode.BALANCED)
        lowest_effort = recommend_recipes(db, pantry_items, RecommendationMode.LOWEST_EFFORT)

    assert balanced["best_tonight"] is not None
    assert balanced["best_tonight"]["recipe"]["recipe_id"] == fast_complex_id
    assert lowest_effort["best_tonight"] is not None
    assert lowest_effort["best_tonight"]["recipe"]["recipe_id"] == easier_recipe_id
    assert lowest_effort["decision_mode"]["key"] == RecommendationMode.LOWEST_EFFORT.value
    assert lowest_effort["best_tonight"]["score_breakdown"]["mode_applied"] is True
    assert "Lowest effort mode gave extra weight" in lowest_effort["best_tonight"]["explanation"]


def test_use_it_up_first_mode_can_flip_close_ranking_toward_more_pantry_usage(client):
    with SessionLocal() as db:
        pantry_items = [
            "use_it_up_a",
            "use_it_up_b",
            "use_it_up_c",
            "use_it_up_d",
            "use_it_up_e",
        ]
        smaller_recipe = _create_recipe(
            db,
            recipe_name="A Small Pantry Win",
            ingredient_names=pantry_items[:2],
            total_time_minutes=20,
            quality_score=24,
        )
        larger_recipe = _create_recipe(
            db,
            recipe_name="B Bigger Pantry Win",
            ingredient_names=pantry_items,
            total_time_minutes=20,
            quality_score=24,
        )

        smaller_recipe_id = smaller_recipe.id
        larger_recipe_id = larger_recipe.id
        _save_pantry_items(db, pantry_items)
        balanced = recommend_recipes(db, pantry_items, RecommendationMode.BALANCED)
        use_it_up_first = recommend_recipes(db, pantry_items, RecommendationMode.USE_IT_UP_FIRST)

    assert balanced["best_tonight"] is not None
    assert balanced["best_tonight"]["recipe"]["recipe_id"] == smaller_recipe_id
    assert use_it_up_first["best_tonight"] is not None
    assert use_it_up_first["best_tonight"]["recipe"]["recipe_id"] == larger_recipe_id
    assert use_it_up_first["decision_mode"]["key"] == RecommendationMode.USE_IT_UP_FIRST.value
    assert use_it_up_first["best_tonight"]["score_breakdown"]["mode_applied"] is True
    assert "Use it up first mode gave extra weight" in use_it_up_first["best_tonight"]["explanation"]


def test_use_soon_bonus_can_break_a_close_call_between_equal_pantry_fits(client):
    with SessionLocal() as db:
        pantry_items = [
            "use_soon_tiebreak_a",
            "use_soon_tiebreak_b",
            "use_soon_tiebreak_c",
        ]
        baseline_recipe = _create_recipe(
            db,
            recipe_name="A Baseline Skillet",
            ingredient_names=[pantry_items[0], pantry_items[1]],
        )
        use_soon_recipe = _create_recipe(
            db,
            recipe_name="B Use Soon Skillet",
            ingredient_names=[pantry_items[0], pantry_items[2]],
        )
        baseline_recipe_id = baseline_recipe.id
        use_soon_recipe_id = use_soon_recipe.id
        _save_pantry_items(db, pantry_items)
        _save_pantry_item(db, canonical_name=pantry_items[2], use_soon=True)

        result = recommend_recipes(db, pantry_items)

    assert result["best_tonight"] is not None
    assert result["best_tonight"]["recipe"]["recipe_id"] == use_soon_recipe_id
    assert result["best_tonight"]["score_breakdown"]["use_soon_applied"] is True
    assert result["best_tonight"]["score_breakdown"]["use_soon_points"] == 0.35
    assert "Uses an item you marked as use soon" in result["best_tonight"]["explanation"]
    assert "expire" not in result["best_tonight"]["explanation"].lower()
    assert "go bad" not in result["best_tonight"]["explanation"].lower()
    assert any(
        alternative["recipe"]["recipe_id"] == baseline_recipe_id for alternative in result["alternatives"]
    )


def test_use_soon_bonus_is_bounded_and_does_not_overpower_a_clearly_better_base_match(client):
    with SessionLocal() as db:
        pantry_items = [
            "use_soon_bound_a",
            "use_soon_bound_b",
        ]
        strong_fit = _create_recipe(
            db,
            recipe_name="A Use Soon Strong Pantry Fit",
            ingredient_names=pantry_items,
        )
        weaker_fit = _create_recipe(
            db,
            recipe_name="B Use Soon But Missing",
            ingredient_names=[
                pantry_items[0],
                "use_soon_bound_missing_1",
                "use_soon_bound_missing_2",
                "use_soon_bound_missing_3",
            ],
        )
        strong_fit_id = strong_fit.id
        weaker_fit_id = weaker_fit.id
        _save_pantry_items(db, pantry_items)
        _save_pantry_item(db, canonical_name=pantry_items[0], use_soon=True)
        _save_pantry_item(db, canonical_name=pantry_items[1], use_soon=True)

        result = recommend_recipes(db, pantry_items)

    assert result["best_tonight"] is not None
    assert result["best_tonight"]["recipe"]["recipe_id"] == strong_fit_id
    weaker_entry = next(
        entry for entry in result["almost_there"] + result["not_worth_it"]
        if entry["recipe"]["recipe_id"] == weaker_fit_id
    )
    assert weaker_entry["score_breakdown"]["use_soon_points"] <= 0.7
    assert weaker_entry["score_breakdown"]["use_soon_applied"] is True


def test_use_soon_explanations_only_appear_when_the_signal_applies(client):
    with SessionLocal() as db:
        pantry_items = [
            "use_soon_explanation_a",
            "use_soon_explanation_b",
            "use_soon_explanation_c",
        ]
        plain_recipe = _create_recipe(
            db,
            recipe_name="A Plain Pantry Dinner",
            ingredient_names=[pantry_items[0], pantry_items[1]],
        )
        use_soon_recipe = _create_recipe(
            db,
            recipe_name="B Marked Pantry Dinner",
            ingredient_names=[pantry_items[0], pantry_items[2]],
        )
        plain_recipe_id = plain_recipe.id
        use_soon_recipe_id = use_soon_recipe.id
        _save_pantry_items(db, pantry_items)
        _save_pantry_item(db, canonical_name=pantry_items[2], use_soon=True)

        result = recommend_recipes(db, pantry_items)

    plain_entry = next(
        entry for entry in result["cook_now"]
        if entry["recipe"]["recipe_id"] == plain_recipe_id
    )
    marked_entry = next(
        entry for entry in result["cook_now"]
        if entry["recipe"]["recipe_id"] == use_soon_recipe_id
    )
    assert plain_entry["score_breakdown"]["use_soon_applied"] is False
    assert "use soon" not in plain_entry["explanation"].lower()
    assert marked_entry["score_breakdown"]["use_soon_applied"] is True
    assert "use soon" in marked_entry["explanation"].lower()


def test_default_ranking_stays_unchanged_when_no_items_are_marked_use_soon(client):
    with SessionLocal() as db:
        pantry_items = [
            "use_soon_default_a",
            "use_soon_default_b",
            "use_soon_default_c",
        ]
        first_recipe = _create_recipe(
            db,
            recipe_name="A Default Ranking",
            ingredient_names=[pantry_items[0], pantry_items[1]],
        )
        first_recipe_id = first_recipe.id
        _create_recipe(
            db,
            recipe_name="B Default Ranking",
            ingredient_names=[pantry_items[0], pantry_items[2]],
        )
        _save_pantry_items(db, pantry_items)

        result = recommend_recipes(db, pantry_items)

    assert result["best_tonight"] is not None
    assert result["best_tonight"]["recipe"]["recipe_id"] == first_recipe_id
    assert result["best_tonight"]["score_breakdown"]["use_soon_applied"] is False
    assert result["best_tonight"]["score_breakdown"]["use_soon_points"] == 0.0
    assert "use soon" not in result["best_tonight"]["explanation"].lower()


def test_common_alias_pantry_item_counts_as_real_match_for_recommendations(client):
    with SessionLocal() as db:
        alias_recipe = _create_recipe(
            db,
            recipe_name="Alias Match Fried Rice",
            ingredient_names=["rice", "egg", "green onion"],
            total_time_minutes=18,
        )
        comparison_recipe = _create_recipe(
            db,
            recipe_name="Comparison Fried Rice",
            ingredient_names=["rice", "egg", "peas"],
            total_time_minutes=18,
        )
        alias_recipe_id = alias_recipe.id
        comparison_recipe_id = comparison_recipe.id
        _save_pantry_items(db, ["rice", "egg", "green onion"])

        result = recommend_recipes(db, ["rice", "egg", "scallions"])

    assert result["best_tonight"] is not None
    assert result["best_tonight"]["recipe"]["recipe_id"] == alias_recipe_id
    alias_entry = next(
        entry for entry in result["cook_now"]
        if entry["recipe"]["recipe_id"] == alias_recipe_id
    )
    comparison_entry = next(
        entry for entry in result["almost_there"] + result["not_worth_it"]
        if entry["recipe"]["recipe_id"] == comparison_recipe_id
    )
    assert alias_entry["recipe"]["missing_count"] == 0
    assert alias_entry["cta"]["pantry_ready"] is True
    assert comparison_entry["recipe"]["missing_ingredients"] == ["peas"]


def test_alias_handling_does_not_create_unsafe_false_positive_matches(client):
    with SessionLocal() as db:
        recipe = _create_recipe(
            db,
            recipe_name="Olive Oil Chicken",
            ingredient_names=["chicken", "olive oil"],
            total_time_minutes=20,
        )
        recipe_id = recipe.id
        _save_pantry_items(db, ["chicken", "oil"])

        result = recommend_recipes(db, ["chicken", "oil"])

    all_rows = result["cook_now"] + result["almost_there"] + result["not_worth_it"]
    entry = next(row for row in all_rows if row["recipe"]["recipe_id"] == recipe_id)
    assert entry["recipe"]["missing_count"] == 1
    assert entry["recipe"]["missing_ingredients"] == ["olive oil"]
    assert entry["cta"]["pantry_ready"] is False


def test_recommendations_hide_review_only_recipe_inventory(client):
    with SessionLocal() as db:
        hidden_recipe = _create_recipe(
            db,
            recipe_name="Review Only Dinner",
            ingredient_names=["review_only_chicken", "review_only_rice"],
            total_time_minutes=20,
        )
        visible_recipe = _create_recipe(
            db,
            recipe_name="Visible Dinner",
            ingredient_names=["review_only_chicken", "review_only_rice", "review_only_soy"],
            total_time_minutes=22,
        )
        hidden_recipe.quality_bucket = "KEEP_BUT_FLAG_FOR_REVIEW"
        hidden_recipe.review_status = "needs_editor_review"
        hidden_recipe.is_production_ready = True
        hidden_recipe_id = hidden_recipe.id
        visible_recipe_id = visible_recipe.id
        db.commit()

        _save_pantry_items(db, ["review_only_chicken", "review_only_rice", "review_only_soy"])
        result = recommend_recipes(db, ["review_only_chicken", "review_only_rice", "review_only_soy"])

    all_rows = [
        item
        for item in [
            result["best_tonight"],
            *result["alternatives"],
            *result["closest_options"],
            *result["cook_now"],
            *result["almost_there"],
            *result["not_worth_it"],
        ]
        if item is not None
    ]
    recommended_ids = {row["recipe"]["recipe_id"] for row in all_rows}

    assert hidden_recipe_id not in recommended_ids
    assert visible_recipe_id in recommended_ids
