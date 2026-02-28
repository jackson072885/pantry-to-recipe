from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class OnboardingProfilePreviewRequest(BaseModel):
    diet: Literal["omnivore", "vegetarian", "vegan", "pescatarian", "any"] = "any"
    allergies: list[str] = Field(default_factory=list)
    time_pref: Literal["<=15", "<=30", "<=45", "any"] = "<=30"
    skill_level: Literal["beginner", "intermediate", "advanced"] = "beginner"
    pantry_items: list[str] = Field(default_factory=list)


class OnboardingProfilePreviewResponse(BaseModel):
    summary: str
    confidence: float = Field(ge=0.0, le=1.0)
    clarifying_question: str | None = None


class OnboardingRecipeConstraints(BaseModel):
    diet: Literal["omnivore", "vegetarian", "vegan", "pescatarian", "any"] = "any"
    allergies: list[str] = Field(default_factory=list)
    max_minutes: int = Field(default=30, ge=5, le=240)


class OnboardingFirstRecipeRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=120)
    pantry_items: list[str] = Field(default_factory=list)
    constraints: OnboardingRecipeConstraints = Field(default_factory=OnboardingRecipeConstraints)


class OnboardingRecipeRecommendation(BaseModel):
    recipe_id: int
    recipe_name: str
    reasons: list[str] = Field(default_factory=list)
    missing_ingredients: list[str] = Field(default_factory=list)


class OnboardingFirstRecipeResponse(BaseModel):
    recommendations: list[OnboardingRecipeRecommendation] = Field(default_factory=list)
