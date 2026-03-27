from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import route_response
from app.db import get_db
from app.schemas.provider import (
    DamageRequest,
    MicroForecastRequest,
    ProviderSummaryRequest,
    TelemetryEventRequest,
    TelemetrySessionCloseRequest,
)
from app.services.provider_insights_service import build_damage_insight, build_micro_forecast, build_provider_summary
from app.services.provider_telemetry_service import close_session, record_event

router = APIRouter(prefix="/insights", tags=["insights"])


@router.post("/provider-summary")
def provider_summary(request: ProviderSummaryRequest, db: Session = Depends(get_db)):
    return route_response(
        lambda: build_provider_summary(db, request),
        db=db,
        default_error="Provider summary failed",
    )


@router.post("/damage")
def damage(request: DamageRequest):
    return route_response(
        lambda: build_damage_insight(request),
        default_error="Damage insight failed",
    )


@router.post("/forecast/micro")
def forecast_micro(request: MicroForecastRequest, db: Session = Depends(get_db)):
    return route_response(
        lambda: build_micro_forecast(db, request),
        db=db,
        default_error="Micro forecast failed",
    )


@router.post("/telemetry/event")
def telemetry_event(request: TelemetryEventRequest, db: Session = Depends(get_db)):
    return route_response(
        lambda: _telemetry_event(db, request),
        db=db,
        default_error="Telemetry event failed",
    )


@router.post("/telemetry/session/close")
def telemetry_session_close(request: TelemetrySessionCloseRequest, db: Session = Depends(get_db)):
    return route_response(
        lambda: _telemetry_session_close(db, request),
        db=db,
        default_error="Telemetry close failed",
    )


def _telemetry_event(db: Session, request: TelemetryEventRequest) -> dict:
    result = record_event(
        db,
        request.session_id,
        request.event_name,
        request.properties,
    )
    return {
        "event_id": result.event_id,
        "session_id": result.session_id,
        "event_count": result.event_count,
        "accepted": True,
    }


def _telemetry_session_close(db: Session, request: TelemetrySessionCloseRequest) -> dict:
    result = close_session(
        db,
        request.session_id,
        request.duration_seconds,
        request.outcome,
    )
    return {
        "session_id": result.session_id,
        "closed": True,
        "event_count": result.event_count,
        "duration_seconds": result.duration_seconds,
        "outcome": result.outcome,
    }
