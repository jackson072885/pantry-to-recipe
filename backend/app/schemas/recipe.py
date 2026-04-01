from __future__ import annotations

from pydantic import BaseModel, Field


class RecipeIngredientOut(BaseModel):
    ingredient_id: int
    ingredient_name: str
    display_name: str | None = None
    pantry_name: str | None = None
    is_required: bool
    required_quantity: float | None = None
    unit: str | None = None
    display_quantity: float | None = None
    display_unit: str | None = None
    prep_state: str | None = None
    notes: str | None = None
    measurement_is_estimated: bool = True


class RecipeStepOut(BaseModel):
    step_number: int
    instruction_text: str
    timing_minutes: int | None = None
    temperature_f: int | None = None
    equipment: str | None = None
    doneness_cue: str | None = None


class RecipeListOut(BaseModel):
    id: int
    name: str
    short_description: str | None = None
    meal_type: str | None = None
    total_time_minutes: int | None = None
    difficulty: str | None = None
    quality_score: int | None = None


class RecipeDetailOut(BaseModel):
    id: int
    name: str
    short_description: str | None = None
    cuisine: str | None = None
    difficulty: str | None = None
    meal_type: str | None = None
    cook_method: str | None = None
    prep_time_minutes: int | None = None
    cook_time_minutes: int | None = None
    total_time_minutes: int | None = None
    oven_temp_f: int | None = None
    air_fryer_temp_f: int | None = None
    servings: int | None = None
    instructions: str | None = None
    quality_score: int | None = None
    quality_bucket: str | None = None
    instruction_confidence: str | None = None
    review_status: str | None = None
    is_weeknight_friendly: bool | None = None
    is_beginner_friendly: bool | None = None
    equipment: list[str] = Field(default_factory=list)
    tips: list[str] = Field(default_factory=list)
    substitutions: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    storage: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    ingredients: list[RecipeIngredientOut] = Field(default_factory=list)
    steps: list[RecipeStepOut] = Field(default_factory=list)
