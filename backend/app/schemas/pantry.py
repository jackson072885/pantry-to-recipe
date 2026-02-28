from __future__ import annotations

from pydantic import BaseModel, Field


class PantryItemPayload(BaseModel):
    name: str = Field(..., min_length=1)
    amount: float = Field(ge=1)


class PantryItemOut(BaseModel):
    ingredient: str
    quantity: float
    unit: str


class PantryListResponse(BaseModel):
    items: list[PantryItemOut] = Field(default_factory=list)
