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


class MatchV2Request(BaseModel):
    ingredients: list[str] = Field(default_factory=list)


class MatchV2Result(BaseModel):
    recipe_id: int
    recipe_name: str
    missing_count: int
    missing_required: list[str]
    dinner_score: float


class MatchV2Response(BaseModel):
    cookable: list[MatchV2Result] = Field(default_factory=list)
    almost: list[MatchV2Result] = Field(default_factory=list)
    not_recommended: list[MatchV2Result] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)
