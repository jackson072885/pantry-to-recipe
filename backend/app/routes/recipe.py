from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Recipe, RecipeIngredient, Ingredient
from app.schemas.recipe import RecipeDetailOut, RecipeIngredientOut

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.get("/")
def list_recipes(limit: int = 50, db: Session = Depends(get_db)):
    rows = db.execute(select(Recipe).limit(limit)).scalars().all()
    return [{"id": r.id, "name": r.name} for r in rows]


@router.get("/{recipe_id}", response_model=RecipeDetailOut)
def recipe_detail(recipe_id: int, db: Session = Depends(get_db)) -> RecipeDetailOut:
    recipe = db.get(Recipe, recipe_id)
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
        cook_time_minutes=recipe.cook_time_minutes,
        difficulty=recipe.difficulty,
        cuisine=recipe.cuisine,
        ingredients=ingredients,
    )
