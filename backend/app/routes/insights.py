from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.provider import (
    DamageRequest,
    DamageResponse,
    MicroForecastRequest,
    MicroForecastResponse,
    ProviderSummaryRequest,
    ProviderSummaryResponse,
    TelemetryEventRequest,
    TelemetryEventResponse,
    TelemetrySessionCloseRequest,
    TelemetrySessionCloseResponse,
)
from app.services.provider_insights_service import (
    build_damage_insight,
    build_micro_forecast,
    build_provider_summary,
)
from app.services.provider_telemetry_service import close_session, record_event

router = APIRouter(prefix="/insights", tags=["insights"])


@router.post("/provider-summary", response_model=ProviderSummaryResponse)
def provider_summary(
    request: ProviderSummaryRequest,
    db: Session = Depends(get_db),
) -> ProviderSummaryResponse:
    try:
        return ProviderSummaryResponse(**build_provider_summary(db, request))
    except Exception:
        raise HTTPException(status_code=500, detail="Provider summary failed")


@router.post("/damage", response_model=DamageResponse)
def damage(request: DamageRequest) -> DamageResponse:
    try:
        return DamageResponse(**build_damage_insight(request))
    except Exception:
        raise HTTPException(status_code=500, detail="Damage insight failed")


@router.post("/forecast/micro", response_model=MicroForecastResponse)
def forecast_micro(
    request: MicroForecastRequest,
    db: Session = Depends(get_db),
) -> MicroForecastResponse:
    try:
        return MicroForecastResponse(**build_micro_forecast(db, request))
    except Exception:
        raise HTTPException(status_code=500, detail="Micro forecast failed")


@router.post("/telemetry/event", response_model=TelemetryEventResponse)
def telemetry_event(
    request: TelemetryEventRequest,
    db: Session = Depends(get_db),
) -> TelemetryEventResponse:
    try:
        result = record_event(
            db,
            request.session_id,
            request.event_name,
            request.properties,
        )
        return TelemetryEventResponse(
            event_id=result.event_id,
            session_id=result.session_id,
            event_count=result.event_count,
            accepted=True,
        )
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Telemetry event failed")


@router.post("/telemetry/session/close", response_model=TelemetrySessionCloseResponse)
def telemetry_session_close(
    request: TelemetrySessionCloseRequest,
    db: Session = Depends(get_db),
) -> TelemetrySessionCloseResponse:
    try:
        result = close_session(
            db,
            request.session_id,
            request.duration_seconds,
            request.outcome,
        )
        return TelemetrySessionCloseResponse(
            session_id=result.session_id,
            closed=True,
            event_count=result.event_count,
            duration_seconds=result.duration_seconds,
            outcome=result.outcome,
        )
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Telemetry close failed")
