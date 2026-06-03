from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import route_response
from app.api.session import get_pantry_session_id
from app.db import get_db
from app.schemas.external_recipe import ExternalRecipeInspectionRequest, ExternalRecipeSearchRequest
from app.schemas.import_review import ImportReviewCreateRequest, ImportReviewUpdateRequest
from app.services.external_recipe_service import (
    inspect_external_recipe_candidate,
    search_external_recipes_by_ingredients,
)
from app.services.import_review_repository import (
    create_review_record,
    list_review_records,
    read_review_record,
    update_review_record,
)

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
        lambda: create_review_record(db, request.candidate),
        default_error="Dinner Tonight import review failed",
        db=db,
    )


@router.get("/import-review")
def list_import_reviews(
    db: Session = Depends(get_db),
):
    return route_response(
        lambda: list_review_records(db),
        default_error="Dinner Tonight import review lookup failed",
        db=db,
    )


@router.get("/import-review/{review_id}")
def read_import_review(
    review_id: str,
    db: Session = Depends(get_db),
):
    return route_response(
        lambda: read_review_record(db, review_id),
        default_error="Dinner Tonight import review lookup failed",
        db=db,
    )


@router.patch("/import-review/{review_id}")
def update_import_review(
    review_id: str,
    request: ImportReviewUpdateRequest,
    db: Session = Depends(get_db),
):
    return route_response(
        lambda: update_review_record(db, review_id, request),
        default_error="Dinner Tonight import review update failed",
        db=db,
    )
