from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

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
PromotionAuditStatus = Literal["not_started", "passed", "needs_work", "blocked"]
PromotionAuditReadiness = Literal["not_ready", "ready_for_review", "blocked"]


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


class ImportReviewUpdateRequest(BaseModel):
    status: ImportReviewStatus | None = None
    reviewer_notes: str | None = None
    edited_display_title: str | None = None
    edited_display_ingredients: list[str] | None = None
    edited_display_instructions: list[str] | None = None


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
    reviewer_notes: str | None = None
    edited_display_title: str | None = None
    edited_display_ingredients: list[str] = Field(default_factory=list)
    edited_display_instructions: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ImportedRecipeRecord(BaseModel):
    import_id: str
    review_id: str
    source: str
    source_id: str
    source_url: str | None = None
    provider: str
    title: str
    ingredients: list[str] = Field(default_factory=list)
    instructions: list[str] = Field(default_factory=list)
    provenance: dict[str, Any] = Field(default_factory=dict)
    origin: Literal["external_import"] = "external_import"
    verification_status: Literal["imported_reviewed"] = "imported_reviewed"
    imported_from_external: bool = True
    imported_at: datetime


class ImportedRecipeCleanupUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    ingredients: list[str] | None = None
    instructions: list[str] | None = None


class ImportedRecipePromotionAuditRecord(BaseModel):
    audit_id: str
    import_id: str
    review_id: str
    provenance_status: PromotionAuditStatus = "not_started"
    cleanup_status: PromotionAuditStatus = "not_started"
    safety_status: PromotionAuditStatus = "not_started"
    feasibility_status: PromotionAuditStatus = "not_started"
    quality_status: PromotionAuditStatus = "not_started"
    duplicate_status: PromotionAuditStatus = "not_started"
    reviewer_notes: str | None = None
    promotion_readiness: PromotionAuditReadiness = "not_ready"
    origin: Literal["external_import"] = "external_import"
    verification_status: Literal["imported_reviewed"] = "imported_reviewed"
    imported_from_external: bool = True
    created_at: datetime
    updated_at: datetime


class ImportedRecipePromotionAuditUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provenance_status: PromotionAuditStatus | None = None
    cleanup_status: PromotionAuditStatus | None = None
    safety_status: PromotionAuditStatus | None = None
    feasibility_status: PromotionAuditStatus | None = None
    quality_status: PromotionAuditStatus | None = None
    duplicate_status: PromotionAuditStatus | None = None
    reviewer_notes: str | None = None
