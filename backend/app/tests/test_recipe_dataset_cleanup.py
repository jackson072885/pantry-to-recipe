from __future__ import annotations

import uuid

from app.db import SessionLocal
from app.models.ingredient import Ingredient
from app.models.recipe import Recipe, RecipeIngredient
from app.services.recipe_dataset_service import archive_incomplete_active_recipes, validate_active_recipes


def _create_recipe(
    *,
    name: str,
    instructions: str | None,
    ingredient_names: list[str],
) -> int:
    db = SessionLocal()
    try:
        recipe = Recipe(name=name, instructions=instructions, servings=2)
        db.add(recipe)
        db.flush()

        for ingredient_name in ingredient_names:
            ingredient = Ingredient(canonical_name=ingredient_name)
            db.add(ingredient)
            db.flush()
            db.add(
                RecipeIngredient(
                    recipe_id=recipe.id,
                    ingredient_id=ingredient.id,
                    is_required=True,
                    required_quantity=1.0,
                    unit="ea",
                )
            )

        db.commit()
        return recipe.id
    finally:
        db.close()


def test_cleanup_archives_incomplete_active_recipes(client):  # noqa: ARG001 - ensures startup created tables
    suffix = uuid.uuid4().hex[:8]
    valid_recipe_id = _create_recipe(
        name=f"valid-cleanup-{suffix}",
        instructions="Cook it well.",
        ingredient_names=[
            f"valid-cleanup-ing-a-{suffix}",
            f"valid-cleanup-ing-b-{suffix}",
        ],
    )
    incomplete_recipe_id = _create_recipe(
        name=f"incomplete-cleanup-{suffix}",
        instructions="",
        ingredient_names=[
            f"incomplete-cleanup-ing-a-{suffix}",
            f"incomplete-cleanup-ing-b-{suffix}",
        ],
    )

    db = SessionLocal()
    try:
        before = validate_active_recipes(db)
        invalid_ids = {row["recipe_id"] for row in before["invalid"]}
        assert incomplete_recipe_id in invalid_ids
        assert valid_recipe_id not in invalid_ids

        cleanup = archive_incomplete_active_recipes(db)
        archived_ids = {row["recipe_id"] for row in cleanup["archived"]}
        assert incomplete_recipe_id in archived_ids

        after = validate_active_recipes(db)
        invalid_ids_after = {row["recipe_id"] for row in after["invalid"]}
        assert incomplete_recipe_id not in invalid_ids_after
    finally:
        db.close()


def test_archived_recipes_are_excluded_from_runtime_queries(client):
    suffix = uuid.uuid4().hex[:8]
    active_name = f"active-runtime-{suffix}"
    archived_name = f"[ARCHIVED:999] archived-runtime-{suffix}"
    ingredient_name_a = f"runtime-ingredient-a-{suffix}"
    ingredient_name_b = f"runtime-ingredient-b-{suffix}"

    _create_recipe(
        name=active_name,
        instructions="Cook until done.",
        ingredient_names=[ingredient_name_a, ingredient_name_b],
    )
    _create_recipe(
        name=archived_name,
        instructions="This should never appear.",
        ingredient_names=[
            f"runtime-ingredient-archived-a-{suffix}",
            f"runtime-ingredient-archived-b-{suffix}",
        ],
    )

    recipes_response = client.get("/recipes", params={"limit": 500})
    assert recipes_response.status_code == 200
    recipes_body = recipes_response.json()["data"]
    recipe_names = {row["name"] for row in recipes_body}
    assert active_name in recipe_names
    assert archived_name not in recipe_names

    client.post("/pantry/add", json={"name": ingredient_name_a, "amount": 1, "unit": "ea"})
    client.post("/pantry/add", json={"name": ingredient_name_b, "amount": 1, "unit": "ea"})
    recommendations_response = client.get(
        "/recommendations",
        params=[("pantry", ingredient_name_a), ("pantry", ingredient_name_b)],
    )
    assert recommendations_response.status_code == 200
    recommendations = recommendations_response.json()["data"]
    bucket_names = ("cook_now", "almost_there", "not_worth_it", "alternatives")
    all_names = {
        row["recipe"]["recipe_name"]
        for bucket_name in bucket_names
        for bucket in [recommendations.get(bucket_name, [])]
        for row in bucket
    }
    if recommendations.get("best_tonight"):
        all_names.add(recommendations["best_tonight"]["recipe"]["recipe_name"])
    assert active_name in all_names
    assert archived_name not in all_names
