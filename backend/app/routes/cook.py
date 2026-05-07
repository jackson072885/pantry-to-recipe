from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import BAD_REQUEST, INSUFFICIENT_PANTRY, NOT_FOUND, route_response
from app.api.session import get_pantry_session_id
from app.db import get_db
from app.services.cook_service import cook_recipe

router = APIRouter(prefix="/cook", tags=["cook"])


@router.post("/{recipe_id}")
def cook(
    recipe_id: int,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_pantry_session_id),
):
    return route_response(
        lambda: cook_recipe(db, recipe_id, session_id),
        db=db,
        error_mapper=_cook_error_mapper,
        default_error="Cook failed",
    )


def _cook_error_mapper(exc: ValueError) -> tuple[str, str, int]:
    message = str(exc)
    if message == "Recipe not found":
        return NOT_FOUND, message, 404
    if message.startswith("Missing required ingredients:"):
        return INSUFFICIENT_PANTRY, message, 409
    return BAD_REQUEST, message, 400
