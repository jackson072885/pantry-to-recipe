from __future__ import annotations

import uuid

from app.db import SessionLocal
from app.models.ingredient import Ingredient
from app.models.recipe import Recipe, RecipeIngredient


def _unwrap(response):
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    return body["data"]


def _create_recipe_with_requirement(*, quantity: float, unit: str) -> tuple[int, str]:
    suffix = uuid.uuid4().hex[:8]
    ingredient_name = f"import-truth-{unit}-{suffix}"

    db = SessionLocal()
    try:
        ingredient = Ingredient(canonical_name=ingredient_name)
        db.add(ingredient)
        db.flush()

        recipe = Recipe(
            name=f"Import Truth Recipe {suffix}",
            servings=2,
            quality_bucket="KEEP_AS_IS",
            review_status="approved",
            is_production_ready=True,
        )
        db.add(recipe)
        db.flush()

        db.add(
            RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=ingredient.id,
                is_required=True,
                required_quantity=quantity,
                unit=unit,
            )
        )
        db.commit()
        return recipe.id, ingredient_name
    finally:
        db.close()


def test_pantry_import_preview_returns_structured_line_results(client):
    client.post("/pantry/clear")

    preview_response = client.post(
        "/pantry/import/preview",
        json={"lines": ["1 lb chicken", "mystery powder", "1 bag rice"]},
    )

    assert preview_response.status_code == 200
    data = _unwrap(preview_response)
    assert data["summary"] == {
        "line_count": 3,
        "accepted_count": 1,
        "review_count": 1,
        "rejected_count": 1,
    }
    assert data["results"][0] == {
        "raw_line": "1 lb chicken",
        "cleaned_line": "1 lb chicken",
        "status": "accepted",
        "parsed_quantity": 1.0,
        "parsed_unit": "lb",
        "parsed_ingredient_text": "chicken",
        "canonical_unit": "g",
        "canonical_ingredient": "chicken",
        "reason_code": "accepted",
        "reason_message": "Line is safe to import",
    }
    assert data["results"][1]["status"] == "review"
    assert data["results"][1]["reason_code"] == "ingredient_not_found"
    assert data["results"][2]["status"] == "rejected"
    assert data["results"][2]["reason_code"] == "line_not_parseable"


def test_pantry_import_commit_only_writes_accepted_lines_after_revalidation(client):
    client.post("/pantry/clear")

    commit_response = client.post(
        "/pantry/import/commit",
        json={"lines": ["1 cup rice", "mystery powder", "1 bag rice", "onion"]},
    )

    assert commit_response.status_code == 200
    data = _unwrap(commit_response)
    assert data["committed_count"] == 2
    assert data["summary"] == {
        "line_count": 4,
        "accepted_count": 2,
        "review_count": 1,
        "rejected_count": 1,
    }
    assert data["items"] == [
        {
            "ingredient": "onion",
            "quantity": None,
            "unit": None,
            "quantity_is_known": False,
            "use_soon": False,
        },
        {
            "ingredient": "rice",
            "quantity": 240.0,
            "unit": "ml",
            "quantity_is_known": True,
            "use_soon": False,
        },
    ]


def test_pantry_import_commit_revalidates_lines_instead_of_trusting_preview_objects(client):
    client.post("/pantry/clear")

    preview_response = client.post("/pantry/import/preview", json={"lines": ["rice"]})
    assert preview_response.status_code == 200

    client.post("/pantry/add", json={"name": "rice", "amount": 1, "unit": "cup"})

    commit_response = client.post("/pantry/import/commit", json={"lines": ["rice"]})
    assert commit_response.status_code == 200
    data = _unwrap(commit_response)

    assert data["committed_count"] == 1
    assert data["results"][0]["status"] == "accepted"
    assert data["results"][0]["reason_code"] == "accepted"
    assert data["items"] == [
        {
            "ingredient": "rice",
            "quantity": 240.0,
            "unit": "ml",
            "quantity_is_known": True,
            "use_soon": False,
        }
    ]


