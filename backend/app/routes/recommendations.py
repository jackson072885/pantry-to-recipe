from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.responses import BAD_REQUEST, route_response
from app.db import get_db
from app.services.recommendation_service import (
    DEFAULT_RECOMMENDATION_MODE,
    RecommendationMode,
    recommend_recipes,
)

router = APIRouter(prefix="/recommendations", tags=["recommendations"])
logger = logging.getLogger(__name__)


@router.get("")
@router.get("/")
def list_recommendations(
    pantry: list[str] = Query(default_factory=list),
    mode: RecommendationMode = Query(DEFAULT_RECOMMENDATION_MODE),
    db: Session = Depends(get_db),
):
    return route_response(
        lambda: _build_recommendations(db, pantry, mode),
        db=db,
        value_error_code=BAD_REQUEST,
        value_error_status_code=400,
        default_error="Recommendation lookup failed",
    )


def _build_recommendations(db: Session, pantry: list[str], mode: RecommendationMode) -> dict:
    if not pantry:
        raise ValueError("At least one pantry item is required")
    if any(not isinstance(item, str) or not item.strip() for item in pantry):
        raise ValueError("Pantry items must be non-empty strings")

    result = recommend_recipes(db, pantry, mode)
    logger.info(
        "Recommendation response: pantry_items=%s mode=%s cook_now=%s almost_there=%s not_worth_it=%s",
        len(pantry),
        mode.value,
        len(result["cook_now"]),
        len(result["almost_there"]),
        len(result["not_worth_it"]),
    )
    return result
