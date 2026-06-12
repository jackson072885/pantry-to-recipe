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
    if "source_id" in overrides and "source_url" not in overrides:
        candidate["source_url"] = f"https://example.test/{candidate['source_id'] or 'missing-source'}"
    if "candidate_provenance" not in overrides:
        candidate["candidate_provenance"] = {
            "source": candidate["source"],
            "source_id": candidate["source_id"],
            "source_url": candidate["source_url"],
        }
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
    response = client.post(
        "/api/dinner-tonight/import-review",
        json=_payload(source_id="api-prefix-303"),
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["status"] == "pending_review"


def test_import_review_endpoint_flags_missing_title_without_verified_status(client):
    response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="missing-title-303", display_title=" "),
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["status"] == "rejected"
    assert "missing_title" in data["safety_flags"]
    assert data["status"] != "approved"


def test_import_review_endpoint_flags_missing_ingredients(client):
    response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="missing-ingredients-303", display_ingredients=[]),
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["status"] == "needs_edit"
    assert "missing_ingredients" in data["safety_flags"]


def test_import_review_endpoint_flags_missing_instructions(client):
    response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="missing-instructions-303", display_instructions=[]),
    )

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
        json=_payload(source_id="vague-instructions-303", display_instructions=["Cook it."]),
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


def test_import_review_endpoint_created_record_can_be_read_listed_and_updated(client):
    create_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="route-read-list-update"),
    )
    assert create_response.status_code == 200
    created = _unwrap(create_response)

    read_response = client.get(f"/dinner-tonight/import-review/{created['review_id']}")
    assert read_response.status_code == 200
    read_back = _unwrap(read_response)
    assert read_back["review_id"] == created["review_id"]
    assert read_back["status"] == "pending_review"

    list_response = client.get("/dinner-tonight/import-review")
    assert list_response.status_code == 200
    listed = _unwrap(list_response)
    assert any(item["review_id"] == created["review_id"] for item in listed)

    update_response = client.patch(
        f"/dinner-tonight/import-review/{created['review_id']}",
        json={"status": "needs_edit", "reviewer_notes": "Needs clearer steps."},
    )
    assert update_response.status_code == 200
    updated = _unwrap(update_response)
    assert updated["status"] == "needs_edit"
    assert updated["reviewer_notes"] == "Needs clearer steps."
    assert updated["candidate_provenance"] == created["candidate_provenance"]


def test_import_review_endpoint_can_reject_and_approve_status_only(client):
    reject_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="route-reject"),
    )
    rejected_review = _unwrap(reject_response)

    update_response = client.patch(
        f"/dinner-tonight/import-review/{rejected_review['review_id']}",
        json={"status": "rejected"},
    )
    assert update_response.status_code == 200
    rejected = _unwrap(update_response)
    assert rejected["status"] == "rejected"
    assert rejected["source_id"] == "route-reject"

    approve_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="route-approve"),
    )
    approved_review = _unwrap(approve_response)

    update_response = client.patch(
        f"/dinner-tonight/import-review/{approved_review['review_id']}",
        json={"status": "approved"},
    )
    assert update_response.status_code == 200
    approved = _unwrap(update_response)
    assert approved["status"] == "approved"
    assert approved["safety_flags"] == []


def test_import_review_endpoint_blocks_approval_with_fatal_safety_flags(client):
    create_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(
            source_id="",
            source_url=None,
            display_title="Missing Identity Chicken",
        ),
    )
    created = _unwrap(create_response)
    assert created["status"] == "rejected"
    assert "source_identity_missing" in created["safety_flags"]

    update_response = client.patch(
        f"/dinner-tonight/import-review/{created['review_id']}",
        json={"status": "approved"},
    )

    assert update_response.status_code == 400
    body = update_response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "BAD_REQUEST"
    assert "fatal safety flags" in body["error"]["message"]


def test_import_review_endpoint_rejects_unknown_status(client):
    create_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="route-unknown-status"),
    )
    created = _unwrap(create_response)

    update_response = client.patch(
        f"/dinner-tonight/import-review/{created['review_id']}",
        json={"status": "verified_recipe"},
    )

    assert update_response.status_code == 422
    body = update_response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"


