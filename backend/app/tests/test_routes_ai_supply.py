from __future__ import annotations


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
    data = response.json()
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

    first_body = first.json()
    second_body = second.json()

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
