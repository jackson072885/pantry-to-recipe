from __future__ import annotations


def _unwrap(response):
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    return body["data"]


def test_recipe_detail_exposes_enriched_contract(client) -> None:
    recipes_response = client.get("/recipes", params={"limit": 5})
    assert recipes_response.status_code == 200
    recipes = _unwrap(recipes_response)
    assert recipes

    recipe_id = recipes[0]["id"]
    detail_response = client.get(f"/recipes/{recipe_id}")
    assert detail_response.status_code == 200
    recipe = _unwrap(detail_response)

    assert recipe["name"]
    assert recipe["short_description"]
    assert isinstance(recipe["meal_type"], str)
    assert recipe["meal_type"] != ""
    assert "primary_protein" in recipe
    assert isinstance(recipe["equipment"], list)
    assert isinstance(recipe["tips"], list)
    assert isinstance(recipe["substitutions"], list)
    assert isinstance(recipe["storage"], list)
    assert recipe["quality_bucket"] in {"KEEP_AS_IS", "KEEP_AND_ENRICH"}
    assert recipe["instruction_confidence"] in {"low", "medium"}
    assert recipe["readiness"]["can_cook_now"] in {True, False}
    assert recipe["readiness"]["required_ready_count"] <= recipe["readiness"]["required_count"]
    assert isinstance(recipe["readiness"]["missing_required_ingredients"], list)
    assert isinstance(recipe["readiness"]["required_quantity_confirmation_ingredients"], list)
    assert isinstance(recipe["steps"], list)
    assert len(recipe["steps"]) >= 3
    assert isinstance(recipe["ingredients"], list)
    assert len(recipe["ingredients"]) >= 3

    ingredient = recipe["ingredients"][0]
    assert ingredient["display_name"]
    assert ingredient["required_quantity"] > 0
    assert ingredient["unit"]
    assert "measurement_is_estimated" in ingredient
    assert ingredient["pantry_status"] in {"ready", "missing", "needs_quantity_confirmation"}
    assert "pantry_has_enough" in ingredient
    assert any(item["display_quantity"] is not None for item in recipe["ingredients"])
    assert any(item["display_unit"] for item in recipe["ingredients"])

    step = recipe["steps"][0]
    assert step["step_number"] >= 1
    assert step["instruction_text"]
    assert len(recipe["steps"]) <= 5
    assert any(item["timing_minutes"] is not None for item in recipe["steps"])
    assert any(item["doneness_cue"] for item in recipe["steps"])
    assert any(
        "minute" in item["instruction_text"].lower()
        or any(level in item["instruction_text"].lower() for level in ("low heat", "medium heat", "medium-high heat", "high heat"))
        or any(cue in item["instruction_text"].lower() for cue in ("golden", "opaque", "flakes", "tender", "fragrant"))
        for item in recipe["steps"]
    )


def test_recommendations_include_recipe_metadata(client) -> None:
    response = client.get(
        "/recommendations",
        params=[("pantry", "chicken"), ("pantry", "rice"), ("pantry", "soy sauce")],
    )
    assert response.status_code == 200
    payload = _unwrap(response)
    bucket = payload["cook_now"] or payload["almost_there"] or payload["not_worth_it"]
    assert bucket

    recipe = bucket[0]["recipe"]
    assert "short_description" in recipe
    assert "difficulty" in recipe
    assert "meal_type" in recipe
    assert "servings" in recipe
    assert "quality_score" in recipe


def test_recommendation_linked_recipe_detail_stays_available(client) -> None:
    response = client.get(
        "/recommendations",
        params=[("pantry", "chicken"), ("pantry", "rice"), ("pantry", "soy sauce")],
    )
    assert response.status_code == 200
    payload = _unwrap(response)

    candidate = payload["best_tonight"]
    if candidate is None:
        bucket = payload["cook_now"] or payload["almost_there"] or payload["not_worth_it"]
        assert bucket
        candidate = bucket[0]

    recipe_id = candidate["recipe"]["recipe_id"]
    detail_response = client.get(f"/recipes/{recipe_id}")
    assert detail_response.status_code == 200

    recipe = _unwrap(detail_response)
    assert recipe["id"] == recipe_id
    assert recipe["quality_bucket"] in {"KEEP_AS_IS", "KEEP_AND_ENRICH"}
    assert "readiness" in recipe
