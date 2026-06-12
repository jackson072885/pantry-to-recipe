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
    assert data["best"]["display_title"] == "Chicken Rice Skillet"
    assert data["best"]["used_ingredients"] == ["chicken", "rice"]
    assert data["best"]["missed_ingredients"] == []
    assert data["best"]["display_used_ingredients"] == ["Chicken", "Rice"]
    assert data["best"]["display_missed_ingredients"] == []
    assert data["best"]["source_provenance"] == {
        "source": "spoonacular",
        "source_id": "10",
        "source_url": None,
    }
    assert data["alternatives"][0]["source_id"] == "11"
    assert data["candidates"]
    assert data["filter_counts"]["mode"] == "cookable_tonight"
    assert data["filter_counts"]["families"]["feasibility_bucket"] == [
        {"value": "cookable_tonight", "count": 1}
    ]


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
    assert data["provider"] == "disabled"
    assert data["provider_status"] == "disabled"
    assert data["error_message"] is None
    assert data["best"]["source"] == "internal_recipe_bank"
    assert data["candidates"]
    assert {candidate["source"] for candidate in data["candidates"]} == {"internal_recipe_bank"}
    assert data["filter_counts"]["mode"] == "cookable_tonight"


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
    assert data["best"]["source"] == "internal_recipe_bank"
    assert data["candidates"]
    assert {candidate["source"] for candidate in data["candidates"]} == {"internal_recipe_bank"}
    assert data["filter_counts"]["mode"] == "cookable_tonight"


