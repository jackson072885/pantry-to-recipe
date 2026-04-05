from __future__ import annotations

import pytest


pytestmark = pytest.mark.parked


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/match", {"pantry_items": ["chicken", "rice"]}),
        ("/match/v2", {"ingredients": ["chicken", "rice"]}),
    ],
)
def test_match_routes_remain_parked(client, path: str, payload: dict[str, list[str]]) -> None:
    response = client.post(path, json=payload)
    assert response.status_code == 404
