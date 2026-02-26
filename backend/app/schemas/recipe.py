from __future__ import annotations

from pydantic import BaseModel


class RecipeIngredientOut(BaseModel):
    ingredient_id: int
    ingredient_name: str
    is_required: bool


class RecipeDetailOut(BaseModel):
    id: int
    name: str
    cuisine: str | None = None
    difficulty: str | None = None
    cook_method: str | None = None
    prep_time_minutes: int | None = None
    cook_time_minutes: int | None = None
    total_time_minutes: int | None = None
    oven_temp_f: int | None = None
    air_fryer_temp_f: int | None = None
    servings: int | None = None
    instructions: str | None = None
    ingredients: list[RecipeIngredientOut]
