from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from app.db import SessionLocal, ensure_schema
from app.models.import_review import ImportReviewQueueRecord
from app.models.recipe import Recipe
from app.schemas.import_review import ImportReviewCandidate, ImportReviewUpdateRequest
from app.services.import_review_repository import (
    create_review_record,
    import_approved_review_record,
    list_review_records,
    read_review_record,
    update_review_record,
)


@pytest.fixture(autouse=True, scope="module")
def _ensure_test_schema():
    ensure_schema()


def _candidate(**overrides) -> ImportReviewCandidate:
    data = {
        "source": "spoonacular",
        "source_id": "repo-303",
        "source_url": "https://example.test/repo-garlic-chicken",
        "provider": "spoonacular",
        "display_title": "Repository Garlic Chicken",
        "display_ingredients": ["Garlic", "Chicken", "Soy sauce"],
        "display_instructions": [
            "Season the chicken with garlic and soy sauce.",
            "Sear until cooked through and serve hot.",
        ],
        "candidate_provenance": {
            "source": "spoonacular",
            "source_id": "repo-303",
            "source_url": "https://example.test/repo-garlic-chicken",
        },
        "readiness_bucket": "almost_there",
        "readiness_score": 88,
        "used_ingredients": ["garlic", "chicken"],
        "missed_ingredients": ["soy sauce"],
    }
    data.update(overrides)
    if "source_id" in overrides and "source_url" not in overrides:
        data["source_url"] = f"https://example.test/{data['source_id'] or 'missing-source'}"
    if "candidate_provenance" not in overrides:
        data["candidate_provenance"] = {
            "source": data["source"],
            "source_id": data["source_id"],
            "source_url": data["source_url"],
        }
    return ImportReviewCandidate(**data)


def _recipe_bank_hash() -> str:
    recipe_bank = Path(__file__).resolve().parents[1] / "data" / "recipes_real_v1.json"
    return hashlib.sha256(recipe_bank.read_bytes()).hexdigest()


def _recipe_count(db) -> int:
    return db.query(Recipe).count()


def test_repository_create_read_list_and_status_update_are_deterministic():
    db = SessionLocal()
    try:
        record = create_review_record(db, _candidate(source_id="repo-create-read-list"))
        read_back = read_review_record(db, record.review_id)
        listed = list_review_records(db)

        assert read_back.review_id == record.review_id
        assert read_back.status == "pending_review"
        assert any(item.review_id == record.review_id for item in listed)
        assert read_back.candidate_provenance["source_id"] == "repo-create-read-list"

        updated = update_review_record(
            db,
            record.review_id,
            ImportReviewUpdateRequest(
                status="needs_edit",
                reviewer_notes="Needs clearer ingredient amounts.",
                edited_display_ingredients=["Garlic", "Chicken thighs", "Soy sauce"],
            ),
        )

        assert updated.status == "needs_edit"
        assert updated.reviewer_notes == "Needs clearer ingredient amounts."
        assert updated.edited_display_ingredients == ["Garlic", "Chicken thighs", "Soy sauce"]
        assert updated.candidate_provenance == read_back.candidate_provenance
    finally:
        db.close()


def test_repository_can_reject_without_removing_source_identity():
    db = SessionLocal()
    try:
        record = create_review_record(db, _candidate(source_id="repo-reject"))

        updated = update_review_record(
            db,
            record.review_id,
            ImportReviewUpdateRequest(status="rejected"),
        )

        assert updated.status == "rejected"
        assert updated.source == "spoonacular"
        assert updated.source_id == "repo-reject"
        assert updated.candidate_provenance["source"] == "spoonacular"
    finally:
        db.close()


def test_repository_blocks_approval_with_fatal_safety_flags():
    db = SessionLocal()
    try:
        record = create_review_record(
            db,
            _candidate(
                source_id="",
                source_url=None,
                display_title="Fatal Missing Identity Chicken",
            ),
        )

        try:
            update_review_record(db, record.review_id, ImportReviewUpdateRequest(status="approved"))
        except Exception as exc:
            assert "fatal safety flags" in str(exc)
        else:
            raise AssertionError("approval should be blocked")

        read_back = read_review_record(db, record.review_id)
        assert read_back.status == "rejected"
        assert "source_identity_missing" in read_back.safety_flags
    finally:
        db.close()


