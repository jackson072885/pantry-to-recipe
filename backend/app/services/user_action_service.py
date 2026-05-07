from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.models.user_action import UserAction

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class UserActionResult:
    action_id: int
    event: str
    recipe_id: int | None
    recorded_at: datetime


def record_user_action(
    db: Session,
    event: str,
    recipe_id: int | None,
    metadata: dict[str, Any] | None,
    session_id: str = "anonymous",
) -> UserActionResult:
    action = UserAction(
        session_id=session_id,
        event=event.strip().lower(),
        recipe_id=recipe_id,
        metadata_json=json.dumps(jsonable_encoder(metadata or {}), sort_keys=True),
    )
    db.add(action)
    db.commit()
    db.refresh(action)

    logger.info("User action recorded: event=%s recipe_id=%s action_id=%s", action.event, action.recipe_id, action.id)

    return UserActionResult(
        action_id=action.id,
        event=action.event,
        recipe_id=action.recipe_id,
        recorded_at=action.created_at,
    )
