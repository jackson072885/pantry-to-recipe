from __future__ import annotations

import pytest


pytestmark = pytest.mark.parked


@pytest.mark.parametrize(
    ("method", "path", "payload"),
    [
        (
            "post",
            "/insights/provider-summary",
            {
                "provider_id": "provider-a",
                "window_days": 14,
                "focus_ingredients": ["eggs", "milk"],
                "adjustments": {"demand_pressure": 0.2, "supply_pressure": 0.1},
            },
        ),
        (
            "post",
            "/insights/damage",
            {
                "baseline_score": 20,
                "shocks": [
                    {"domain": "supply", "severity": 0.7, "duration_days": 10},
                    {"domain": "logistics", "severity": 0.4, "duration_days": 4},
                ],
            },
        ),
        (
            "post",
            "/insights/forecast/micro",
            {
                "horizon_days": 7,
                "demand_shift": 0.1,
                "supply_shift": -0.1,
                "volatility": 0.2,
                "focus_ingredients": ["rice"],
            },
        ),
        (
            "post",
            "/plan/scarcity/simulate",
            {
                "ingredients": ["eggs", "dragonfruit"],
                "scarcity_level": 0.6,
                "budget_tightness": 0.5,
            },
        ),
        ("get", "/plan/archetypes", None),
        (
            "post",
            "/unlock/minimal",
            {
                "goal": "provider-intelligence",
                "pantry_items_target": 2,
                "event_target": 1,
                "closed_session_target": 1,
            },
        ),
        (
            "post",
            "/insights/telemetry/event",
            {
                "session_id": "session-phase2a-1",
                "event_name": "provider_summary_viewed",
                "properties": {"source": "test"},
            },
        ),
        (
            "post",
            "/insights/telemetry/session/close",
            {
                "session_id": "session-phase2a-1",
                "duration_seconds": 120,
                "outcome": "completed",
            },
        ),
    ],
)
def test_provider_phase2a_routes_remain_parked(client, method: str, path: str, payload: dict | None) -> None:
    if payload is None:
        response = getattr(client, method)(path)
    else:
        response = getattr(client, method)(path, json=payload)
    assert response.status_code == 404
