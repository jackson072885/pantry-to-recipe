from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ProviderSummaryRequest(BaseModel):
    provider_id: str = "default-provider"
    window_days: int = Field(default=7, ge=1, le=90)
    focus_ingredients: list[str] = Field(default_factory=list)
    adjustments: dict[str, float] = Field(default_factory=dict)


class ProviderSummaryResponse(BaseModel):
    provider_id: str
    window_days: int
    health_score: float
    scarcity_risk: float
    readiness_band: str
    pantry_snapshot: dict[str, Any] = Field(default_factory=dict)
    highlights: list[str] = Field(default_factory=list)


class DamageShock(BaseModel):
    domain: str
    severity: float = Field(default=0.5, ge=0.0, le=1.0)
    duration_days: int = Field(default=7, ge=1, le=180)


class DamageRequest(BaseModel):
    baseline_score: float = Field(default=15.0, ge=0.0, le=100.0)
    shocks: list[DamageShock] = Field(default_factory=list)


class DamageResponse(BaseModel):
    damage_index: float
    severity_band: Literal["low", "moderate", "high", "critical"]
    affected_domains: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class MicroForecastRequest(BaseModel):
    horizon_days: int = Field(default=7, ge=1, le=30)
    demand_shift: float = Field(default=0.0, ge=-1.0, le=1.0)
    supply_shift: float = Field(default=0.0, ge=-1.0, le=1.0)
    volatility: float = Field(default=0.0, ge=0.0, le=1.0)
    focus_ingredients: list[str] = Field(default_factory=list)


class MicroForecastResponse(BaseModel):
    horizon_days: int
    forecast_score: float
    trend: Literal["up", "flat", "down"]
    cookable_projection: int
    almost_projection: int
    drivers: list[str] = Field(default_factory=list)


class ScarcitySimulateRequest(BaseModel):
    ingredients: list[str] = Field(default_factory=list)
    scarcity_level: float = Field(default=0.35, ge=0.0, le=1.0)
    budget_tightness: float = Field(default=0.35, ge=0.0, le=1.0)


class ScarcitySimulateResponse(BaseModel):
    scenario_id: str
    risk_score: float
    recommended_archetype: str
    missing_ingredients: list[str] = Field(default_factory=list)
    substitutions: list[dict[str, str]] = Field(default_factory=list)
    action_plan: list[str] = Field(default_factory=list)


class PlanArchetypeOut(BaseModel):
    archetype_id: str
    title: str
    description: str
    trigger: str


class ArchetypesResponse(BaseModel):
    archetypes: list[PlanArchetypeOut] = Field(default_factory=list)


class UnlockMinimalRequest(BaseModel):
    goal: str = "provider-intelligence"
    pantry_items_target: int = Field(default=6, ge=1, le=50)
    event_target: int = Field(default=3, ge=1, le=100)
    closed_session_target: int = Field(default=1, ge=1, le=20)
    session_id: str | None = None


class UnlockMinimalResponse(BaseModel):
    goal: str
    unlocked: bool
    progress: float
    reasons: list[str] = Field(default_factory=list)
    remaining_steps: list[str] = Field(default_factory=list)


class TelemetryEventRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=120)
    event_name: str = Field(min_length=1, max_length=120)
    properties: dict[str, Any] = Field(default_factory=dict)


class TelemetryEventResponse(BaseModel):
    event_id: int
    session_id: str
    event_count: int
    accepted: bool = True


class TelemetrySessionCloseRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=120)
    duration_seconds: int = Field(default=0, ge=0, le=86400)
    outcome: str | None = Field(default=None, max_length=120)


class TelemetrySessionCloseResponse(BaseModel):
    session_id: str
    closed: bool
    event_count: int
    duration_seconds: int
    outcome: str | None = None
