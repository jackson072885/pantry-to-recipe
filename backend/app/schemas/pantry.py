from __future__ import annotations

import math

from pydantic import BaseModel, Field, field_validator


class PantryMutationPayload(BaseModel):
    name: str
    amount: float
    unit: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Ingredient name is required")
        return trimmed

    @field_validator("amount", mode="before")
    @classmethod
    def validate_amount(cls, value: object) -> float:
        try:
            amount = float(value)
        except (TypeError, ValueError) as exc:
            raise ValueError("Amount must be a number") from exc

        if not math.isfinite(amount):
            raise ValueError("Amount must be a finite number")
        if amount <= 0:
            raise ValueError("Amount must be greater than 0")
        return amount

    @field_validator("unit")
    @classmethod
    def normalize_unit(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class PantryUseSoonPayload(BaseModel):
    name: str
    use_soon: bool = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Ingredient name is required")
        return trimmed


class PantryItemOut(BaseModel):
    ingredient: str
    quantity: float | None = None
    unit: str | None = None
    quantity_is_known: bool = True
    use_soon: bool = False


class PantryListResponse(BaseModel):
    items: list[PantryItemOut] = Field(default_factory=list)


class PantryImportPayload(BaseModel):
    lines: list[str] = Field(default_factory=list)

    @field_validator("lines")
    @classmethod
    def validate_lines(cls, value: list[str]) -> list[str]:
        if not isinstance(value, list) or len(value) == 0:
            raise ValueError("At least one pantry import line is required")
        return value


class PantryImportLineResult(BaseModel):
    raw_line: str
    cleaned_line: str
    status: str
    parsed_quantity: float | None = None
    parsed_unit: str | None = None
    parsed_ingredient_text: str | None = None
    canonical_unit: str | None = None
    canonical_ingredient: str | None = None
    reason_code: str
    reason_message: str
