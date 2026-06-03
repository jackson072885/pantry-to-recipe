from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


# Stable Phase 1 status vocabulary for disabled, configured, and failed providers.
ProviderStatus = Literal["configured", "disabled", "missing_api_key", "error"]

# Stable Phase 1 feasibility buckets. Weighted pantry feasibility will refine
# assignment later, but these response values should stay durable.
FeasibilityBucket = Literal["cookable_tonight", "almost_there", "inspiration", "rejected"]
FilterMode = Literal["cookable_tonight", "almost_there", "inspiration", "all"]
CandidateIngredientGroup = Literal["used", "missed", "unused"]
CandidateMissingSeverity = Literal["critical", "moderate", "minor", "other"]
CandidateInspectionStatus = Literal["inspectable", "incomplete", "rejected"]
CandidateImportReadiness = Literal["ready_for_review", "needs_review", "not_importable"]


class ExternalRecipeCandidate(BaseModel):
    source: str
    source_id: str
    source_url: str | None = None
    title: str
    display_title: str | None = None
    image_url: str | None = None
    ready_minutes: int | None = None
    servings: int | None = None
    ingredients: list[str] = Field(default_factory=list)
    display_ingredients: list[str] = Field(default_factory=list)
    used_ingredients: list[str] = Field(default_factory=list)
    display_used_ingredients: list[str] = Field(default_factory=list)
    missed_ingredients: list[str] = Field(default_factory=list)
    display_missed_ingredients: list[str] = Field(default_factory=list)
    unused_ingredients: list[str] = Field(default_factory=list)
    instructions: list[str] = Field(default_factory=list)
    cuisine_tags: list[str] = Field(default_factory=list)
    dish_type_tags: list[str] = Field(default_factory=list)
    flavor_tags: list[str] = Field(default_factory=list)
    sauce_tags: list[str] = Field(default_factory=list)
    method_tags: list[str] = Field(default_factory=list)
    raw_score_fields: dict[str, Any] = Field(default_factory=dict)
    normalization_notes: list[str] = Field(default_factory=list)
    source_provenance: dict[str, Any] = Field(default_factory=dict)
    feasibility_reasons: list[str] = Field(default_factory=list)
    critical_missing_ingredients: list[str] = Field(default_factory=list)
    moderate_missing_ingredients: list[str] = Field(default_factory=list)
    minor_missing_ingredients: list[str] = Field(default_factory=list)
    score: float = 0.0
    feasibility_bucket: FeasibilityBucket = "rejected"


class ExternalRecipeSearchResult(BaseModel):
    provider: str
    provider_status: ProviderStatus
    best: ExternalRecipeCandidate | None = None
    alternatives: list[ExternalRecipeCandidate] = Field(default_factory=list)
    candidates: list[ExternalRecipeCandidate] = Field(default_factory=list)
    filter_counts: dict[str, Any] | None = None
    error_message: str | None = None


class ExternalRecipeSearchRequest(BaseModel):
    ingredients: list[str]
    preferences: dict | None = None
    limit: int = Field(default=10, ge=1, le=25)
    sources: list[Literal["external"]] | None = None
    selected_filters: dict[str, list[str]] | None = None
    filter_mode: FilterMode = "cookable_tonight"

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

    @field_validator("selected_filters")
    @classmethod
    def selected_filters_must_have_lists(
        cls, value: dict[str, list[str]] | None
    ) -> dict[str, list[str]] | None:
        if value is None:
            return None
        for family, values in value.items():
            if not isinstance(family, str) or not isinstance(values, list):
                raise ValueError("selected_filters must map filter families to lists of strings")
            if not all(isinstance(item, str) for item in values):
                raise ValueError("selected_filters values must be strings")
        return value


class ExternalRecipeInspectionRequest(BaseModel):
    candidate: ExternalRecipeCandidate


class ExternalRecipeInspectedIngredient(BaseModel):
    raw: str
    display: str
    group: CandidateIngredientGroup
    missing_severity: CandidateMissingSeverity | None = None


class ExternalRecipeInstructionInspection(BaseModel):
    has_instructions: bool
    steps: list[str] = Field(default_factory=list)
    warning: str | None = None


class ExternalRecipeCandidateInspection(BaseModel):
    candidate: ExternalRecipeCandidate
    display_title: str
    source: str
    source_id: str
    source_url: str | None = None
    ingredients: list[ExternalRecipeInspectedIngredient] = Field(default_factory=list)
    instructions: ExternalRecipeInstructionInspection
    provenance: dict[str, Any] = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
    inspection_status: CandidateInspectionStatus
    import_readiness: CandidateImportReadiness
