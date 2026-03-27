from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.supply import SupplyPlanResponse


class SupplySimulateRequest(BaseModel):
    pantry: list[str] = Field(default_factory=list)
    days: int = Field(default=3, ge=1, le=14)
    budget: float | None = Field(default=None, ge=0.0)
    goal: Literal["stretch", "balanced", "protein"] = "balanced"
    locked_items: list[str] = Field(default_factory=list)
    excluded_items: list[str] = Field(default_factory=list)


class ItemReason(BaseModel):
    item: str
    reason: str
    unlocks: list[str] = Field(default_factory=list)
    estimated_meals_unlocked: int = 0


class PlanExplanation(BaseModel):
    summary: str
    item_reasons: list[ItemReason] = Field(default_factory=list)


class PlanDeltas(BaseModel):
    added: list[str] = Field(default_factory=list)
    removed: list[str] = Field(default_factory=list)
    swapped: list[str] = Field(default_factory=list)


class SupplyPlanWithExplanation(BaseModel):
    plan: SupplyPlanResponse
    explanation: PlanExplanation


class SupplyAlternative(BaseModel):
    plan: SupplyPlanResponse
    deltas: PlanDeltas
    explanation: PlanExplanation


class SupplySimulateResponse(BaseModel):
    baseline_plan: SupplyPlanResponse
    baseline_explanation: PlanExplanation
    alternatives: list[SupplyAlternative] = Field(default_factory=list)
