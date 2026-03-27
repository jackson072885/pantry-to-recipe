from __future__ import annotations


def _unwrap(response):
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    return body["data"]


def test_plan_sequence_response_shape(client):
    payload = {
        "days": 3,
        "household_band": "3_4",
        "time_band": "standard",
        "budget_band": "normal",
        "pantry_items": ["chicken", "rice", "onion", "egg", "pasta"],
        "allow_missing_max": 2,
    }
    response = client.post("/plan/sequence", json=payload)
    assert response.status_code == 200
    data = _unwrap(response)
    assert "plan" in data
    assert "plan_summary" in data
    assert "deterministic_seed" in data
    assert isinstance(data["deterministic_seed"], str)
    assert len(data["deterministic_seed"]) == 16


def test_plan_sequence_deterministic_for_same_payload(client):
    payload = {
        "days": 5,
        "household_band": "3_4",
        "time_band": "quick",
        "budget_band": "stretch",
        "pantry_items": ["egg", "bread", "cheddar", "butter", "rice", "beans"],
        "allow_missing_max": 1,
    }
    first = client.post("/plan/sequence", json=payload)
    second = client.post("/plan/sequence", json=payload)
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()


def test_plan_sequence_reasons_present(client):
    payload = {
        "days": 3,
        "pantry_items": ["egg", "bread", "milk", "butter", "cheddar", "rice"],
        "allow_missing_max": 2,
    }
    response = client.post("/plan/sequence", json=payload)
    assert response.status_code == 200
    data = _unwrap(response)
    for day in data["plan"]:
        assert "reasons" in day
        assert len(day["reasons"]) >= 2


def test_plan_sequence_respects_allow_missing_max(client):
    payload = {
        "days": 7,
        "time_band": "standard",
        "budget_band": "normal",
        "pantry_items": ["egg", "salt", "pepper"],
        "allow_missing_max": 0,
    }
    response = client.post("/plan/sequence", json=payload)
    assert response.status_code == 200
    data = _unwrap(response)
    for day in data["plan"]:
        assert day["missing_required_count"] <= payload["allow_missing_max"]
