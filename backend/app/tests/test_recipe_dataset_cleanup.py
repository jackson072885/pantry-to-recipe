from __future__ import annotations

import uuid

from app.db import SessionLocal
from app.models.ingredient import Ingredient
from app.models.recipe import Recipe, RecipeIngredient
from app.services.recipe_dataset_service import archive_incomplete_active_recipes, validate_active_recipes
from app.services.real_recipe_pack_service import seed_real_recipe_pack


def _create_recipe(
    *,
    name: str,
    instructions: str | None,
    ingredient_names: list[str],
) -> int:
    db = SessionLocal()
    try:
        recipe = Recipe(
            name=name,
            instructions=instructions,
            servings=2,
            quality_bucket="KEEP_AS_IS",
            review_status="approved",
            is_production_ready=True,
        )
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

    recipes_response = client.get("/recipes", params={"limit": 5000})
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


def test_non_production_ready_recipes_are_excluded_from_runtime_queries(client):  # noqa: ARG001
    suffix = uuid.uuid4().hex[:8]
    active_name = f"production-runtime-{suffix}"
    flagged_name = f"flagged-runtime-{suffix}"

    active_id = _create_recipe(
        name=active_name,
        instructions="Cook until done.\nServe hot.\nTaste and adjust seasoning.",
        ingredient_names=[
            f"prod-ingredient-a-{suffix}",
            f"prod-ingredient-b-{suffix}",
        ],
    )
    flagged_id = _create_recipe(
        name=flagged_name,
        instructions="Cook until done.\nServe hot.\nTaste and adjust seasoning.",
        ingredient_names=[
            f"flagged-ingredient-a-{suffix}",
            f"flagged-ingredient-b-{suffix}",
        ],
    )

    db = SessionLocal()
    try:
        active_recipe = db.query(Recipe).filter(Recipe.id == active_id).one()
        flagged_recipe = db.query(Recipe).filter(Recipe.id == flagged_id).one()
        active_recipe.is_production_ready = True
        flagged_recipe.is_production_ready = False
        flagged_recipe.quality_bucket = "REMOVE_AS_JUNK"
        db.commit()
    finally:
        db.close()

    recipes_response = client.get("/recipes", params={"limit": 5000})
    assert recipes_response.status_code == 200
    recipe_names = {row["name"] for row in recipes_response.json()["data"]}
    assert active_name in recipe_names
    assert flagged_name not in recipe_names


def test_seed_archives_active_recipes_outside_curated_pack(client):  # noqa: ARG001 - startup handles schema
    suffix = uuid.uuid4().hex[:8]
    legacy_recipe_id = _create_recipe(
        name=f"legacy-off-pack-{suffix}",
        instructions="Cook until done.",
        ingredient_names=[
            f"legacy-off-pack-ing-a-{suffix}",
            f"legacy-off-pack-ing-b-{suffix}",
        ],
    )

    db = SessionLocal()
    try:
        summary = seed_real_recipe_pack(db)
        assert summary["archived_legacy_count"] >= 1
        archived = db.get(Recipe, legacy_recipe_id)
        assert archived is not None
        assert archived.name.startswith("[ARCHIVED:")
    finally:
        db.close()


def test_non_production_recipe_is_hidden_from_detail_and_cook(client):
    suffix = uuid.uuid4().hex[:8]
    recipe_id = _create_recipe(
        name=f"review-only-{suffix}",
        instructions="Cook until done.",
        ingredient_names=[
            f"review-only-ing-a-{suffix}",
            f"review-only-ing-b-{suffix}",
        ],
    )

    db = SessionLocal()
    try:
        recipe = db.get(Recipe, recipe_id)
        assert recipe is not None
        recipe.is_production_ready = False
        recipe.quality_bucket = "KEEP_BUT_FLAG_FOR_REVIEW"
        recipe.review_status = "needs_review"
        db.commit()
    finally:
        db.close()

    detail_response = client.get(f"/recipes/{recipe_id}")
    assert detail_response.status_code == 404

    cook_response = client.post(f"/cook/{recipe_id}")
    assert cook_response.status_code == 404


def test_flagged_for_review_recipe_is_hidden_from_detail_even_when_active(client):
    suffix = uuid.uuid4().hex[:8]
    recipe_id = _create_recipe(
        name=f"active-review-only-{suffix}",
        instructions="Cook until done.\nServe hot.\nTaste and adjust seasoning.",
        ingredient_names=[
            f"active-review-ing-a-{suffix}",
            f"active-review-ing-b-{suffix}",
        ],
    )

    db = SessionLocal()
    try:
        recipe = db.get(Recipe, recipe_id)
        assert recipe is not None
        recipe.is_production_ready = True
        recipe.quality_bucket = "KEEP_BUT_FLAG_FOR_REVIEW"
        recipe.review_status = "needs_review"
        db.commit()
    finally:
        db.close()

    recipes_response = client.get("/recipes", params={"limit": 5000})
    assert recipes_response.status_code == 200
    recipe_ids = {row["id"] for row in recipes_response.json()["data"]}
    assert recipe_id not in recipe_ids

    detail_response = client.get(f"/recipes/{recipe_id}")
    assert detail_response.status_code == 404
