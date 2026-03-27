from __future__ import annotations


def _unwrap(response):
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    return body["data"]


def test_ai_recipe_optimize(client):
    response = client.post(
        "/ai/recipe/optimize",
        json={
            "raw_prompt": "Need a quick spicy chicken skillet dinner without peanuts",
            "constraints": {
                "time_band": "quick",
                "budget_band": "stretch",
                "household_band": "3_4",
            },
            "pantry_ids": [1, 2, 3],
        },
    )
    assert response.status_code == 200
    data = _unwrap(response)
    assert "optimized_prompt" in data
    assert "extracted_intent" in data
    assert data["extracted_intent"]["dish_style"] in {
        "skillet",
        "bowl",
        "wrap",
        "sheet_pan",
        "pasta",
        "soup",
        "stir_fry",
    }
    assert data["confidence"] in {"low", "med", "high"}


def test_supply_plan_top_3_deterministic_shape(client):
    payload = {
        "pantry_items": ["rice", "onion"],
        "household_band": "3_4",
        "days_target": 7,
        "budget_sensitivity": "normal",
    }
    first = client.post("/supply/plan", json=payload)
    second = client.post("/supply/plan", json=payload)
    assert first.status_code == 200
    assert second.status_code == 200

    first_body = _unwrap(first)
    second_body = _unwrap(second)

    assert first_body["bottleneck_ingredient"] in {"protein", "variety"}
    assert isinstance(first_body["protein_exhaustion_day"], int)
    assert first_body["generated_for_days"] == 7
    assert len(first_body["recommendations"]) == 3
    assert first_body == second_body

    for row in first_body["recommendations"]:
        assert "ingredient" in row
        assert "coverage_delta_days" in row
        assert "meals_unlocked" in row
        assert row["estimated_spend_band"] in {"$", "$$", "$$$"}
        assert row["confidence"] in {"low", "med", "high"}


def test_ai_recipe_generate_returns_expected_schema(client):
    payload = {
        "raw_prompt": "Quick skillet dinner with chicken",
        "pantry_items": ["chicken", "onion", "rice", "salt", "oil"],
        "time_band": "quick",
        "budget_band": "normal",
        "household_band": "3_4",
        "allow_missing": 2,
    }
    response = client.post("/ai/recipe/generate", json=payload)
    assert response.status_code == 200
    data = _unwrap(response)
    assert "title" in data
    assert "archetype" in data
    assert "ingredients" in data
    assert "steps" in data
    assert "pantry_alignment" in data
    assert "why_this_works" in data
    assert "safety_notes" in data
    assert "validation" in data
    assert len(data["why_this_works"]) >= 2
    assert len(data["steps"]) >= 4


def test_ai_recipe_generate_is_deterministic(client):
    payload = {
        "raw_prompt": "Pasta dinner with pantry focus",
        "pantry_items": ["pasta", "tomato sauce", "garlic", "salt", "oil"],
        "time_band": "standard",
        "budget_band": "stretch",
        "household_band": "1_2",
        "allow_missing": 1,
    }
    first = client.post("/ai/recipe/generate", json=payload)
    second = client.post("/ai/recipe/generate", json=payload)
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()


def test_ai_recipe_generate_missing_respects_allow_missing(client):
    payload = {
        "raw_prompt": "Wrap dinner with beef",
        "pantry_items": ["salt"],
        "time_band": "quick",
        "budget_band": "stretch",
        "household_band": "3_4",
        "allow_missing": 1,
    }
    response = client.post("/ai/recipe/generate", json=payload)
    assert response.status_code == 200
    data = _unwrap(response)
    assert len(data["pantry_alignment"]["missing"]) <= payload["allow_missing"]


def test_ai_recipe_generate_pan_fried_bass_uses_bass_from_pantry(client):
    payload = {
        "raw_prompt": "pan-fried bass",
        "pantry_items": ["bass", "oil", "salt"],
        "time_band": "quick",
        "budget_band": "normal",
        "household_band": "1_2",
        "allow_missing": 2,
    }
    first = client.post("/ai/recipe/generate", json=payload)
    second = client.post("/ai/recipe/generate", json=payload)
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()

    data = _unwrap(first)
    ingredient_names = {row["name"] for row in data["ingredients"]}
    assert "bass" in ingredient_names or "fish" in ingredient_names
    assert "bass" in data["pantry_alignment"]["used_from_pantry"] or "fish" in data["pantry_alignment"]["used_from_pantry"]
