from __future__ import annotations

import pytest


pytestmark = pytest.mark.parked


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        (
            "/ai/recipe/optimize",
            {
                "raw_prompt": "Need a quick spicy chicken skillet dinner without peanuts",
                "constraints": {
                    "time_band": "quick",
                    "budget_band": "stretch",
                    "household_band": "3_4",
                },
                "pantry_ids": [1, 2, 3],
            },
        ),
        (
            "/supply/plan",
            {
                "pantry_items": ["rice", "onion"],
                "household_band": "3_4",
                "days_target": 7,
                "budget_sensitivity": "normal",
            },
        ),
        (
            "/ai/recipe/generate",
            {
                "raw_prompt": "Quick skillet dinner with chicken",
                "pantry_items": ["chicken", "onion", "rice", "salt", "oil"],
                "time_band": "quick",
                "budget_band": "normal",
                "household_band": "3_4",
                "allow_missing": 2,
            },
        ),
    ],
)
def test_ai_and_supply_routes_remain_parked(client, path: str, payload: dict) -> None:
    response = client.post(path, json=payload)
    assert response.status_code == 404
