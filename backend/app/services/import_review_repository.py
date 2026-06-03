from __future__ import annotations

from datetime import UTC, datetime
import json
import hashlib
from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.api.responses import APIError, BAD_REQUEST, CONFLICT, NOT_FOUND
from app.models.import_review import ImportedRecipeRecord as ImportedRecipeModel
from app.models.import_review import ImportReviewQueueRecord
from app.schemas.import_review import (
    ImportedRecipeRecord,
    ImportReviewCandidate,
    ImportReviewRecord,
    ImportReviewSafetyFlag,
    ImportReviewStatus,
    ImportReviewUpdateRequest,
)
from app.services.import_review_service import FATAL_FLAGS, create_import_review_record


def create_review_record(db: Session, candidate: ImportReviewCandidate) -> ImportReviewRecord:
    record = create_import_review_record(candidate)
    existing = _get_model(db, record.review_id)
    if existing is not None:
        return _to_schema(existing)

    model = ImportReviewQueueRecord(
        review_id=record.review_id,
        status=record.status,
        source=record.source,
        source_id=record.source_id,
        source_url=record.source_url,
        provider=record.provider,
        display_title=record.display_title,
        display_image_url=record.display_image_url,
        display_ready_minutes=record.display_ready_minutes,
        display_servings=record.display_servings,
        display_ingredients_json=_json(record.display_ingredients),
        display_instructions_json=_json(record.display_instructions),
        candidate_provenance_json=_json(record.candidate_provenance),
        readiness_bucket=record.readiness_bucket,
        readiness_score=record.readiness_score,
        used_ingredients_json=_json(record.used_ingredients),
        missed_ingredients_json=_json(record.missed_ingredients),
        safety_flags_json=_json(record.safety_flags),
        created_at=record.created_at,
        updated_at=record.updated_at,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return _to_schema(model)


def list_review_records(db: Session) -> list[ImportReviewRecord]:
    records = (
        db.query(ImportReviewQueueRecord)
        .order_by(ImportReviewQueueRecord.created_at.desc(), ImportReviewQueueRecord.id.desc())
        .all()
    )
    return [_to_schema(record) for record in records]


def read_review_record(db: Session, review_id: str) -> ImportReviewRecord:
    model = _require_model(db, review_id)
    return _to_schema(model)


def update_review_record(
    db: Session,
    review_id: str,
    update: ImportReviewUpdateRequest,
) -> ImportReviewRecord:
    model = _require_model(db, review_id)
    safety_flags = _json_list(model.safety_flags_json)
    requested_status = update.status

    if requested_status == "approved" and any(flag in FATAL_FLAGS for flag in safety_flags):
        raise APIError(
            BAD_REQUEST,
            "Import review cannot be approved while fatal safety flags remain",
            400,
        )

    if requested_status is not None:
        model.status = requested_status
    if update.reviewer_notes is not None:
        model.reviewer_notes = _clean_optional_string(update.reviewer_notes)
    if update.edited_display_title is not None:
        model.edited_display_title = _clean_optional_string(update.edited_display_title)
    if update.edited_display_ingredients is not None:
        model.edited_display_ingredients_json = _json(_clean_list(update.edited_display_ingredients))
    if update.edited_display_instructions is not None:
        model.edited_display_instructions_json = _json(_clean_list(update.edited_display_instructions))

    model.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(model)
    return _to_schema(model)


def import_approved_review_record(db: Session, review_id: str) -> ImportedRecipeRecord:
    review = _require_model(db, review_id)
    review_schema = _to_schema(review)

    if review_schema.status != "approved":
        raise APIError(
            BAD_REQUEST,
            "Only approved import review records can be imported",
            400,
        )

    if any(flag in FATAL_FLAGS for flag in review_schema.safety_flags):
        raise APIError(
            BAD_REQUEST,
            "Import review cannot be imported while fatal safety flags remain",
            400,
        )

    existing = (
        db.query(ImportedRecipeModel)
        .filter(
            or_(
                ImportedRecipeModel.review_id == review_schema.review_id,
                *(
                    [ImportedRecipeModel.source_url == review_schema.source_url]
                    if review_schema.source_url
                    else []
                ),
                *(
                    [
                        and_(
                            ImportedRecipeModel.provider == review_schema.provider,
                            ImportedRecipeModel.source == review_schema.source,
                            ImportedRecipeModel.source_id == review_schema.source_id,
                        )
                    ]
                    if review_schema.source_id
                    else []
                ),
            )
        )
        .first()
    )
    if existing is not None:
        raise APIError(CONFLICT, "Approved review record was already imported", 409)

    now = datetime.now(UTC)
    model = ImportedRecipeModel(
        import_id=_import_id(review_schema),
        review_id=review_schema.review_id,
        source=review_schema.source,
        source_id=review_schema.source_id,
        source_url=review_schema.source_url,
        provider=review_schema.provider,
        title=review_schema.edited_display_title or review_schema.display_title or "Untitled imported recipe",
        ingredients_json=_json(review_schema.edited_display_ingredients or review_schema.display_ingredients),
        instructions_json=_json(review_schema.edited_display_instructions or review_schema.display_instructions),
        provenance_json=_json(
            {
                **review_schema.candidate_provenance,
                "review_id": review_schema.review_id,
                "original_provider": review_schema.provider,
                "original_source": review_schema.source,
                "original_source_id": review_schema.source_id,
                "original_source_url": review_schema.source_url,
                "imported_at": now.isoformat(),
                "imported_from_external": True,
            }
        ),
        origin="external_import",
        verification_status="imported_reviewed",
        imported_from_external=True,
        imported_at=now,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return _imported_to_schema(model)


def _get_model(db: Session, review_id: str) -> ImportReviewQueueRecord | None:
    return (
        db.query(ImportReviewQueueRecord)
        .filter(ImportReviewQueueRecord.review_id == review_id)
        .first()
    )


def _require_model(db: Session, review_id: str) -> ImportReviewQueueRecord:
    model = _get_model(db, review_id)
    if model is None:
        raise APIError(NOT_FOUND, "Import review record not found", 404)
    return model


def _to_schema(model: ImportReviewQueueRecord) -> ImportReviewRecord:
    return ImportReviewRecord(
        review_id=model.review_id,
        status=_status(model.status),
        source=model.source,
        source_id=model.source_id,
        source_url=model.source_url,
        provider=model.provider,
        display_title=model.display_title,
        display_image_url=model.display_image_url,
        display_ready_minutes=model.display_ready_minutes,
        display_servings=model.display_servings,
        display_ingredients=_json_list(model.display_ingredients_json),
        display_instructions=_json_list(model.display_instructions_json),
        candidate_provenance=_json_dict(model.candidate_provenance_json),
        readiness_bucket=model.readiness_bucket,
        readiness_score=model.readiness_score,
        used_ingredients=_json_list(model.used_ingredients_json),
        missed_ingredients=_json_list(model.missed_ingredients_json),
        safety_flags=_safety_flags(model.safety_flags_json),
        reviewer_notes=model.reviewer_notes,
        edited_display_title=model.edited_display_title,
        edited_display_ingredients=_json_list(model.edited_display_ingredients_json),
        edited_display_instructions=_json_list(model.edited_display_instructions_json),
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _imported_to_schema(model: ImportedRecipeModel) -> ImportedRecipeRecord:
    return ImportedRecipeRecord(
        import_id=model.import_id,
        review_id=model.review_id,
        source=model.source,
        source_id=model.source_id,
        source_url=model.source_url,
        provider=model.provider,
        title=model.title,
        ingredients=_json_list(model.ingredients_json),
        instructions=_json_list(model.instructions_json),
        provenance=_json_dict(model.provenance_json),
        origin="external_import",
        verification_status="imported_reviewed",
        imported_from_external=bool(model.imported_from_external),
        imported_at=model.imported_at,
    )


def _import_id(record: ImportReviewRecord) -> str:
    digest = hashlib.sha256(record.review_id.encode("utf-8")).hexdigest()[:16]
    return f"imp_{digest}"


def _json(value: Any) -> str:
    return json.dumps(jsonable_encoder(value), sort_keys=True)


def _json_list(value: str | None) -> list[str]:
    if not value:
        return []
    parsed = json.loads(value)
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, str)]


def _json_dict(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    parsed = json.loads(value)
    return parsed if isinstance(parsed, dict) else {}


def _safety_flags(value: str | None) -> list[ImportReviewSafetyFlag]:
    return [
        flag
        for flag in _json_list(value)
        if flag
        in {
            "missing_title",
            "missing_ingredients",
            "missing_instructions",
            "missing_provenance",
            "vague_instructions",
            "source_identity_missing",
            "needs_human_review",
        }
    ]


def _status(value: str) -> ImportReviewStatus:
    if value in {"pending_review", "needs_edit", "approved", "rejected"}:
        return value
    return "needs_edit"


def _clean_optional_string(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(value.strip().split())
    return cleaned or None


def _clean_list(values: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for value in values:
        if not isinstance(value, str):
            continue
        normalized = " ".join(value.strip().split())
        key = normalized.casefold()
        if normalized and key not in seen:
            cleaned.append(normalized)
            seen.add(key)
    return cleaned