def test_import_review_import_endpoint_requires_approved_review(client):
    create_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="route-import-pending"),
    )
    created = _unwrap(create_response)

    import_response = client.post(f"/dinner-tonight/import-review/{created['review_id']}/import")

    assert import_response.status_code == 400
    body = import_response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "BAD_REQUEST"
    assert "Only approved" in body["error"]["message"]


def test_import_review_import_endpoint_imports_approved_review_without_recipe_bank_mutation(client):
    before_hash = _recipe_bank_hash()
    before_count = _recipe_count()
    create_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="route-import-approved"),
    )
    created = _unwrap(create_response)
    approve_response = client.patch(
        f"/dinner-tonight/import-review/{created['review_id']}",
        json={"status": "approved"},
    )
    approved = _unwrap(approve_response)

    import_response = client.post(f"/dinner-tonight/import-review/{approved['review_id']}/import")

    assert import_response.status_code == 200
    imported = _unwrap(import_response)
    assert imported["import_id"].startswith("imp_")
    assert imported["review_id"] == approved["review_id"]
    assert imported["source"] == "spoonacular"
    assert imported["source_id"] == "route-import-approved"
    assert imported["provider"] == "spoonacular"
    assert imported["title"] == "Garlic Chicken"
    assert imported["origin"] == "external_import"
    assert imported["verification_status"] == "imported_reviewed"
    assert imported["imported_from_external"] is True
    assert imported["provenance"]["review_id"] == approved["review_id"]
    assert imported["provenance"]["original_source_id"] == "route-import-approved"
    assert _recipe_bank_hash() == before_hash
    assert _recipe_count() == before_count


def test_imported_recipes_endpoint_lists_and_reads_reviewed_imports(client):
    create_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="route-import-surfacing"),
    )
    created = _unwrap(create_response)
    approve_response = client.patch(
        f"/dinner-tonight/import-review/{created['review_id']}",
        json={"status": "approved"},
    )
    approved = _unwrap(approve_response)
    import_response = client.post(f"/dinner-tonight/import-review/{approved['review_id']}/import")
    imported = _unwrap(import_response)

    list_response = client.get("/dinner-tonight/imported-recipes")
    assert list_response.status_code == 200
    listed = _unwrap(list_response)
    assert any(item["import_id"] == imported["import_id"] for item in listed)

    read_response = client.get(f"/dinner-tonight/imported-recipes/{imported['import_id']}")
    assert read_response.status_code == 200
    read_back = _unwrap(read_response)
    assert read_back["import_id"] == imported["import_id"]
    assert read_back["review_id"] == approved["review_id"]
    assert read_back["origin"] == "external_import"
    assert read_back["verification_status"] == "imported_reviewed"
    assert read_back["imported_from_external"] is True
    assert read_back["provenance"]["original_source_id"] == "route-import-surfacing"


def test_imported_recipes_cleanup_endpoint_updates_reviewed_fields_only(client):
    before_hash = _recipe_bank_hash()
    before_count = _recipe_count()
    create_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="route-import-cleanup"),
    )
    created = _unwrap(create_response)
    approve_response = client.patch(
        f"/dinner-tonight/import-review/{created['review_id']}",
        json={"status": "approved"},
    )
    approved = _unwrap(approve_response)
    import_response = client.post(f"/dinner-tonight/import-review/{approved['review_id']}/import")
    imported = _unwrap(import_response)

    cleanup_response = client.patch(
        f"/dinner-tonight/imported-recipes/{imported['import_id']}",
        json={
            "title": "Cleaned Garlic Chicken",
            "ingredients": ["Chicken thighs", "Garlic", "Soy sauce"],
            "instructions": ["Season chicken.", "Sear until done."],
        },
    )

    assert cleanup_response.status_code == 200
    cleaned = _unwrap(cleanup_response)
    assert cleaned["import_id"] == imported["import_id"]
    assert cleaned["title"] == "Cleaned Garlic Chicken"
    assert cleaned["ingredients"] == ["Chicken thighs", "Garlic", "Soy sauce"]
    assert cleaned["instructions"] == ["Season chicken.", "Sear until done."]
    assert cleaned["source"] == imported["source"]
    assert cleaned["source_id"] == imported["source_id"]
    assert cleaned["source_url"] == imported["source_url"]
    assert cleaned["provider"] == imported["provider"]
    assert cleaned["provenance"] == imported["provenance"]
    assert cleaned["origin"] == "external_import"
    assert cleaned["verification_status"] == "imported_reviewed"
    assert cleaned["imported_from_external"] is True
    assert cleaned["imported_at"] == imported["imported_at"]
    assert _recipe_bank_hash() == before_hash
    assert _recipe_count() == before_count


