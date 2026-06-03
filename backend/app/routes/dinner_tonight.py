from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import route_response
from app.api.session import get_pantry_session_id
from app.db import get_db
from app.schemas.external_recipe import ExternalRecipeInspectionRequest, ExternalRecipeSearchRequest
from app.schemas.import_review import ImportReviewCreateRequest
from app.services.external_recipe_service import (
    inspect_external_recipe_candidate,
    search_external_recipes_by_ingredients,
)
from app.services.import_review_service import create_import_review_record

router = APIRouter(prefix="/dinner-tonight", tags=["dinner-tonight"])


@router.post("/candidates")
def external_candidates(
    request: ExternalRecipeSearchRequest,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_pantry_session_id),
):
    return route_response(
        lambda: search_external_recipes_by_ingredients(
            request.ingredients,
            preferences=request.preferences,
            limit=request.limit,
            selected_filters=request.selected_filters,
            filter_mode=request.filter_mode,
            fallback_db=db,
            session_id=session_id,
        ),
        default_error="Dinner Tonight candidate lookup failed",
        db=db,
    )


@router.post("/candidate-inspection")
def external_candidate_inspection(
    request: ExternalRecipeInspectionRequest,
    db: Session = Depends(get_db),
):
    return route_response(
        lambda: inspect_external_recipe_candidate(request.candidate),
        default_error="Dinner Tonight candidate inspection failed",
        db=db,
    )


@router.post("/import-review")
def create_import_review(
    request: ImportReviewCreateRequest,
    db: Session = Depends(get_db),
):
    return route_response(
        lambda: create_import_review_record(request.candidate),
        default_error="Dinner Tonight import review failed",
        db=db,
    )
