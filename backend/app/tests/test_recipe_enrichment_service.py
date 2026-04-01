from __future__ import annotations

from app.services.recipe_enrichment_service import build_enriched_recipe, find_duplicate_pairs


def test_build_enriched_recipe_flags_side_dish_for_review() -> None:
    recipe = build_enriched_recipe(
        {
            "name": "Roasted Potatoes",
            "required": ["potato", "oil", "salt"],
            "optional": ["pepper"],
            "cook_method": "oven",
            "prep_time_minutes": 10,
            "cook_time_minutes": 25,
            "total_time_minutes": 35,
            "servings": 2,
        }
    )

    assert recipe["quality_bucket"] == "KEEP_BUT_FLAG_FOR_REVIEW"
    assert recipe["is_production_ready"] is False
    assert "side_dish_not_strong_dinner_candidate" in recipe["quality_reason"]


def test_duplicate_detection_ignores_adjacent_recipe_families() -> None:
    recipes = [
        build_enriched_recipe(
            {
                "name": "Chicken Fried Rice",
                "required": ["chicken", "rice", "egg", "soy sauce"],
                "optional": ["onion"],
                "cook_method": "skillet",
                "prep_time_minutes": 10,
                "cook_time_minutes": 15,
                "total_time_minutes": 25,
                "servings": 3,
            }
        ),
        build_enriched_recipe(
            {
                "name": "Vegetable Fried Rice",
                "required": ["rice", "egg", "carrot"],
                "optional": ["peas", "soy sauce"],
                "cook_method": "skillet",
                "prep_time_minutes": 8,
                "cook_time_minutes": 10,
                "total_time_minutes": 18,
                "servings": 3,
            }
        ),
    ]

    assert find_duplicate_pairs(recipes) == []


def test_build_enriched_recipe_sets_safe_default_quantities_for_known_ingredients() -> None:
    recipe = build_enriched_recipe(
        {
            "name": "Chicken Fried Rice",
            "required": ["chicken", "rice", "egg", "soy sauce"],
            "optional": ["onion"],
            "cook_method": "skillet",
            "prep_time_minutes": 10,
            "cook_time_minutes": 15,
            "total_time_minutes": 25,
            "servings": 2,
        }
    )

    ingredients = {row["canonical_name"]: row for row in recipe["ingredients"]}

    assert ingredients["chicken"]["required_quantity"] == 1.0
    assert ingredients["chicken"]["unit"] == "lb"
    assert ingredients["chicken"]["measurement_is_estimated"] is False

    assert ingredients["egg"]["required_quantity"] == 2.0
    assert ingredients["egg"]["unit"] == "ea"
    assert ingredients["egg"]["measurement_is_estimated"] is False

    assert ingredients["soy sauce"]["required_quantity"] == 2.0
    assert ingredients["soy sauce"]["unit"] == "tbsp"