def test_pantry_import_preview_is_side_effect_free(client):
    client.post("/pantry/clear")

    preview_response = client.post(
        "/pantry/import/preview",
        json={"lines": ["1 cup rice", "onion"]},
    )

    assert preview_response.status_code == 200
    preview_data = _unwrap(preview_response)
    assert preview_data["summary"] == {
        "line_count": 2,
        "accepted_count": 2,
        "review_count": 0,
        "rejected_count": 0,
    }

    pantry_response = client.get("/pantry")
    assert pantry_response.status_code == 200
    pantry_data = _unwrap(pantry_response)
    assert pantry_data["items"] == []


def test_pantry_import_routes_reject_malformed_payloads_without_writing(client):
    client.post("/pantry/clear")

    preview_response = client.post("/pantry/import/preview", json={"lines": "rice"})
    assert preview_response.status_code == 400
    preview_body = preview_response.json()
    assert preview_body["success"] is False
    assert preview_body["error"]["code"] == "BAD_REQUEST"
    assert "valid list" in preview_body["error"]["message"]

    commit_response = client.post("/pantry/import/commit", json={"lines": []})
    assert commit_response.status_code == 400
    commit_body = commit_response.json()
    assert commit_body["success"] is False
    assert commit_body["error"]["code"] == "BAD_REQUEST"
    assert commit_body["error"]["message"] == "At least one pantry import line is required"

    pantry_response = client.get("/pantry")
    assert pantry_response.status_code == 200
    pantry_data = _unwrap(pantry_response)
    assert pantry_data["items"] == []


def test_pantry_import_routes_reject_non_string_lines(client):
    response = client.post("/pantry/import/preview", json={"lines": [1, "rice"]})
    assert response.status_code == 400

    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "BAD_REQUEST"
    assert body["error"]["message"] == "Input should be a valid string"


def test_ingredient_only_import_does_not_create_false_readiness_for_larger_count_requirements(client):
    client.post("/pantry/clear")
    recipe_id, ingredient_name = _create_recipe_with_requirement(quantity=2, unit="ea")

    commit_response = client.post("/pantry/import/commit", json={"lines": [ingredient_name]})
    assert commit_response.status_code == 200
    commit_data = _unwrap(commit_response)
    assert commit_data["items"] == [
        {
            "ingredient": ingredient_name,
            "quantity": None,
            "unit": None,
            "quantity_is_known": False,
            "use_soon": False,
        }
    ]

    recommendations_response = client.get("/recommendations", params=[("pantry", ingredient_name)])
    assert recommendations_response.status_code == 200
    recommendations_data = _unwrap(recommendations_response)
    rows = (
        recommendations_data["cook_now"]
        + recommendations_data["almost_there"]
        + recommendations_data["not_worth_it"]
    )
    recipe = next(row["recipe"] for row in rows if row["recipe"]["recipe_id"] == recipe_id)
    assert recipe["missing_count"] == 1
    assert recipe["present_required_count"] == 0

    cook_response = client.post(f"/cook/{recipe_id}")
    assert cook_response.status_code == 409
    assert ingredient_name in cook_response.json()["error"]["message"]


def test_ingredient_only_import_does_not_create_false_readiness_for_measured_requirements(client):
    client.post("/pantry/clear")
    recipe_id, ingredient_name = _create_recipe_with_requirement(quantity=1, unit="cup")

    commit_response = client.post("/pantry/import/commit", json={"lines": [ingredient_name]})
    assert commit_response.status_code == 200
    commit_data = _unwrap(commit_response)
    assert commit_data["items"] == [
        {
            "ingredient": ingredient_name,
            "quantity": None,
            "unit": None,
            "quantity_is_known": False,
            "use_soon": False,
        }
    ]

    recommendations_response = client.get("/recommendations", params=[("pantry", ingredient_name)])
    assert recommendations_response.status_code == 200
    recommendations_data = _unwrap(recommendations_response)
    rows = (
        recommendations_data["cook_now"]
        + recommendations_data["almost_there"]
        + recommendations_data["not_worth_it"]
    )
    recipe = next(row["recipe"] for row in rows if row["recipe"]["recipe_id"] == recipe_id)
    assert recipe["missing_count"] == 1
    assert recipe["present_required_count"] == 0

    cook_response = client.post(f"/cook/{recipe_id}")
    assert cook_response.status_code == 409
    assert ingredient_name in cook_response.json()["error"]["message"]
