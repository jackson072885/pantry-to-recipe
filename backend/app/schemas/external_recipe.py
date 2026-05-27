from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


# Stable Phase 1 status vocabulary for disabled, configured, and failed providers.
ProviderStatus = Literal["configured", "disabled", "missing_api_key", "error"]

# Stable Phase 1 feasibility buckets. Weighted pantry feasibility will refine
# assignment later, but these response values should stay durable.
FeasibilityBucket = Literal["cookable_tonight", "almost_there", "inspiration", "rejected"]


class ExternalRecipeCandidate(BaseModel):
    source: str
    source_id: str
    source_url: str | None = None
    title: str
    image_url: str | None = None
    ready_minutes: int | None = None
    servings: int | None = None
    ingredients: list[str] = Field(default_factory=list)
    used_ingredients: list[str] = Field(default_factory=list)
    missed_ingredients: list[str] = Field(default_factory=list)
    unused_ingredients: list[str] = Field(default_factory=list)
    instructions: list[str] = Field(default_factory=list)
    cuisine_tags: list[str] = Field(default_factory=list)
    dish_type_tags: list[str] = Field(default_factory=list)
    flavor_tags: list[str] = Field(default_factory=list)
    sauce_tags: list[str] = Field(default_factory=list)
    method_tags: list[str] = Field(default_factory=list)
    raw_score_fields: dict[str, Any] = Field(default_factory=dict)
    score: float = 0.0
    feasibility_bucket: FeasibilityBucket = "rejected"


class ExternalRecipeSearchResult(BaseModel):
    provider: str
    provider_status: ProviderStatus
    best: ExternalRecipeCandidate | None = None
    alternatives: list[ExternalRecipeCandidate] = Field(default_factory=list)
    candidates: list[ExternalRecipeCandidate] = Field(default_factory=list)
    error_message: str | None = None


class ExternalRecipeSearchRequest(BaseModel):
    ingredients: list[str]
    preferences: dict | None = None
    limit: int = Field(default=10, ge=1, le=25)
    sources: list[Literal["external"]] | None = None

    @field_validator("ingredients")
    @classmethod
    def ingredients_must_have_values(cls, value: list[str]) -> list[str]:
        if not value or not any(isinstance(item, str) and item.strip() for item in value):
            raise ValueError("At least one ingredient is required")
        return value

    @field_validator("sources")
    @classmethod
    def sources_must_be_external_only(cls, value: list[str] | None) -> list[str] | None:
        if value is not None and value != ["external"]:
            raise ValueError("Only external candidates are supported in Phase 1")
        return value
