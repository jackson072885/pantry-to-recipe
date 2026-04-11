from __future__ import annotations

import json

from app.db import SessionLocal
from app.models.user_action import UserAction


def _unwrap(response):
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    return body["data"]


def test_event_tracking_writes_user_action(client):
    response = client.post(
        "/events",
        json={
            "event": "recipe_selected",
            "recipe_id": 19,
            "metadata": {"source": "recipe_detail"},
        },
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["accepted"] is True
    assert isinstance(data["action_id"], int)

    db = SessionLocal()
    try:
        action = db.query(UserAction).filter(UserAction.id == data["action_id"]).one()
        assert action.event == "recipe_selected"
        assert action.recipe_id == 19
        assert json.loads(action.metadata_json or "{}") == {"source": "recipe_detail"}
    finally:
        db.close()


def test_event_tracking_validation_rejects_unknown_event(client):
    response = client.post(
        "/events",
        json={
            "event": "made_up_event",
            "metadata": {},
        },
    )

    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"


def test_event_tracking_accepts_explicit_preference_feedback(client):
    response = client.post(
        "/events",
        json={
            "event": "recipe_skipped",
            "recipe_id": 33,
            "metadata": {"source": "recipe_detail:preference_feedback"},
        },
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["accepted"] is True
    assert data["event"] == "recipe_skipped"
