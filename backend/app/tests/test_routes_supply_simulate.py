from __future__ import annotations


def _unwrap(response):
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    return body["data"]


def test_supply_simulate_deterministic(client):
    payload = {
        "pantry": ["rice", "onion"],
        "days": 5,
        "goal": "balanced",
        "locked_items": [],
        "excluded_items": [],
    }
    first = client.post("/supply/simulate", json=payload)
    second = client.post("/supply/simulate", json=payload)
    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json() == second.json()


def test_supply_simulate_exclusions_respected(client):
    payload = {
        "pantry": ["rice"],
        "days": 3,
        "goal": "stretch",
        "excluded_items": ["eggs", "chicken"],
    }
    response = client.post("/supply/simulate", json=payload)
    assert response.status_code == 200
    data = _unwrap(response)

    banned = {"eggs", "chicken"}
    baseline_items = {row["ingredient"] for row in data["baseline_plan"]["recommendations"]}
    assert baseline_items.isdisjoint(banned)

    for alt in data["alternatives"]:
        alt_items = {row["ingredient"] for row in alt["plan"]["recommendations"]}
        assert alt_items.isdisjoint(banned)


def test_supply_simulate_alternatives_bounds_and_explanations(client):
    payload = {
        "pantry": ["salt", "pepper"],
        "days": 7,
        "budget": 10,
        "goal": "protein",
        "locked_items": ["eggs"],
        "excluded_items": ["onion"],
    }
    response = client.post("/supply/simulate", json=payload)
    assert response.status_code == 200
    data = _unwrap(response)

    alternatives = data["alternatives"]
    assert len(alternatives) <= 4
    assert len(alternatives) == 0 or len(alternatives) >= 2

    baseline_explanation = data["baseline_explanation"]
    assert "summary" in baseline_explanation
    assert isinstance(baseline_explanation["item_reasons"], list)
    for row in baseline_explanation["item_reasons"]:
        assert "item" in row
        assert "reason" in row
        assert "unlocks" in row
        assert "estimated_meals_unlocked" in row

    for alt in alternatives:
        assert "deltas" in alt
        assert "explanation" in alt
        assert "summary" in alt["explanation"]
        for row in alt["explanation"]["item_reasons"]:
            assert "item" in row
            assert "reason" in row
            assert "unlocks" in row
            assert "estimated_meals_unlocked" in row
