from __future__ import annotations

from pydantic import BaseModel


class RecipeIngredientOut(BaseModel):
    ingredient_id: int
    ingredient_name: str
    is_required: bool


class RecipeDetailOut(BaseModel):
    id: int
    name: str
    cook_time_minutes: int | None = None
    difficulty: str | None = None
    cuisine: str | None = None
    ingredients: list[RecipeIngredientOut]
