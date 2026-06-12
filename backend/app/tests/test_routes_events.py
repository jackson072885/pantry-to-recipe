from __future__ import annotations

import json

from app.db import SessionLocal
from app.models.user_action import UserAction


def _unwrap(response):
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    return body["data"]


def test_events_endpoint_records_user_action(client):
    response = client.post(
        "/events",
        json={
            "event": "recipe_selected",
            "recipe_id": 19,
            "metadata": {"source": "recommendations_best_option"},
        },
    )
    assert response.status_code == 200
    data = _unwrap(response)
    assert data["event"] == "recipe_selected"
    assert data["recipe_id"] == 19
    assert data["accepted"] is True

    db = SessionLocal()
    try:
        action = db.query(UserAction).filter(UserAction.id == data["action_id"]).first()
        assert action is not None
        assert action.event == "recipe_selected"
        assert action.recipe_id == 19
        assert json.loads(action.metadata_json) == {"source": "recommendations_best_option"}
    finally:
        db.close()


def test_events_endpoint_accepts_revenue_path_events(client):
    response = client.post(
        "/events",
        json={
            "event": "cta_clicked",
            "recipe_id": 19,
            "metadata": {"source": "recommendations_best_option:cta", "destination": "outbound"},
        },
    )
    assert response.status_code == 200
    data = _unwrap(response)
    assert data["event"] == "cta_clicked"
    assert data["recipe_id"] == 19
    assert data["accepted"] is True

    db = SessionLocal()
    try:
        action = db.query(UserAction).filter(UserAction.id == data["action_id"]).first()
        assert action is not None
        assert action.event == "cta_clicked"
        assert action.recipe_id == 19
        assert json.loads(action.metadata_json) == {
            "source": "recommendations_best_option:cta",
            "destination": "outbound",
        }
    finally:
        db.close()


def test_events_endpoint_validates_event_name(client):
    response = client.post(
        "/events",
        json={
            "event": "unknown_event",
            "recipe_id": 19,
            "metadata": {},
        },
    )
    assert response.status_code == 422
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "VALIDATION_ERROR"


def test_events_endpoint_accepts_explicit_recipe_preference_events(client):
    response = client.post(
        "/events",
        json={
            "event": "recipe_liked",
            "recipe_id": 25,
            "metadata": {"source": "recipe_detail:preference_feedback"},
        },
    )
    assert response.status_code == 200
    data = _unwrap(response)
    assert data["event"] == "recipe_liked"
    assert data["recipe_id"] == 25


def test_events_endpoint_accepts_external_candidate_review_requests(client):
    response = client.post(
        "/events",
        json={
            "event": "external_candidate_review_requested",
            "recipe_id": None,
            "metadata": {
                "source": "recipe_browser:external_candidate_review",
                "candidate_source": "spoonacular",
                "candidate_source_id": "303",
                "import_readiness": "needs_review",
            },
        },
    )
    assert response.status_code == 200
    data = _unwrap(response)
    assert data["event"] == "external_candidate_review_requested"
    assert data["recipe_id"] is None

    db = SessionLocal()
    try:
        action = db.query(UserAction).filter(UserAction.id == data["action_id"]).first()
        assert action is not None
        assert action.event == "external_candidate_review_requested"
        assert action.recipe_id is None
        assert json.loads(action.metadata_json)["candidate_source_id"] == "303"
    finally:
        db.close()
