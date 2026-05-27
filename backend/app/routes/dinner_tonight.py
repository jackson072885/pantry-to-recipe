from __future__ import annotations

from fastapi import APIRouter

from app.api.responses import route_response
from app.schemas.external_recipe import ExternalRecipeSearchRequest
from app.services.external_recipe_service import search_external_recipes_by_ingredients

router = APIRouter(prefix="/dinner-tonight", tags=["dinner-tonight"])


@router.post("/candidates")
def external_candidates(request: ExternalRecipeSearchRequest):
    return route_response(
        lambda: search_external_recipes_by_ingredients(
            request.ingredients,
            preferences=request.preferences,
            limit=request.limit,
            selected_filters=request.selected_filters,
            filter_mode=request.filter_mode,
        ),
        default_error="Dinner Tonight candidate lookup failed",
    )
