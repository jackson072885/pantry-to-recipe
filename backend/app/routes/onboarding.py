from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.onboarding import (
    OnboardingFirstRecipeRequest,
    OnboardingFirstRecipeResponse,
    OnboardingProfilePreviewRequest,
    OnboardingProfilePreviewResponse,
)
from app.services.onboarding_service import build_first_recipe_recommendations, build_profile_preview

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.post(
    "/profile/preview",
    response_model=OnboardingProfilePreviewResponse,
    summary="Preview onboarding profile summary",
    description="Builds a lightweight AI profile summary from preference and pantry signals.",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "diet": "omnivore",
                        "allergies": ["peanut"],
                        "time_pref": "<=30",
                        "skill_level": "beginner",
                        "pantry_items": ["eggs", "rice", "onion"],
                    }
                }
            }
        },
        "responses": {
            "200": {
                "content": {
                    "application/json": {
                        "example": {
                            "summary": "Quick, budget-aware everyday meals.",
                            "confidence": 0.84,
                            "clarifying_question": None,
                        }
                    }
                }
            }
        },
    },
)
def profile_preview(request: OnboardingProfilePreviewRequest) -> OnboardingProfilePreviewResponse:
    try:
        return build_profile_preview(request)
    except Exception:
        raise HTTPException(status_code=500, detail="Onboarding profile preview failed")


@router.post(
    "/recipes/first",
    response_model=OnboardingFirstRecipeResponse,
    summary="Generate first onboarding recipe recommendations",
    description="Returns top onboarding recipe candidates from pantry and user constraints.",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "session_id": "onb-123",
                        "pantry_items": ["eggs", "rice", "onion"],
                        "constraints": {
                            "diet": "omnivore",
                            "allergies": ["peanut"],
                            "max_minutes": 30,
                        },
                    }
                }
            }
        },
        "responses": {
            "200": {
                "content": {
                    "application/json": {
                        "example": {
                            "recommendations": [
                                {
                                    "recipe_id": 101,
                                    "recipe_name": "Egg Fried Rice",
                                    "reasons": ["uses_what_you_have", "fits_time_limit", "matches_diet"],
                                    "missing_ingredients": ["soy sauce"],
                                }
                            ]
                        }
                    }
                }
            }
        },
    },
)
def first_recipes(
    request: OnboardingFirstRecipeRequest,
    db: Session = Depends(get_db),
) -> OnboardingFirstRecipeResponse:
    try:
        return build_first_recipe_recommendations(db, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Onboarding first recipe generation failed")
