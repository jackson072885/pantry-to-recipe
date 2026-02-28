from __future__ import annotations

from app.services import pantry_service
from app.services.provider_telemetry_service import count_closed_sessions, count_total_events


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def evaluate_minimal_unlock(db, payload) -> dict:
    pantry_count = len(pantry_service.list_pantry(db))
    event_count = count_total_events(db)
    closed_sessions = count_closed_sessions(db)

    pantry_progress = _clamp01(pantry_count / float(payload.pantry_items_target))
    event_progress = _clamp01(event_count / float(payload.event_target))
    session_progress = _clamp01(closed_sessions / float(payload.closed_session_target))

    progress = round(
        (pantry_progress * 0.5) + (event_progress * 0.3) + (session_progress * 0.2),
        3,
    )
    unlocked = progress >= 0.7

    reasons = [
        f"Pantry progress: {pantry_count}/{payload.pantry_items_target}",
        f"Telemetry events: {event_count}/{payload.event_target}",
        f"Closed sessions: {closed_sessions}/{payload.closed_session_target}",
    ]

    remaining_steps = []
    if pantry_progress < 1.0:
        remaining_steps.append("Add more pantry coverage to stabilize recommendations.")
    if event_progress < 1.0:
        remaining_steps.append("Log additional telemetry events for behavior signal quality.")
    if session_progress < 1.0:
        remaining_steps.append("Close at least one telemetry session.")
    if unlocked:
        remaining_steps = []

    return {
        "goal": payload.goal,
        "unlocked": unlocked,
        "progress": progress,
        "reasons": reasons,
        "remaining_steps": remaining_steps,
    }
