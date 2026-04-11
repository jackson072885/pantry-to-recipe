from __future__ import annotations

import pytest


pytestmark = pytest.mark.parked


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        (
            "/onboarding/profile/preview",
            {
                "diet": "omnivore",
                "allergies": ["peanut"],
                "time_pref": "<=30",
                "skill_level": "beginner",
                "pantry_items": ["eggs", "rice", "onion"],
            },
        ),
        (
            "/onboarding/recipes/first",
            {
                "session_id": "onb-test-1",
                "pantry_items": ["chicken", "rice", "salt"],
                "constraints": {
                    "diet": "omnivore",
                    "allergies": ["peanut"],
                    "max_minutes": 30,
                },
            },
        ),
    ],
)
def test_onboarding_routes_remain_parked(client, path: str, payload: dict) -> None:
    response = client.post(path, json=payload)
    assert response.status_code == 404
