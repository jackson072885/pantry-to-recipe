from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.responses import route_response
from app.db import get_db
from app.schemas.onboarding import OnboardingFirstRecipeRequest, OnboardingProfilePreviewRequest
from app.services.onboarding_service import build_first_recipe_recommendations, build_profile_preview

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.post("/profile/preview")
def profile_preview(request: OnboardingProfilePreviewRequest):
    return route_response(
        lambda: build_profile_preview(request),
        default_error="Onboarding profile preview failed",
    )


@router.post("/recipes/first")
def first_recipes(request: OnboardingFirstRecipeRequest, db: Session = Depends(get_db)):
    return route_response(
        lambda: build_first_recipe_recommendations(db, request),
        db=db,
        default_error="Onboarding first recipe generation failed",
    )
