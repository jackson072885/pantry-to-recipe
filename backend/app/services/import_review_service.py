from __future__ import annotations

from datetime import UTC, datetime
import hashlib

from app.schemas.import_review import (
    ImportReviewCandidate,
    ImportReviewRecord,
    ImportReviewSafetyFlag,
    ImportReviewStatus,
)

FATAL_FLAGS: set[ImportReviewSafetyFlag] = {
    "missing_title",
    "missing_provenance",
    "source_identity_missing",
}
VAGUE_INSTRUCTION_VALUES = {
    "cook it",
    "cook it.",
    "prepare",
    "prepare it",
    "make it",
    "mix ingredients",
    "combine ingredients",
}


def create_import_review_record(candidate: ImportReviewCandidate) -> ImportReviewRecord:
    normalized = validate_import_review_candidate(candidate)
    safety_flags = build_import_review_safety_flags(normalized)
    status = _initial_status(safety_flags)
    now = datetime.now(UTC)

    return ImportReviewRecord(
        review_id=_review_id(normalized),
        status=status,
        source=normalized.source.strip(),
        source_id=normalized.source_id.strip(),
        source_url=_clean_optional_string(normalized.source_url),
        provider=(normalized.provider or normalized.source).strip(),
        display_title=_clean_optional_string(normalized.display_title),
        display_image_url=_clean_optional_string(normalized.display_image_url),
        display_ready_minutes=normalized.display_ready_minutes,
        display_servings=normalized.display_servings,
        display_ingredients=_clean_list(normalized.display_ingredients),
        display_instructions=_clean_list(normalized.display_instructions),
        candidate_provenance=dict(normalized.candidate_provenance),
        readiness_bucket=normalized.readiness_bucket,
        readiness_score=normalized.readiness_score,
        used_ingredients=_clean_list(normalized.used_ingredients),
        missed_ingredients=_clean_list(normalized.missed_ingredients),
        safety_flags=safety_flags,
        created_at=now,
        updated_at=now,
    )


def validate_import_review_candidate(candidate: ImportReviewCandidate) -> ImportReviewCandidate:
    if not _has_meaningful_review_content(candidate):
        raise ValueError("Import review candidate needs title, ingredient, or instruction content")
    return candidate


def build_import_review_safety_flags(
    candidate: ImportReviewCandidate,
) -> list[ImportReviewSafetyFlag]:
    flags: list[ImportReviewSafetyFlag] = []
    title = (candidate.display_title or "").strip()
    ingredients = _clean_list(candidate.display_ingredients)
    instructions = _clean_list(candidate.display_instructions)
    source = candidate.source.strip()
    source_id = candidate.source_id.strip()
    source_url = (candidate.source_url or "").strip()
    provider = (candidate.provider or candidate.source).strip()

    if not title:
        flags.append("missing_title")
    if not ingredients:
        flags.append("missing_ingredients")
    if not instructions:
        flags.append("missing_instructions")
    if not source or not provider or not candidate.candidate_provenance:
        flags.append("missing_provenance")
    if not source_id and not source_url:
        flags.append("source_identity_missing")
    if instructions and _instructions_are_vague(instructions):
        flags.append("vague_instructions")

    if flags:
        flags.append("needs_human_review")

    return _dedupe_flags(flags)


def _initial_status(flags: list[ImportReviewSafetyFlag]) -> ImportReviewStatus:
    if any(flag in FATAL_FLAGS for flag in flags):
        return "rejected"
    if flags:
        return "needs_edit"
    return "pending_review"


def _has_meaningful_review_content(candidate: ImportReviewCandidate) -> bool:
    return bool(
        (candidate.display_title or "").strip()
        or _clean_list(candidate.display_ingredients)
        or _clean_list(candidate.display_instructions)
    )


def _instructions_are_vague(instructions: list[str]) -> bool:
    joined = " ".join(instructions).strip()
    words = [word for word in joined.replace(".", " ").split() if word]
    if len(words) < 5:
        return True
    return any(step.strip().casefold() in VAGUE_INSTRUCTION_VALUES for step in instructions)


def _review_id(candidate: ImportReviewCandidate) -> str:
    identity = "|".join(
        [
            candidate.source.strip().casefold(),
            candidate.source_id.strip().casefold(),
            (candidate.source_url or "").strip().casefold(),
            (candidate.display_title or "").strip().casefold(),
            ",".join(_clean_list(candidate.display_ingredients)).casefold(),
            ",".join(_clean_list(candidate.display_instructions)).casefold(),
        ]
    )
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:16]
    return f"ir_{digest}"


def _clean_optional_string(value: str | None) -> str | None:
    if not isinstance(value, str):
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


def _dedupe_flags(flags: list[ImportReviewSafetyFlag]) -> list[ImportReviewSafetyFlag]:
    deduped: list[ImportReviewSafetyFlag] = []
    seen: set[str] = set()
    for flag in flags:
        if flag not in seen:
            deduped.append(flag)
            seen.add(flag)
    return deduped
