from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class MatchRequest(BaseModel):
    pantry: list[str] = Field(default_factory=list)


class MatchResult(BaseModel):
    recipe_id: int
    recipe_name: str
    status: Literal["cookable", "almost", "not"]
    confidence: float
    missing_required_count: int
    total_required: int
    missing_required: list[str]


class MatchResponse(BaseModel):
    cookable: list[MatchResult] = Field(default_factory=list)
    almost: list[MatchResult] = Field(default_factory=list)
    not_cookable: list[MatchResult] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)