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


def test_build_enriched_recipe_expands_weak_instruction_with_time_heat_and_cue() -> None:
    recipe = build_enriched_recipe(
        {
            "name": "Crispy Salmon Rice Bowl",
            "required": ["salmon", "rice", "green onion"],
            "optional": ["soy sauce"],
            "cook_method": "skillet",
            "instructions": "pan-fry in oil until crisp outside and cooked through",
            "prep_time_minutes": 8,
            "cook_time_minutes": 10,
            "total_time_minutes": 18,
            "servings": 2,
        }
    )

    cook_text = " ".join(step["instruction_text"].lower() for step in recipe["steps"])
    assert "medium-high heat" in cook_text
    assert "minutes" in cook_text
    assert "opaque and flakes" in cook_text
    assert recipe["instruction_confidence"] in {"medium", "high"}


def test_build_enriched_recipe_keeps_step_count_reasonable_for_short_instructions() -> None:
    recipe = build_enriched_recipe(
        {
            "name": "Quick Chicken Pasta",
            "required": ["chicken", "pasta", "garlic"],
            "optional": ["parmesan"],
            "cook_method": "stovetop",
            "instructions": "cook chicken then mix with pasta",
            "prep_time_minutes": 10,
            "cook_time_minutes": 12,
            "total_time_minutes": 22,
            "servings": 2,
        }
    )

    assert 3 <= len(recipe["steps"]) <= 5


def test_build_enriched_recipe_avoids_banned_phrases_and_keeps_steps_concise() -> None:
    recipe = build_enriched_recipe(
        {
            "name": "Garlic Broccoli",
            "required": ["broccoli", "garlic", "oil"],
            "optional": [],
            "cook_method": "skillet",
            "instructions": "saute broccoli until done",
            "prep_time_minutes": 5,
            "cook_time_minutes": 8,
            "total_time_minutes": 13,
            "servings": 2,
        }
    )

    banned_phrases = {"smell ready", "look cohesive", "as needed", "until done"}
    for step in recipe["steps"]:
        lowered = step["instruction_text"].lower()
        assert not any(phrase in lowered for phrase in banned_phrases)
        assert len(lowered.split()) <= 20


def test_build_enriched_recipe_uses_pan_fry_heat_rule() -> None:
    recipe = build_enriched_recipe(
        {
            "name": "Pan-Fried Cod",
            "required": ["cod", "oil"],
            "optional": [],
            "cook_method": "skillet",
            "instructions": "pan-fry the cod",
            "cook_time_minutes": 8,
            "total_time_minutes": 8,
            "servings": 2,
        }
    )

    assert any("medium-high heat" in step["instruction_text"].lower() for step in recipe["steps"])


def test_build_enriched_recipe_skips_generic_prep_step_when_not_needed() -> None:
    recipe = build_enriched_recipe(
        {
            "name": "Pan-Fried Salmon",
            "required": ["salmon", "oil"],
            "optional": [],
            "cook_method": "skillet",
            "instructions": "pan-fry the salmon",
            "cook_time_minutes": 8,
            "total_time_minutes": 8,
            "servings": 2,
        }
    )

    assert not recipe["steps"][0]["instruction_text"].lower().startswith("first, prep")
    assert "slice or chop" not in recipe["steps"][0]["instruction_text"].lower()


def test_build_enriched_recipe_does_not_reference_missing_ingredients_in_fallback_steps() -> None:
    recipe = build_enriched_recipe(
        {
            "name": "Quick Chicken Pasta",
            "required": ["chicken", "pasta", "garlic"],
            "optional": [],
            "cook_method": "stovetop",
            "prep_time_minutes": 8,
            "cook_time_minutes": 12,
            "total_time_minutes": 20,
            "servings": 2,
        }
    )

    instruction_text = " ".join(step["instruction_text"].lower() for step in recipe["steps"])
    assert "vegetable" not in instruction_text
    assert "garlic" in instruction_text


def test_build_enriched_recipe_dedupes_repeated_cook_logic() -> None:
    recipe = build_enriched_recipe(
        {
            "name": "Chicken Skillet",
            "required": ["chicken", "onion"],
            "optional": [],
            "cook_method": "skillet",
            "instructions": "Cook the chicken in a pan. Cook the chicken in a pan. Serve.",
            "cook_time_minutes": 10,
            "total_time_minutes": 10,
            "servings": 2,
        }
    )

    cook_steps = [step for step in recipe["steps"] if "chicken" in step["instruction_text"].lower() and "cook" in step["instruction_text"].lower()]
    assert len(cook_steps) == 1


def test_build_enriched_recipe_pan_fry_follows_realistic_sequence() -> None:
    recipe = build_enriched_recipe(
        {
            "name": "Pan-Fried Cod",
            "required": ["cod", "oil"],
            "optional": [],
            "cook_method": "skillet",
            "cook_time_minutes": 8,
            "total_time_minutes": 8,
            "servings": 2,
        }
    )

    steps = [step["instruction_text"].lower() for step in recipe["steps"]]
    assert "pat the cod dry" in steps[0]
    assert "heat a lightly oiled skillet" in steps[1]
    assert "first side" in steps[2]
    assert "opaque and flakes easily" in steps[3]


def test_build_enriched_recipe_does_not_fake_confidence_for_unsupported_weak_recipe() -> None:
    recipe = build_enriched_recipe(
        {
            "name": "Mystery Dinner Bowl",
            "required": ["beans", "corn"],
            "optional": [],
            "cook_method": "stovetop",
            "instructions": "mix together then cook until done",
            "cook_time_minutes": 8,
            "total_time_minutes": 12,
            "servings": 2,
        }
    )

    assert recipe["instruction_confidence"] == "low"
    assert "low_instruction_confidence" in recipe["quality_reason"]
    combined = " ".join(step["instruction_text"].lower() for step in recipe["steps"])
    assert "medium-high heat" not in combined
    assert "ingredients" not in combined
    assert "until done" not in combined


def test_build_enriched_recipe_keeps_prep_and_cook_stages_separate_for_pan_fried_fish() -> None:
    recipe = build_enriched_recipe(
        {
            "name": "Pan-Fried Bass",
            "required": ["bass", "oil", "salt"],
            "optional": ["lemon", "garlic"],
            "cook_method": "skillet",
            "cook_time_minutes": 9,
            "total_time_minutes": 15,
            "servings": 2,
        }
    )

    steps = [step["instruction_text"].lower() for step in recipe["steps"]]
    assert "pat the bass dry" in steps[0]
    assert "heat a lightly oiled skillet" in steps[1]
    assert "pat the bass dry" not in steps[1]
    assert "flip and cook the second side" in steps[3]