def test_dinner_tonight_candidates_unsupported_provider_uses_internal_fallback(client, monkeypatch):
    monkeypatch.setattr(settings, "external_recipe_provider", "unknown-provider")

    response = client.post(
        "/dinner-tonight/candidates",
        json={"ingredients": ["chicken"], "limit": 10},
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["provider"] == "unknown-provider"
    assert data["provider_status"] == "error"
    assert data["error_message"] == "Unsupported external recipe provider: unknown-provider"
    assert data["best"]["source"] == "internal_recipe_bank"
    assert data["candidates"]
    assert {candidate["source"] for candidate in data["candidates"]} == {"internal_recipe_bank"}


def test_dinner_tonight_candidates_provider_error_uses_internal_fallback(client, monkeypatch):
    monkeypatch.setattr(settings, "external_recipe_provider", "spoonacular")
    monkeypatch.setattr(settings, "spoonacular_api_key", "test-key")

    def fail_fetch(_ingredients, _limit):
        raise ValueError("provider failed")

    monkeypatch.setattr(service, "_fetch_spoonacular_candidates", fail_fetch)

    response = client.post(
        "/dinner-tonight/candidates",
        json={"ingredients": ["chicken"], "limit": 10},
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["provider"] == "spoonacular"
    assert data["provider_status"] == "error"
    assert data["error_message"] == "External recipe provider failed"
    assert data["best"]["source"] == "internal_recipe_bank"
    assert data["candidates"]
    assert {candidate["source"] for candidate in data["candidates"]} == {"internal_recipe_bank"}


def test_dinner_tonight_candidates_selected_filters_narrow_response_and_counts(client, monkeypatch):
    monkeypatch.setattr(settings, "external_recipe_provider", "spoonacular")
    monkeypatch.setattr(settings, "spoonacular_api_key", "test-key")
    monkeypatch.setattr(
        service,
        "_fetch_spoonacular_candidates",
        lambda _ingredients, _limit: [
            {
                "id": 20,
                "title": "Chicken Rice Bowl",
                "usedIngredients": [{"name": "chicken"}, {"name": "rice"}],
                "missedIngredients": [],
                "instructions": ["Cook it."],
            },
            {
                "id": 21,
                "title": "Chicken Tacos",
                "usedIngredients": [{"name": "chicken"}],
                "missedIngredients": [{"name": "tortilla"}],
                "instructions": ["Cook it."],
            },
        ],
    )

    normalize_spoonacular_candidates = service._normalize_spoonacular_candidates

    def tagged_candidates(payload):
        candidates = normalize_spoonacular_candidates(payload)
        candidates[0].cuisine_tags = ["cuban"]
        candidates[0].sauce_tags = ["chimichurri"]
        candidates[1].cuisine_tags = ["mexican"]
        candidates[1].sauce_tags = ["salsa"]
        return candidates

    monkeypatch.setattr(service, "_normalize_spoonacular_candidates", tagged_candidates)

    response = client.post(
        "/dinner-tonight/candidates",
        json={
            "ingredients": ["chicken", "rice"],
            "limit": 10,
            "selected_filters": {"cuisine_tags": ["cuban"], "sauce_tags": ["chimichurri"]},
            "filter_mode": "cookable_tonight",
        },
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["best"]["source_id"] == "20"
    assert [candidate["source_id"] for candidate in data["candidates"]] == ["20"]
    assert data["filter_counts"]["selected_filters"] == {
        "cuisine_tags": ["cuban"],
        "sauce_tags": ["chimichurri"],
    }
    assert data["filter_counts"]["families"]["cuisine_tags"] == [{"value": "cuban", "count": 1}]


def test_dinner_tonight_candidates_zero_selected_filter_matches_are_controlled(client, monkeypatch):
    monkeypatch.setattr(settings, "external_recipe_provider", "spoonacular")
    monkeypatch.setattr(settings, "spoonacular_api_key", "test-key")
    monkeypatch.setattr(
        service,
        "_fetch_spoonacular_candidates",
        lambda _ingredients, _limit: [
            {
                "id": 30,
                "title": "Chicken Rice Bowl",
                "usedIngredients": [{"name": "chicken"}, {"name": "rice"}],
                "missedIngredients": [],
                "instructions": ["Cook it."],
            },
        ],
    )

    response = client.post(
        "/dinner-tonight/candidates",
        json={
            "ingredients": ["chicken", "rice"],
            "limit": 10,
            "selected_filters": {"cuisine_tags": ["thai"]},
        },
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["best"] is None
    assert data["alternatives"] == []
    assert data["candidates"] == []
    assert data["filter_counts"]["families"]["cuisine_tags"] == []


def test_dinner_tonight_candidates_rejects_invalid_filter_mode(client):
    response = client.post(
        "/dinner-tonight/candidates",
        json={
            "ingredients": ["chicken"],
            "filter_mode": "cookableish",
        },
    )

    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"


def test_dinner_tonight_candidate_inspection_uses_existing_candidate_without_provider_call(client, monkeypatch):
    def fail_fetch(_ingredients, _limit):
        raise AssertionError("provider should not be called")

    monkeypatch.setattr(service, "_fetch_spoonacular_candidates", fail_fetch)

    response = client.post(
        "/dinner-tonight/candidate-inspection",
        json={
            "candidate": {
                "source": "spoonacular",
                "source_id": "303",
                "source_url": "https://example.test/garlic-chicken",
                "title": "Garlic Chicken",
                "ingredients": ["bulbs garlic", "chicken weighing 2.3kg", "soy sauce"],
                "used_ingredients": ["bulbs garlic", "chicken weighing 2.3kg"],
                "missed_ingredients": ["soy sauce"],
                "unused_ingredients": [],
                "instructions": ["Cook it."],
                "minor_missing_ingredients": ["soy sauce"],
                "score": 88,
                "feasibility_bucket": "almost_there",
            }
        },
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["display_title"] == "Garlic Chicken"
    assert data["source"] == "spoonacular"
    assert data["source_id"] == "303"
    assert data["inspection_status"] == "inspectable"
    assert data["import_readiness"] == "needs_review"
    assert data["ingredients"] == [
        {"raw": "bulbs garlic", "display": "Garlic", "group": "used", "missing_severity": None},
        {
            "raw": "chicken weighing 2.3kg",
            "display": "Chicken",
            "group": "used",
            "missing_severity": None,
        },
        {"raw": "soy sauce", "display": "Soy sauce", "group": "missed", "missing_severity": "minor"},
    ]
