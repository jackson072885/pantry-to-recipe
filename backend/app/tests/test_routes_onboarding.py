from __future__ import annotations


def _unwrap(response):
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    return body["data"]


def test_onboarding_profile_preview_endpoint(client):
    response = client.post(
        "/onboarding/profile/preview",
        json={
            "diet": "omnivore",
            "allergies": ["peanut"],
            "time_pref": "<=30",
            "skill_level": "beginner",
            "pantry_items": ["eggs", "rice", "onion"],
        },
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert "summary" in data
    assert "confidence" in data
    assert data["confidence"] >= 0.0
    assert data["confidence"] <= 1.0


def test_onboarding_first_recipes_endpoint(client):
    response = client.post(
        "/onboarding/recipes/first",
        json={
            "session_id": "onb-test-1",
            "pantry_items": ["chicken", "rice", "salt"],
            "constraints": {
                "diet": "omnivore",
                "allergies": ["peanut"],
                "max_minutes": 30,
            },
        },
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert "recommendations" in data
    assert isinstance(data["recommendations"], list)

    if data["recommendations"]:
        top = data["recommendations"][0]
        assert "recipe_id" in top
        assert "recipe_name" in top
        assert "reasons" in top
        assert "missing_ingredients" in top
