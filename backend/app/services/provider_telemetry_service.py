from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.provider_telemetry import ProviderTelemetryEvent, ProviderTelemetrySession


@dataclass(frozen=True)
class TelemetryEventResult:
    event_id: int
    session_id: str
    event_count: int


@dataclass(frozen=True)
class TelemetrySessionCloseResult:
    session_id: str
    event_count: int
    duration_seconds: int
    outcome: str | None


def _get_or_create_session(db: Session, session_id: str) -> ProviderTelemetrySession:
    session = (
        db.query(ProviderTelemetrySession)
        .filter(ProviderTelemetrySession.session_id == session_id)
        .first()
    )
    if session:
        return session

    session = ProviderTelemetrySession(session_id=session_id)
    db.add(session)
    db.flush()
    return session


def record_event(
    db: Session,
    session_id: str,
    event_name: str,
    properties: dict,
) -> TelemetryEventResult:
    session = _get_or_create_session(db, session_id)

    event = ProviderTelemetryEvent(
        session_id=session_id,
        event_name=event_name.strip().lower(),
        properties_json=json.dumps(properties or {}, sort_keys=True),
    )
    db.add(event)

    session.event_count = int(session.event_count or 0) + 1
    db.commit()
    db.refresh(event)
    db.refresh(session)

    return TelemetryEventResult(
        event_id=event.id,
        session_id=session_id,
        event_count=session.event_count,
    )


def close_session(
    db: Session,
    session_id: str,
    duration_seconds: int,
    outcome: str | None,
) -> TelemetrySessionCloseResult:
    session = _get_or_create_session(db, session_id)
    session.duration_seconds = max(int(session.duration_seconds or 0), int(duration_seconds))
    if outcome:
        session.outcome = outcome
    if session.closed_at is None:
        session.closed_at = datetime.utcnow()
    db.commit()
    db.refresh(session)

    return TelemetrySessionCloseResult(
        session_id=session_id,
        event_count=int(session.event_count or 0),
        duration_seconds=int(session.duration_seconds or 0),
        outcome=session.outcome,
    )


def count_total_events(db: Session) -> int:
    return int(db.query(ProviderTelemetryEvent).count())


def count_closed_sessions(db: Session) -> int:
    return int(
        db.query(ProviderTelemetrySession)
        .filter(ProviderTelemetrySession.closed_at.is_not(None))
        .count()
    )