def test_imported_recipes_cleanup_endpoint_rejects_unknown_import_id(client):
    response = client.patch(
        "/dinner-tonight/imported-recipes/imp_missing_cleanup",
        json={"title": "Missing cleanup"},
    )

    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "NOT_FOUND"


def test_imported_recipes_cleanup_endpoint_rejects_empty_or_forbidden_payloads(client):
    create_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="route-import-invalid-cleanup"),
    )
    created = _unwrap(create_response)
    approve_response = client.patch(
        f"/dinner-tonight/import-review/{created['review_id']}",
        json={"status": "approved"},
    )
    approved = _unwrap(approve_response)
    import_response = client.post(f"/dinner-tonight/import-review/{approved['review_id']}/import")
    imported = _unwrap(import_response)

    empty_response = client.patch(
        f"/dinner-tonight/imported-recipes/{imported['import_id']}",
        json={},
    )
    assert empty_response.status_code == 400
    assert empty_response.json()["error"]["code"] == "BAD_REQUEST"

    blank_response = client.patch(
        f"/dinner-tonight/imported-recipes/{imported['import_id']}",
        json={"title": " "},
    )
    assert blank_response.status_code == 400
    assert blank_response.json()["error"]["code"] == "BAD_REQUEST"

    forbidden_response = client.patch(
        f"/dinner-tonight/imported-recipes/{imported['import_id']}",
        json={"verification_status": "verified_recipe"},
    )
    assert forbidden_response.status_code == 422
    assert forbidden_response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_imported_recipes_cleanup_endpoint_is_available_under_api_prefix(client):
    create_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="route-import-cleanup-api-prefix"),
    )
    created = _unwrap(create_response)
    approve_response = client.patch(
        f"/dinner-tonight/import-review/{created['review_id']}",
        json={"status": "approved"},
    )
    approved = _unwrap(approve_response)
    import_response = client.post(f"/dinner-tonight/import-review/{approved['review_id']}/import")
    imported = _unwrap(import_response)

    response = client.patch(
        f"/api/dinner-tonight/imported-recipes/{imported['import_id']}",
        json={"title": "API Prefix Cleanup Chicken"},
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["title"] == "API Prefix Cleanup Chicken"
    assert data["origin"] == "external_import"
    assert data["verification_status"] == "imported_reviewed"


def test_imported_recipes_promotion_audit_endpoint_persists_without_promoting(client):
    before_hash = _recipe_bank_hash()
    before_count = _recipe_count()
    create_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="route-promotion-audit"),
    )
    created = _unwrap(create_response)
    approve_response = client.patch(
        f"/dinner-tonight/import-review/{created['review_id']}",
        json={"status": "approved"},
    )
    approved = _unwrap(approve_response)
    import_response = client.post(f"/dinner-tonight/import-review/{approved['review_id']}/import")
    imported = _unwrap(import_response)

    read_response = client.get(f"/dinner-tonight/imported-recipes/{imported['import_id']}/promotion-audit")
    assert read_response.status_code == 200
    initial_audit = _unwrap(read_response)
    assert initial_audit["audit_id"].startswith("ipa_")
    assert initial_audit["promotion_readiness"] == "not_ready"

    update_response = client.patch(
        f"/dinner-tonight/imported-recipes/{imported['import_id']}/promotion-audit",
        json={
            "provenance_status": "passed",
            "cleanup_status": "passed",
            "safety_status": "passed",
            "feasibility_status": "needs_work",
            "quality_status": "not_started",
            "duplicate_status": "blocked",
            "reviewer_notes": "Duplicate check is unresolved.",
        },
    )

    assert update_response.status_code == 200
    audit = _unwrap(update_response)
    assert audit["audit_id"] == initial_audit["audit_id"]
    assert audit["duplicate_status"] == "blocked"
    assert audit["reviewer_notes"] == "Duplicate check is unresolved."
    assert audit["promotion_readiness"] == "blocked"
    assert audit["origin"] == "external_import"
    assert audit["verification_status"] == "imported_reviewed"
    assert audit["imported_from_external"] is True
    assert _recipe_bank_hash() == before_hash
    assert _recipe_count() == before_count


