from __future__ import annotations


def test_provider_summary_endpoint(client):
    client.post("/pantry/add", json={"name": "eggs", "amount": 2})
    response = client.post(
        "/insights/provider-summary",
        json={
            "provider_id": "provider-a",
            "window_days": 14,
            "focus_ingredients": ["eggs", "milk"],
            "adjustments": {"demand_pressure": 0.2, "supply_pressure": 0.1},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["provider_id"] == "provider-a"
    assert "health_score" in data
    assert "scarcity_risk" in data
    assert "highlights" in data


def test_damage_endpoint(client):
    response = client.post(
        "/insights/damage",
        json={
            "baseline_score": 20,
            "shocks": [
                {"domain": "supply", "severity": 0.7, "duration_days": 10},
                {"domain": "logistics", "severity": 0.4, "duration_days": 4},
            ],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["severity_band"] in {"low", "moderate", "high", "critical"}
    assert isinstance(data["affected_domains"], list)


def test_micro_forecast_endpoint(client):
    client.post("/pantry/add", json={"name": "rice", "amount": 2})
    response = client.post(
        "/insights/forecast/micro",
        json={
            "horizon_days": 7,
            "demand_shift": 0.1,
            "supply_shift": -0.1,
            "volatility": 0.2,
            "focus_ingredients": ["rice"],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["trend"] in {"up", "flat", "down"}
    assert "cookable_projection" in data
    assert "almost_projection" in data


def test_scarcity_simulation_endpoint(client):
    response = client.post(
        "/plan/scarcity/simulate",
        json={
            "ingredients": ["eggs", "dragonfruit"],
            "scarcity_level": 0.6,
            "budget_tightness": 0.5,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["recommended_archetype"] in {
        "agile-buffer",
        "swap-and-stretch",
        "austerity-core",
    }
    assert "substitutions" in data


def test_archetypes_endpoint(client):
    response = client.get("/plan/archetypes")
    assert response.status_code == 200
    data = response.json()
    assert "archetypes" in data
    assert len(data["archetypes"]) >= 3


def test_unlock_minimal_endpoint(client):
    response = client.post(
        "/unlock/minimal",
        json={
            "goal": "provider-intelligence",
            "pantry_items_target": 2,
            "event_target": 1,
            "closed_session_target": 1,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "unlocked" in data
    assert "progress" in data
    assert "reasons" in data


def test_telemetry_event_and_session_close(client):
    event_response = client.post(
        "/insights/telemetry/event",
        json={
            "session_id": "session-phase2a-1",
            "event_name": "provider_summary_viewed",
            "properties": {"source": "test"},
        },
    )
    assert event_response.status_code == 200
    event_data = event_response.json()
    assert event_data["accepted"] is True
    assert event_data["event_count"] >= 1

    close_response = client.post(
        "/insights/telemetry/session/close",
        json={
            "session_id": "session-phase2a-1",
            "duration_seconds": 120,
            "outcome": "completed",
        },
    )
    assert close_response.status_code == 200
    close_data = close_response.json()
    assert close_data["closed"] is True
    assert close_data["event_count"] >= 1
    assert close_data["duration_seconds"] >= 120
