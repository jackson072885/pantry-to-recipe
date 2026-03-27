from __future__ import annotations

from sqlalchemy.orm import Session

from app.schemas.onboarding import (
    OnboardingFirstRecipeRequest,
    OnboardingFirstRecipeResponse,
    OnboardingProfilePreviewRequest,
    OnboardingProfilePreviewResponse,
    OnboardingRecipeRecommendation,
)
from app.services.normalize_service import normalize_item
from app.services.recommendation_service import recommend_recipes


def _profile_summary(payload: OnboardingProfilePreviewRequest, normalized_pantry: list[str]) -> str:
    speed_label = {
        "<=15": "ultra-quick",
        "<=30": "quick",
        "<=45": "balanced",
        "any": "flexible",
    }.get(payload.time_pref, "quick")

    pantry_label = "pantry-led" if len(normalized_pantry) >= 5 else "budget-aware"

    if payload.diet in {"vegetarian", "vegan", "pescatarian"}:
        diet_label = payload.diet
    else:
        diet_label = "everyday"

    return f"{speed_label.capitalize()}, {pantry_label} {diet_label} meals."


def build_profile_preview(payload: OnboardingProfilePreviewRequest) -> OnboardingProfilePreviewResponse:
    normalized_pantry = sorted(
        {
            item
            for item in (normalize_item(x) for x in payload.pantry_items if x and x.strip())
            if item
        }
    )

    confidence = 0.55
    confidence += min(len(normalized_pantry) * 0.04, 0.24)
    if payload.diet != "any":
        confidence += 0.08
    if payload.allergies:
        confidence += 0.05
    if payload.time_pref != "any":
        confidence += 0.04
    confidence = round(min(confidence, 0.95), 2)

    clarifying_question = None
    if len(normalized_pantry) < 3:
        clarifying_question = "Do you want low-cost staples included when pantry coverage is low?"

    return OnboardingProfilePreviewResponse(
        summary=_profile_summary(payload, normalized_pantry),
        confidence=confidence,
        clarifying_question=clarifying_question,
    )


def _reasons(max_minutes: int, diet: str, missing_count: int) -> list[str]:
    labels: list[str] = []

    if missing_count == 0:
        labels.append("uses_what_you_have")
    else:
        labels.append("minimal_missing_items")

    if max_minutes <= 30:
        labels.append("fits_time_limit")

    if diet != "any":
        labels.append("matches_diet")

    return labels


def build_first_recipe_recommendations(
    db: Session,
    payload: OnboardingFirstRecipeRequest,
) -> OnboardingFirstRecipeResponse:
    normalized_pantry = [
        item
        for item in (normalize_item(value, db) for value in payload.pantry_items if value and value.strip())
        if item
    ]
    ranked = recommend_recipes(db, normalized_pantry)
    candidates = ranked["cook_now"] + ranked["almost_there"] + ranked["not_worth_it"]

    recommendations: list[OnboardingRecipeRecommendation] = []
    for row in candidates[:3]:
        recipe = row["recipe"]
        recommendations.append(
            OnboardingRecipeRecommendation(
                recipe_id=recipe["recipe_id"],
                recipe_name=recipe["recipe_name"],
                reasons=_reasons(
                    payload.constraints.max_minutes,
                    payload.constraints.diet,
                    recipe["missing_count"],
                ),
                missing_ingredients=recipe["missing_ingredients"][:3],
            )
        )

    return OnboardingFirstRecipeResponse(recommendations=recommendations)
