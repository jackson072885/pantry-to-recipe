from __future__ import annotations

from app.db import SessionLocal
from app.models.ingredient import Ingredient
from app.models.recipe import Recipe, RecipeIngredient


def _unwrap(response):
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    return body["data"]


def _ensure_ingredient(db, canonical_name: str) -> Ingredient:
    ingredient = db.query(Ingredient).filter(Ingredient.canonical_name == canonical_name).first()
    if ingredient is not None:
        return ingredient

    ingredient = Ingredient(canonical_name=canonical_name)
    db.add(ingredient)
    db.flush()
    return ingredient


def _create_recipe_with_rows(db, *, name: str, rows: list[dict]) -> int:
    recipe = Recipe(
        name=name,
        servings=2,
        total_time_minutes=25,
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

    for row in rows:
        ingredient = _ensure_ingredient(db, row["ingredient_name"])
        db.add(
            RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=ingredient.id,
                is_required=row.get("is_required", True),
                required_quantity=row.get("required_quantity", 1.0),
                unit=row.get("unit", "ea"),
                measurement_is_estimated=False,
                notes=row.get("notes"),
            )
        )

    db.commit()
    return recipe.id


def test_ingredient_only_import_lists_unknown_quantity_instead_of_fake_each(client):
    client.post("/pantry/clear")

    commit_response = client.post("/pantry/import/commit", json={"lines": ["onion"]})
    assert commit_response.status_code == 200

    data = _unwrap(commit_response)
    assert data["items"] == [
        {
            "ingredient": "onion",
            "quantity": None,
            "unit": None,
            "quantity_is_known": False,
            "use_soon": False,
        }
    ]


def test_unknown_quantity_import_can_surface_as_closest_option_without_claiming_strong_match(client):
    client.post("/pantry/clear")

    with SessionLocal() as db:
        recipe_id = _create_recipe_with_rows(
            db,
            name="Truthful Chicken Rice Bowl",
            rows=[
                {"ingredient_name": "truth_chicken_breast", "required_quantity": 1.12, "unit": "lb"},
                {"ingredient_name": "truth_rice", "required_quantity": 1, "unit": "cup"},
                {"ingredient_name": "truth_oil", "required_quantity": 1, "unit": "tbsp"},
            ],
        )

    client.post("/pantry/import/commit", json={"lines": ["truth_chicken_breast", "truth_oil"]})
    client.post("/pantry/add", json={"name": "truth_rice", "amount": 1, "unit": "cup"})

    recommendations_response = client.get(
        "/recommendations",
        params=[
            ("pantry", "truth_chicken_breast"),
            ("pantry", "truth_rice"),
            ("pantry", "truth_oil"),
        ],
    )
    assert recommendations_response.status_code == 200

    data = _unwrap(recommendations_response)
    assert data["recommendation_status"] == "no_strong_match"
    assert data["best_tonight"] is None
    assert data["closest_options"][0]["recipe"]["recipe_id"] == recipe_id
    assert data["closest_options"][0]["recipe"]["recommendation_type"] == "almost_there"
    assert data["closest_options"][0]["recipe"]["missing_count"] == 2
    assert data["closest_options"][0]["recipe"]["missing_core_count"] == 0
    assert data["closest_options"][0]["missing"]["quantity_confirmation_count"] == 2
    assert sorted(data["closest_options"][0]["missing"]["quantity_confirmation_ingredients"]) == [
        "truth_chicken_breast",
        "truth_oil",
    ]
    assert data["closest_options"][0]["cta"]["pantry_ready"] is False


def test_cook_blocks_when_required_ingredient_quantity_is_unknown_from_import(client):
    client.post("/pantry/clear")

    with SessionLocal() as db:
        recipe_id = _create_recipe_with_rows(
            db,
            name="Truthful Quesadilla",
            rows=[
                {"ingredient_name": "truth_tortilla", "required_quantity": 4, "unit": "ea"},
                {"ingredient_name": "truth_cheddar", "required_quantity": 1, "unit": "cup"},
            ],
        )

    client.post("/pantry/import/commit", json={"lines": ["truth_tortilla", "truth_cheddar"]})

    cook_response = client.post(f"/cook/{recipe_id}")
    assert cook_response.status_code == 409
    message = cook_response.json()["error"]["message"]
    assert "truth_tortilla" in message
    assert "truth_cheddar" in message
