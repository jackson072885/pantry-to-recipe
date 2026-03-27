from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.responses import route_response
from app.db import get_db
from app.models import Ingredient, Recipe, RecipeIngredient
from app.schemas.recipe import RecipeDetailOut, RecipeIngredientOut
from app.services.recipe_dataset_service import active_recipe_select, get_active_recipe

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.get("")
@router.get("/")
def list_recipes(limit: int = 50, db: Session = Depends(get_db)):
    return route_response(
        lambda: _list_recipes(db, limit),
        db=db,
        default_error="Recipe list failed",
    )


@router.get("/{recipe_id}")
def recipe_detail(recipe_id: int, db: Session = Depends(get_db)):
    return route_response(
        lambda: _recipe_detail(db, recipe_id),
        db=db,
        default_error="Recipe detail failed",
    )


def _list_recipes(db: Session, limit: int) -> list[dict]:
    rows = db.execute(active_recipe_select().limit(limit)).scalars().all()
    return [{"id": r.id, "name": r.name} for r in rows]


def _recipe_detail(db: Session, recipe_id: int) -> RecipeDetailOut:
    recipe = get_active_recipe(db, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    rows = (
        db.query(RecipeIngredient, Ingredient)
        .join(Ingredient, Ingredient.id == RecipeIngredient.ingredient_id)
        .filter(RecipeIngredient.recipe_id == recipe_id)
        .all()
    )

    ingredients = [
        RecipeIngredientOut(
            ingredient_id=ing.id,
            ingredient_name=ing.canonical_name,
            is_required=ri.is_required,
        )
        for ri, ing in rows
    ]

    return RecipeDetailOut(
        id=recipe.id,
        name=recipe.name,
        cuisine=recipe.cuisine,
        difficulty=recipe.difficulty,
        cook_method=recipe.cook_method,
        prep_time_minutes=recipe.prep_time_minutes,
        cook_time_minutes=recipe.cook_time_minutes,
        total_time_minutes=recipe.total_time_minutes,
        oven_temp_f=recipe.oven_temp_f,
        air_fryer_temp_f=recipe.air_fryer_temp_f,
        servings=recipe.servings,
        instructions=recipe.instructions,
        ingredients=ingredients,
    )
