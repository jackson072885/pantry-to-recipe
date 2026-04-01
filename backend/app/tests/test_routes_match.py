from __future__ import annotations


def test_match_endpoint_returns_explicit_deprecation_contract(client) -> None:
    response = client.post("/match", json={"pantry_items": ["chicken", "rice"]})
    assert response.status_code == 410

    body = response.json()
    assert body["success"] is False
    assert body["data"] == {
        "deprecated_endpoint": "/match",
        "replacement": {
            "path": "/recommendations",
            "method": "GET",
            "query_format": "pantry=item&pantry=item",
        },
    }
    assert body["error"] == {
        "code": "MATCH_ENDPOINT_DEPRECATED",
        "message": "The /match endpoints are deprecated. Use GET /recommendations?pantry=item&pantry=item for the live recommendation flow.",
    }


def test_match_v2_endpoint_returns_explicit_deprecation_contract(client) -> None:
    response = client.post("/match/v2", json={"ingredients": ["chicken", "rice"]})
    assert response.status_code == 410

    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "MATCH_ENDPOINT_DEPRECATED"
    assert body["data"]["replacement"]["path"] == "/recommendations"
