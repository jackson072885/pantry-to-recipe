from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ImportReviewQueueRecord(Base):
    __tablename__ = "import_review_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    review_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(40), index=True)
    source: Mapped[str] = mapped_column(String(80), index=True)
    source_id: Mapped[str] = mapped_column(String(200), index=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider: Mapped[str] = mapped_column(String(80), index=True)
    display_title: Mapped[str | None] = mapped_column(String(240), nullable=True)
    display_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_ready_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    display_servings: Mapped[int | None] = mapped_column(Integer, nullable=True)
    display_ingredients_json: Mapped[str] = mapped_column(Text, default="[]")
    display_instructions_json: Mapped[str] = mapped_column(Text, default="[]")
    candidate_provenance_json: Mapped[str] = mapped_column(Text, default="{}")
    readiness_bucket: Mapped[str | None] = mapped_column(String(40), nullable=True)
    readiness_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    used_ingredients_json: Mapped[str] = mapped_column(Text, default="[]")
    missed_ingredients_json: Mapped[str] = mapped_column(Text, default="[]")
    safety_flags_json: Mapped[str] = mapped_column(Text, default="[]")
    reviewer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    edited_display_title: Mapped[str | None] = mapped_column(String(240), nullable=True)
    edited_display_ingredients_json: Mapped[str] = mapped_column(Text, default="[]")
    edited_display_instructions_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ImportedRecipeRecord(Base):
    __tablename__ = "imported_recipe_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    import_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    review_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    source: Mapped[str] = mapped_column(String(80), index=True)
    source_id: Mapped[str] = mapped_column(String(200), index=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(240))
    ingredients_json: Mapped[str] = mapped_column(Text, default="[]")
    instructions_json: Mapped[str] = mapped_column(Text, default="[]")
    provenance_json: Mapped[str] = mapped_column(Text, default="{}")
    origin: Mapped[str] = mapped_column(String(80), default="external_import", index=True)
    verification_status: Mapped[str] = mapped_column(String(80), default="imported_reviewed", index=True)
    imported_from_external: Mapped[bool] = mapped_column(Boolean, default=True)
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ImportedRecipePromotionAuditRecord(Base):
    __tablename__ = "imported_recipe_promotion_audits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    audit_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    import_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    review_id: Mapped[str] = mapped_column(String(80), index=True)
    provenance_status: Mapped[str] = mapped_column(String(40), default="not_started")
    cleanup_status: Mapped[str] = mapped_column(String(40), default="not_started")
    safety_status: Mapped[str] = mapped_column(String(40), default="not_started")
    feasibility_status: Mapped[str] = mapped_column(String(40), default="not_started")
    quality_status: Mapped[str] = mapped_column(String(40), default="not_started")
    duplicate_status: Mapped[str] = mapped_column(String(40), default="not_started")
    reviewer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
