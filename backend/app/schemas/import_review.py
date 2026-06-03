from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.external_recipe import FeasibilityBucket

ImportReviewStatus = Literal["pending_review", "needs_edit", "approved", "rejected"]
ImportReviewDecision = Literal["needs_edit", "approved", "rejected"]
ImportReviewSafetyFlag = Literal[
    "missing_title",
    "missing_ingredients",
    "missing_instructions",
    "missing_provenance",
    "vague_instructions",
    "source_identity_missing",
    "needs_human_review",
]


class ImportReviewCandidate(BaseModel):
    source: str = ""
    source_id: str = ""
    source_url: str | None = None
    provider: str | None = None
    display_title: str | None = None
    display_image_url: str | None = None
    display_ready_minutes: int | None = None
    display_servings: int | None = None
    display_ingredients: list[str] = Field(default_factory=list)
    display_instructions: list[str] = Field(default_factory=list)
    candidate_provenance: dict[str, Any] = Field(default_factory=dict)
    readiness_bucket: FeasibilityBucket | None = None
    readiness_score: float | None = None
    used_ingredients: list[str] = Field(default_factory=list)
    missed_ingredients: list[str] = Field(default_factory=list)


class ImportReviewCreateRequest(BaseModel):
    candidate: ImportReviewCandidate


class ImportReviewRecord(BaseModel):
    review_id: str
    status: ImportReviewStatus
    source: str
    source_id: str
    source_url: str | None = None
    provider: str
    display_title: str | None = None
    display_image_url: str | None = None
    display_ready_minutes: int | None = None
    display_servings: int | None = None
    display_ingredients: list[str] = Field(default_factory=list)
    display_instructions: list[str] = Field(default_factory=list)
    candidate_provenance: dict[str, Any] = Field(default_factory=dict)
    readiness_bucket: FeasibilityBucket | None = None
    readiness_score: float | None = None
    used_ingredients: list[str] = Field(default_factory=list)
    missed_ingredients: list[str] = Field(default_factory=list)
    safety_flags: list[ImportReviewSafetyFlag] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
