from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from app.schemas.import_review import ImportReviewCandidate
from app.services.import_review_service import create_import_review_record


def _candidate(**overrides) -> ImportReviewCandidate:
    data = {
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
    data.update(overrides)
    return ImportReviewCandidate(**data)


def _recipe_bank_hash() -> str:
    recipe_bank = Path(__file__).resolve().parents[1] / "data" / "recipes_real_v1.json"
    return hashlib.sha256(recipe_bank.read_bytes()).hexdigest()


def test_valid_candidate_creates_pending_review_record_with_preserved_provenance():
    record = create_import_review_record(_candidate())

    assert record.review_id.startswith("ir_")
    assert record.status == "pending_review"
    assert record.source == "spoonacular"
    assert record.source_id == "303"
    assert record.source_url == "https://example.test/garlic-chicken"
    assert record.provider == "spoonacular"
    assert record.display_title == "Garlic Chicken"
    assert record.display_image_url == "https://example.test/garlic.jpg"
    assert record.display_ready_minutes == 35
    assert record.display_servings == 4
    assert record.display_ingredients == ["Garlic", "Chicken", "Soy sauce"]
    assert record.display_instructions[0].startswith("Season the chicken")
    assert record.candidate_provenance["source_id"] == "303"
    assert record.readiness_bucket == "almost_there"
    assert record.readiness_score == 88
    assert record.used_ingredients == ["garlic", "chicken"]
    assert record.missed_ingredients == ["soy sauce"]
    assert record.safety_flags == []
    assert record.created_at == record.updated_at


def test_missing_title_is_rejected_and_flagged():
    record = create_import_review_record(_candidate(display_title=" "))

    assert record.status == "rejected"
    assert "missing_title" in record.safety_flags
    assert "needs_human_review" in record.safety_flags


def test_missing_ingredients_is_flagged_as_needs_edit():
    record = create_import_review_record(_candidate(display_ingredients=[]))

    assert record.status == "needs_edit"
    assert "missing_ingredients" in record.safety_flags
    assert "needs_human_review" in record.safety_flags


def test_missing_instructions_is_flagged_as_needs_edit():
    record = create_import_review_record(_candidate(display_instructions=[]))

    assert record.status == "needs_edit"
    assert "missing_instructions" in record.safety_flags
    assert "needs_human_review" in record.safety_flags


def test_missing_provenance_or_source_identity_is_rejected_and_flagged():
    record = create_import_review_record(
        _candidate(
            source="",
            source_id="",
            source_url=None,
            provider="",
            candidate_provenance={},
        )
    )

    assert record.status == "rejected"
    assert "missing_provenance" in record.safety_flags
    assert "source_identity_missing" in record.safety_flags
    assert "needs_human_review" in record.safety_flags


def test_vague_instructions_are_flagged_as_needs_edit():
    record = create_import_review_record(_candidate(display_instructions=["Cook it."]))

    assert record.status == "needs_edit"
    assert "vague_instructions" in record.safety_flags
    assert "needs_human_review" in record.safety_flags


def test_candidate_without_meaningful_review_content_is_rejected():
    with pytest.raises(ValueError, match="needs title, ingredient, or instruction content"):
        create_import_review_record(
            ImportReviewCandidate(
                source="spoonacular",
                source_id="404",
                candidate_provenance={"source": "spoonacular", "source_id": "404"},
            )
        )


def test_service_does_not_mutate_verified_recipe_bank_file():
    before = _recipe_bank_hash()

    create_import_review_record(_candidate())

    assert _recipe_bank_hash() == before
