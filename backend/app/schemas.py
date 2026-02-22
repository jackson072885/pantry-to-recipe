from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class MatchRequest(BaseModel):
    pantry_items: List[str] = Field(default_factory=list)


class Reason(BaseModel):
    type: str
    title: str
    detail: str
    impact: str  # positive/neutral/negative


class MatchResult(BaseModel):
    id: int
    name: str
    matched: List[str]
    missing: List[str]
    missing_count: int
    matched_count: int
    required_count: int
    match_ratio: float
    confidence: str
    confidence_score: float
    reasons: List[Reason]
    explanation: str


class MatchResponse(BaseModel):
    cookable: List[MatchResult]
    almost: List[MatchResult]
    not_cookable: List[MatchResult]


class IngredientOut(BaseModel):
    id: int
    canonical_name: str
    category: Optional[str] = None
    is_staple: bool = False


class RecipeIn(BaseModel):
    name: str
    ingredients: List[str] = Field(default_factory=list)
    instructions: Optional[str] = None
    cuisine_region: Optional[str] = None
    attributes: List[str] = Field(default_factory=list)


class RecipeOut(BaseModel):
    id: int
    name: str