def test_repository_allows_approval_for_record_without_fatal_flags():
    db = SessionLocal()
    try:
        record = create_review_record(db, _candidate(source_id="repo-approve"))

        updated = update_review_record(db, record.review_id, ImportReviewUpdateRequest(status="approved"))

        assert updated.status == "approved"
        assert updated.safety_flags == []
    finally:
        db.close()


def test_repository_does_not_mutate_recipe_bank_or_create_verified_recipe():
    db = SessionLocal()
    try:
        before_hash = _recipe_bank_hash()
        before_count = _recipe_count(db)

        create_review_record(db, _candidate(source_id="repo-no-recipe-bank-mutation"))

        assert _recipe_bank_hash() == before_hash
        assert _recipe_count(db) == before_count
    finally:
        db.close()


def test_repository_import_requires_approved_review_status():
    db = SessionLocal()
    try:
        pending = create_review_record(db, _candidate(source_id="repo-import-pending"))
        needs_edit = create_review_record(
            db,
            _candidate(
                source_id="repo-import-needs-edit",
                display_instructions=["Cook it."],
            ),
        )
        rejected = create_review_record(
            db,
            _candidate(
                source_id="",
                source_url=None,
                display_title="Rejected Import Candidate",
            ),
        )

        for record in (pending, needs_edit, rejected):
            try:
                import_approved_review_record(db, record.review_id)
            except Exception as exc:
                assert "Only approved import review records can be imported" in str(exc)
            else:
                raise AssertionError("non-approved review should not import")
    finally:
        db.close()


def test_repository_imports_approved_review_into_separate_imported_layer():
    db = SessionLocal()
    try:
        before_hash = _recipe_bank_hash()
        before_count = _recipe_count(db)
        record = create_review_record(db, _candidate(source_id="repo-import-approved"))
        approved = update_review_record(db, record.review_id, ImportReviewUpdateRequest(status="approved"))

        imported = import_approved_review_record(db, approved.review_id)

        assert imported.import_id.startswith("imp_")
        assert imported.review_id == approved.review_id
        assert imported.title == "Repository Garlic Chicken"
        assert imported.source == "spoonacular"
        assert imported.source_id == "repo-import-approved"
        assert imported.provider == "spoonacular"
        assert imported.origin == "external_import"
        assert imported.verification_status == "imported_reviewed"
        assert imported.imported_from_external is True
        assert imported.provenance["review_id"] == approved.review_id
        assert imported.provenance["original_source_id"] == "repo-import-approved"
        assert imported.provenance["imported_from_external"] is True
        assert _recipe_bank_hash() == before_hash
        assert _recipe_count(db) == before_count
    finally:
        db.close()


def test_repository_blocks_duplicate_imports():
    db = SessionLocal()
    try:
        record = create_review_record(db, _candidate(source_id="repo-import-duplicate"))
        approved = update_review_record(db, record.review_id, ImportReviewUpdateRequest(status="approved"))
        import_approved_review_record(db, approved.review_id)

        try:
            import_approved_review_record(db, approved.review_id)
        except Exception as exc:
            assert "already imported" in str(exc)
        else:
            raise AssertionError("duplicate import should be blocked")
    finally:
        db.close()


def test_repository_blocks_import_when_fatal_flags_remain():
    db = SessionLocal()
    try:
        record = create_review_record(
            db,
            _candidate(
                source_id="",
                source_url=None,
                display_title="Fatal Import Candidate",
            ),
        )
        model = (
            db.query(ImportReviewQueueRecord)
            .filter(ImportReviewQueueRecord.review_id == record.review_id)
            .first()
        )
        assert model is not None
        model.status = "approved"
        db.commit()

        try:
            import_approved_review_record(db, record.review_id)
        except Exception as exc:
            assert "fatal safety flags" in str(exc)
        else:
            raise AssertionError("fatal approved review should not import")
    finally:
        db.close()
