from __future__ import annotations

from app.models.ingredient import Ingredient
from app.models.recipe import Recipe, RecipeIngredient
from app.services.recipe_quality_service import IngredientRow, _build_steps, _generate_steps_from_template


def _ingredient_rows(*names: str) -> list[IngredientRow]:
    rows: list[IngredientRow] = []
    for name in names:
        rows.append(
            IngredientRow(
                recipe_ingredient=RecipeIngredient(is_required=True, required_quantity=1.0, unit="ea"),
                ingredient=Ingredient(canonical_name=name),
            )
        )
    return rows


def test_generate_steps_from_template_stays_ingredient_aware() -> None:
    recipe = Recipe(
        name="Quick Chicken Pasta",
        instructions="",
        cook_method="stovetop",
        prep_time_minutes=8,
        cook_time_minutes=12,
        total_time_minutes=20,
        servings=2,
    )

    lines = _generate_steps_from_template(recipe, _ingredient_rows("chicken", "pasta", "garlic"), "stovetop")
    combined = " ".join(lines).lower()

    assert "vegetable" not in combined
    assert "garlic" in combined
    assert "pasta" in combined


def test_generate_steps_from_template_pan_fry_uses_heat_flip_finish_flow() -> None:
    recipe = Recipe(
        name="Pan-Fried Cod",
        instructions="",
        cook_method="skillet",
        cook_time_minutes=8,
        total_time_minutes=8,
        servings=2,
    )

    lines = _generate_steps_from_template(recipe, _ingredient_rows("cod"), "skillet")

    assert "pat the cod dry" in lines[0].lower()
    assert any("heat a lightly oiled skillet" in line.lower() for line in lines)
    assert any("first side" in line.lower() for line in lines)
    assert any("flip and cook" in line.lower() for line in lines)


def test_build_steps_removes_duplicate_cooking_logic() -> None:
    recipe = Recipe(
        name="Chicken Skillet",
        instructions="Cook the chicken in a pan.\nCook the chicken in a pan.\nServe.",
        cook_method="skillet",
        cook_time_minutes=10,
        total_time_minutes=10,
        servings=2,
    )

    steps = _build_steps(recipe, _ingredient_rows("chicken"), "skillet")
    chicken_steps = [step["instruction_text"].lower() for step in steps if "chicken" in step["instruction_text"].lower()]

    assert len(chicken_steps) == len(set(chicken_steps))


def test_build_steps_do_not_aggressively_enrich_unsupported_weak_recipe() -> None:
    recipe = Recipe(
        name="Mystery Dinner Bowl",
        instructions="mix together then cook until done",
        cook_method="stovetop",
        cook_time_minutes=8,
        total_time_minutes=10,
        servings=2,
    )

    steps = _build_steps(recipe, _ingredient_rows("beans", "corn"), "stovetop")
    combined = " ".join(step["instruction_text"].lower() for step in steps)

    assert steps[0]["instruction_confidence"] == "low"
    assert "medium heat" not in combined
    assert "medium-high heat" not in combined
    assert "ingredients" not in combined
    assert "until done" not in combined


def test_build_steps_keep_pattern_generated_weak_source_low_confidence() -> None:
    recipe = Recipe(
        name="Crispy Salmon Rice Bowl",
        instructions="pan-fry in oil until crisp outside and cooked through",
        cook_method="skillet",
        cook_time_minutes=10,
        total_time_minutes=18,
        servings=2,
    )

    steps = _build_steps(recipe, _ingredient_rows("salmon", "rice", "green onion"), "skillet")
    combined = " ".join(step["instruction_text"].lower() for step in steps)

    assert steps[0]["instruction_confidence"] == "low"
    assert "medium-high heat" in combined
    assert "opaque and flakes" in combined


def test_generate_steps_from_template_adds_time_and_doneness_for_chicken_skillet() -> None:
    recipe = Recipe(
        name="Chicken Pepper Skillet",
        instructions="",
        cook_method="skillet",
        prep_time_minutes=8,
        cook_time_minutes=12,
        total_time_minutes=20,
        servings=2,
    )

    lines = _generate_steps_from_template(recipe, _ingredient_rows("chicken", "bell pepper", "onion"), "skillet")
    combined = " ".join(lines).lower()

    assert "medium-high heat" in combined
    assert "for" in combined and "minutes" in combined
    assert "no longer pink" in combined


def test_generate_steps_from_template_replaces_brief_simmer_in_pasta_flow() -> None:
    recipe = Recipe(
        name="Shrimp Tomato Pasta",
        instructions="",
        cook_method="stovetop",
        prep_time_minutes=8,
        cook_time_minutes=14,
        total_time_minutes=22,
        servings=2,
    )

    lines = _generate_steps_from_template(recipe, _ingredient_rows("shrimp", "pasta", "tomato sauce"), "stovetop")
    combined = " ".join(lines).lower()

    assert "simmer briefly" not in combined
    assert "simmer over" in combined
    assert "2 to 3 minutes" in combined
    assert "pink, opaque" in combined
