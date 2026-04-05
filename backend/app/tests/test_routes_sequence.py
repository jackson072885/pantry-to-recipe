from __future__ import annotations

import pytest


pytestmark = pytest.mark.parked


@pytest.mark.parametrize(
    "payload",
    [
        {
            "days": 3,
            "household_band": "3_4",
            "time_band": "standard",
            "budget_band": "normal",
            "pantry_items": ["chicken", "rice", "onion", "egg", "pasta"],
            "allow_missing_max": 2,
        },
        {
            "days": 5,
            "household_band": "3_4",
            "time_band": "quick",
            "budget_band": "stretch",
            "pantry_items": ["egg", "bread", "cheddar", "butter", "rice", "beans"],
            "allow_missing_max": 1,
        },
    ],
)
def test_plan_sequence_route_remains_parked(client, payload: dict) -> None:
    response = client.post("/plan/sequence", json=payload)
    assert response.status_code == 404