def test_imported_recipes_promotion_audit_endpoint_is_available_under_api_prefix(client):
    create_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="route-promotion-audit-api-prefix"),
    )
    created = _unwrap(create_response)
    approve_response = client.patch(
        f"/dinner-tonight/import-review/{created['review_id']}",
        json={"status": "approved"},
    )
    approved = _unwrap(approve_response)
    import_response = client.post(f"/dinner-tonight/import-review/{approved['review_id']}/import")
    imported = _unwrap(import_response)

    response = client.patch(
        f"/api/dinner-tonight/imported-recipes/{imported['import_id']}/promotion-audit",
        json={
            "provenance_status": "passed",
            "cleanup_status": "passed",
            "safety_status": "passed",
            "feasibility_status": "passed",
            "quality_status": "passed",
            "duplicate_status": "passed",
        },
    )

    assert response.status_code == 200
    data = _unwrap(response)
    assert data["promotion_readiness"] == "ready_for_review"
    assert data["verification_status"] == "imported_reviewed"


def test_imported_recipes_promotion_audit_endpoint_rejects_unknown_empty_or_forbidden_payloads(client):
    missing_response = client.get("/dinner-tonight/imported-recipes/imp_missing_audit/promotion-audit")
    assert missing_response.status_code == 404

    create_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="route-promotion-audit-invalid"),
    )
    created = _unwrap(create_response)
    approve_response = client.patch(
        f"/dinner-tonight/import-review/{created['review_id']}",
        json={"status": "approved"},
    )
    approved = _unwrap(approve_response)
    import_response = client.post(f"/dinner-tonight/import-review/{approved['review_id']}/import")
    imported = _unwrap(import_response)

    empty_response = client.patch(
        f"/dinner-tonight/imported-recipes/{imported['import_id']}/promotion-audit",
        json={},
    )
    assert empty_response.status_code == 400
    assert empty_response.json()["error"]["code"] == "BAD_REQUEST"

    forbidden_response = client.patch(
        f"/dinner-tonight/imported-recipes/{imported['import_id']}/promotion-audit",
        json={"verification_status": "verified_recipe"},
    )
    assert forbidden_response.status_code == 422
    assert forbidden_response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_imported_recipes_endpoint_is_available_under_api_prefix(client):
    response = client.get("/api/dinner-tonight/imported-recipes")

    assert response.status_code == 200
    data = _unwrap(response)
    assert isinstance(data, list)


def test_import_review_import_endpoint_blocks_duplicate_import(client):
    create_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="route-import-duplicate"),
    )
    created = _unwrap(create_response)
    approve_response = client.patch(
        f"/dinner-tonight/import-review/{created['review_id']}",
        json={"status": "approved"},
    )
    approved = _unwrap(approve_response)

    first_import_response = client.post(f"/dinner-tonight/import-review/{approved['review_id']}/import")
    assert first_import_response.status_code == 200

    duplicate_response = client.post(f"/dinner-tonight/import-review/{approved['review_id']}/import")

    assert duplicate_response.status_code == 409
    body = duplicate_response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "CONFLICT"
    assert "already imported" in body["error"]["message"]


def test_import_review_import_endpoint_does_not_import_needs_edit_or_rejected(client):
    needs_edit_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="route-import-needs-edit", display_instructions=["Cook it."]),
    )
    needs_edit = _unwrap(needs_edit_response)
    rejected_response = client.post(
        "/dinner-tonight/import-review",
        json=_payload(source_id="", source_url=None, display_title="Rejected Import Candidate"),
    )
    rejected = _unwrap(rejected_response)

    for record in (needs_edit, rejected):
        import_response = client.post(f"/dinner-tonight/import-review/{record['review_id']}/import")
        assert import_response.status_code == 400
        body = import_response.json()
        assert body["success"] is False
        assert body["error"]["code"] == "BAD_REQUEST"
