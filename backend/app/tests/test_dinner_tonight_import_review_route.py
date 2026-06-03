from __future__ import annotations

import hashlib
from pathlib import Path

from app.db import SessionLocal
from app.models.recipe import Recipe


def _unwrap(response):
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    return body["data"]


def _payload(**overrides):
    candidate = {
        "source": "spoonacular",
        "source_id": "303",
        "source_url": "https://example.test/garlic-chicken",
        "provider": "spoonacular",
        "display_title": "Garlic Chicken",
        "display_image_url": "https://example.test/garlic.jpg",
        "display_ready_minutes": 35,
        "display_servings": 4,
        "display_ingredients": ["Garlic", "Chicken", "Soy sauce"],
        "display_instructions": [
            "Season the chicken with garlic and soy sauce.",
            "Sear until cooked through and serve hot.",
        ],
        "candidate_provenance": {
            "source": "spoonacular",
            "source_id": "303",
            "source_url": "https://example.test/garlic-chicken",
        },
        "readiness_bucket": "almost_there",
        "readiness_score": 88,
        "used_ingredients": ["garlic", "chicken"],
        "missed_ingredients": ["soy sauce"],
    }
    candidate.update(overrides)
    return {"candidate": candidate}


def _recipe_bank_hash() -> str:
    recipe_bank = Path(__file__).resolve().parents[1] / "data" / "recipes_real_v1.json"
    return hashlib.sha256(recipe_bank.read_bytes()).hexdigest()


def _recipe_count() -> int:
    db = SessionLocal()
    try:
        return db.query(Recipe).count()
    finally:
        db.close()


def test_import_review_endpoint_returns_pending_review_without_importing_recipe(client):
    before_hash = _recipe_bank_hash()
    before_count = _recipe_count()

    response = client.post("/dinner-tonight/import-review", json=_payload())

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["review_id"].startswith("ir_")
    assert data["status"] == "pending_review"
    assert data["source"] == "spoonacular"
    assert data["source_id"] == "303"
    assert data["provider"] == "spoonacular"
    assert data["source_url"] == "https://example.test/garlic-chicken"
    assert data["display_title"] == "Garlic Chicken"
    assert data["display_image_url"] == "https://example.test/garlic.jpg"
    assert data["display_ready_minutes"] == 35
    assert data["display_servings"] == 4
    assert data["display_ingredients"] == ["Garlic", "Chicken", "Soy sauce"]
    assert data["display_instructions"][0].startswith("Season the chicken")
    assert data["candidate_provenance"]["source_id"] == "303"
    assert data["readiness_bucket"] == "almost_there"
    assert data["readiness_score"] == 88
    assert data["used_ingredients"] == ["garlic", "chicken"]
    assert data["missed_ingredients"] == ["soy sauce"]
    assert data["safety_flags"] == []
    assert _recipe_bank_hash() == before_hash
    assert _recipe_count() == before_count


def test_import_review_endpoint_is_available_under_api_prefix(client):
    response = client.post("/api/dinner-tonight/import-review", json=_payload())

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["status"] == "pending_review"


def test_import_review_endpoint_flags_missing_title_without_verified_status(client):
    response = client.post("/dinner-tonight/import-review", json=_payload(display_title=" "))

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["status"] == "rejected"
    assert "missing_title" in data["safety_flags"]
    assert data["status"] != "approved"


def test_import_review_endpoint_flags_missing_ingredients(client):
    response = client.post("/dinner-tonight/import-review", json=_payload(display_ingredients=[]))

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["status"] == "needs_edit"
    assert "missing_ingredients" in data["safety_flags"]


def test_import_review_endpoint_flags_missing_instructions(client):
    response = client.post("/dinner-tonight/import-review", json=_payload(display_instructions=[]))

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["status"] == "needs_edit"
    assert "missing_instructions" in data["safety_flags"]


def test_import_review_endpoint_flags_missing_provenance_and_identity(client):
    response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(
            source="",
            source_id="",
            source_url=None,
            provider="",
            candidate_provenance={},
        ),
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["status"] == "rejected"
    assert "missing_provenance" in data["safety_flags"]
    assert "source_identity_missing" in data["safety_flags"]


def test_import_review_endpoint_flags_vague_instructions(client):
    response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(display_instructions=["Cook it."]),
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["status"] == "needs_edit"
    assert "vague_instructions" in data["safety_flags"]


def test_import_review_endpoint_rejects_candidate_without_review_content(client):
    response = client.post(
        "/dinner-tonight/import-review",
        json={
            "candidate": {
                "source": "spoonacular",
                "source_id": "404",
                "candidate_provenance": {"source": "spoonacular", "source_id": "404"},
            }
        },
    )

    assert response.status_code == 400
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "BAD_REQUEST"
