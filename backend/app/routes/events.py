from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import route_response
from app.db import get_db
from app.schemas.events import UserActionRequest
from app.services.user_action_service import record_user_action

router = APIRouter(prefix="/events", tags=["events"])


@router.post("")
@router.post("/")
def create_event(request: UserActionRequest, db: Session = Depends(get_db)):
    return route_response(
        lambda: _create_event(db, request),
        db=db,
        default_error="Event tracking failed",
    )


def _create_event(db: Session, request: UserActionRequest) -> dict:
    result = record_user_action(
        db,
        request.event,
        request.recipe_id,
        request.metadata,
    )
    return {
        "action_id": result.action_id,
        "event_id": result.action_id,
        "event": result.event,
        "recipe_id": result.recipe_id,
        "recorded_at": result.recorded_at.isoformat(),
        "accepted": True,
    }
