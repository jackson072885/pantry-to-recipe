from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


HouseholdBand = Literal["1_2", "3_4", "5_plus"]
BudgetSensitivity = Literal["low", "normal", "high"]


class SupplyPlanRequest(BaseModel):
    pantry_items: list[str] = Field(default_factory=list)
    household_band: HouseholdBand = "3_4"
    days_target: int = Field(default=7, ge=1, le=21)
    budget_sensitivity: BudgetSensitivity = "normal"


class SupplyRecommendationOut(BaseModel):
    ingredient: str
    score: float
    coverage_delta_days: int
    meals_unlocked: int
    estimated_spend_band: Literal["$", "$$", "$$$"]
    confidence: Literal["low", "med", "high"]
    notes: list[str] = Field(default_factory=list)


class SupplyPlanResponse(BaseModel):
    bottleneck_ingredient: str
    protein_exhaustion_day: int
    recommendations: list[SupplyRecommendationOut] = Field(default_factory=list)
    generated_for_days: int
