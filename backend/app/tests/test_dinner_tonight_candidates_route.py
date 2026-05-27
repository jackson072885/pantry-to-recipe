from __future__ import annotations

from app.core.config import settings
from app.services import external_recipe_service as service


def _unwrap(response):
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    return body["data"]


def test_dinner_tonight_candidates_returns_external_best_and_alternatives(client, monkeypatch):
    monkeypatch.setattr(settings, "external_recipe_provider", "spoonacular")
    monkeypatch.setattr(settings, "spoonacular_api_key", "test-key")
    monkeypatch.setattr(
        service,
        "_fetch_spoonacular_candidates",
        lambda _ingredients, _limit: [
            {
                "id": 10,
                "title": "Chicken Rice Skillet",
                "usedIngredients": [{"name": "chicken"}, {"name": "rice"}],
                "missedIngredients": [],
                "instructions": ["Cook it."],
            },
            {
                "id": 11,
                "title": "Chicken Soup",
                "usedIngredients": [{"name": "chicken"}],
                "missedIngredients": [{"name": "stock"}],
                "instructions": ["Simmer it."],
            },
        ],
    )

    response = client.post(
        "/dinner-tonight/candidates",
        json={
            "ingredients": ["chicken", "rice"],
            "preferences": {"no_shopping": True, "max_time_minutes": 45},
            "limit": 10,
            "sources": ["external"],
        },
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["provider"] == "spoonacular"
    assert data["provider_status"] == "configured"
    assert data["best"]["source"] == "spoonacular"
    assert data["best"]["source_id"] == "10"
    assert data["alternatives"][0]["source_id"] == "11"
    assert data["candidates"]


def test_dinner_tonight_candidates_rejects_blank_ingredients(client):
    response = client.post(
        "/dinner-tonight/candidates",
        json={"ingredients": ["   "], "sources": ["external"]},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"


def test_dinner_tonight_candidates_default_disabled_is_controlled(client, monkeypatch):
    monkeypatch.setattr(settings, "external_recipe_provider", "disabled")

    response = client.post(
        "/dinner-tonight/candidates",
        json={"ingredients": ["chicken"], "limit": 10},
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data == {
        "provider": "disabled",
        "provider_status": "disabled",
        "best": None,
        "alternatives": [],
        "candidates": [],
        "error_message": None,
    }


def test_dinner_tonight_candidates_missing_api_key_is_controlled(client, monkeypatch):
    monkeypatch.setattr(settings, "external_recipe_provider", "spoonacular")
    monkeypatch.setattr(settings, "spoonacular_api_key", "")

    response = client.post(
        "/dinner-tonight/candidates",
        json={"ingredients": ["chicken"], "limit": 10},
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["provider"] == "spoonacular"
    assert data["provider_status"] == "missing_api_key"
    assert data["best"] is None
    assert data["alternatives"] == []
    assert data["candidates"] == []
