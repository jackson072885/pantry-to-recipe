from __future__ import annotations

from fastapi import APIRouter

from app.api.responses import route_response
from app.schemas.ai_recipe import RecipeGenerateRequest, RecipeOptimizeRequest
from app.services.ai_recipe_service import generate_recipe, optimize_recipe_prompt

router = APIRouter(prefix="/ai/recipe", tags=["ai"])


@router.post("/optimize")
def optimize(request: RecipeOptimizeRequest):
    return route_response(
        lambda: optimize_recipe_prompt(request),
        default_error="Recipe optimize failed",
    )


@router.post("/generate")
def generate(request: RecipeGenerateRequest):
    return route_response(
        lambda: generate_recipe(request),
        default_error="Recipe generate failed",
    )
