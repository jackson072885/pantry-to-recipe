from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SequenceRequest(BaseModel):
    days: int = Field(default=3, ge=3, le=7)
    household_band: Literal["1_2", "3_4", "5_plus"] = "3_4"
    time_band: Literal["quick", "standard", "i_got_time"] = "standard"
    budget_band: Literal["stretch", "normal", "flexible"] = "normal"
    pantry_items: list[str] = Field(default_factory=list)
    allow_missing_max: int = Field(default=2, ge=0, le=6)


class SequencePlanItem(BaseModel):
    day_index: int
    recipe_id: int
    recipe_name: str
    confidence: float
    missing_required_count: int
    missing_required: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list, min_length=2, max_length=3)


class SequencePlanSummary(BaseModel):
    coverage_band: Literal["low", "med", "high"]
    waste_risk_band: Literal["low", "med", "high"]
    protein_stability_band: Literal["low", "med", "high"]
    notes: list[str] = Field(default_factory=list)


class SequenceResponse(BaseModel):
    plan: list[SequencePlanItem] = Field(default_factory=list)
    plan_summary: SequencePlanSummary
    deterministic_seed: str
