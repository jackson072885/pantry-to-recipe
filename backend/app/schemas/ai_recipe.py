from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


TimeBand = Literal["quick", "standard", "i_got_time"]
BudgetBand = Literal["stretch", "normal", "flexible"]
HouseholdBand = Literal["1_2", "3_4", "5_plus"]


class OptimizeConstraints(BaseModel):
    time_band: TimeBand = "standard"
    budget_band: BudgetBand = "normal"
    household_band: HouseholdBand = "3_4"


class RecipeOptimizeRequest(BaseModel):
    raw_prompt: str = Field(min_length=1, max_length=1000)
    constraints: OptimizeConstraints = Field(default_factory=OptimizeConstraints)
    pantry_ids: list[int] = Field(default_factory=list)


class ExtractedIntent(BaseModel):
    dish_style: str
    protein_pref: str
    flavor_notes: list[str] = Field(default_factory=list)
    banned_items: list[str] = Field(default_factory=list)


class RecipeOptimizeResponse(BaseModel):
    optimized_prompt: str
    extracted_intent: ExtractedIntent
    confidence: Literal["low", "med", "high"]
