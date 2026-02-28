from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.ai_recipe import RecipeOptimizeRequest, RecipeOptimizeResponse
from app.services.ai_recipe_service import optimize_recipe_prompt

router = APIRouter(prefix="/ai/recipe", tags=["ai"])


@router.post("/optimize", response_model=RecipeOptimizeResponse)
def optimize(request: RecipeOptimizeRequest) -> RecipeOptimizeResponse:
    try:
        return RecipeOptimizeResponse(**optimize_recipe_prompt(request))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Recipe optimize failed")
