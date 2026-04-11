from __future__ import annotations

import pytest


pytestmark = pytest.mark.parked


@pytest.mark.parametrize(
    "payload",
    [
        {
            "pantry": ["rice", "onion"],
            "days": 5,
            "goal": "balanced",
            "locked_items": [],
            "excluded_items": [],
        },
        {
            "pantry": ["salt", "pepper"],
            "days": 7,
            "budget": 10,
            "goal": "protein",
            "locked_items": ["eggs"],
            "excluded_items": ["onion"],
        },
    ],
)
def test_supply_simulate_route_remains_parked(client, payload: dict) -> None:
    response = client.post("/supply/simulate", json=payload)
    assert response.status_code == 404
