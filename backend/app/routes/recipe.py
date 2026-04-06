from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.responses import route_response
from app.db import get_db
from app.models import Ingredient, RecipeIngredient
from app.schemas.recipe import RecipeDetailOut, RecipeIngredientOut, RecipeListOut, RecipeStepOut
from app.services.recipe_dataset_service import active_recipe_select, get_production_recipe

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


def _list_recipes(db: Session, limit: int) -> list[RecipeListOut]:
    rows = db.execute(active_recipe_select().limit(limit)).scalars().all()
    return [
        RecipeListOut(
            id=recipe.id,
            name=recipe.name,
            short_description=recipe.short_description,
            meal_type=recipe.meal_type,
            total_time_minutes=recipe.total_time_minutes,
            difficulty=recipe.difficulty,
            quality_score=recipe.quality_score,
        )
        for recipe in rows
    ]


def _recipe_detail(db: Session, recipe_id: int) -> RecipeDetailOut:
    recipe = get_production_recipe(db, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    ingredient_rows = (
        db.query(RecipeIngredient, Ingredient)
        .join(Ingredient, Ingredient.id == RecipeIngredient.ingredient_id)
        .filter(RecipeIngredient.recipe_id == recipe_id)
        .order_by(RecipeIngredient.sort_order.asc().nullslast(), RecipeIngredient.id.asc())
        .all()
    )

    ingredients = [
        RecipeIngredientOut(
            ingredient_id=ingredient.id,
            ingredient_name=ingredient.canonical_name,
            display_name=recipe_ingredient.display_name,
            pantry_name=recipe_ingredient.pantry_name,
            is_required=recipe_ingredient.is_required,
            required_quantity=recipe_ingredient.required_quantity,
            unit=recipe_ingredient.unit,
            display_quantity=recipe_ingredient.display_quantity,
            display_unit=recipe_ingredient.display_unit,
            prep_state=recipe_ingredient.prep_state,
            notes=recipe_ingredient.notes,
            measurement_is_estimated=recipe_ingredient.measurement_is_estimated,
        )
        for recipe_ingredient, ingredient in ingredient_rows
    ]

    steps = [
        RecipeStepOut(
            step_number=step.step_number,
            instruction_text=step.instruction_text,
            timing_minutes=step.timing_minutes,
            temperature_f=step.temperature_f,
            equipment=step.equipment,
            doneness_cue=step.doneness_cue,
        )
        for step in recipe.steps
    ]

    return RecipeDetailOut(
        id=recipe.id,
        name=recipe.name,
        short_description=recipe.short_description,
        cuisine=recipe.cuisine,
        difficulty=recipe.difficulty,
        meal_type=recipe.meal_type,
        cook_method=recipe.cook_method,
        prep_time_minutes=recipe.prep_time_minutes,
        cook_time_minutes=recipe.cook_time_minutes,
        total_time_minutes=recipe.total_time_minutes,
        oven_temp_f=recipe.oven_temp_f,
        air_fryer_temp_f=recipe.air_fryer_temp_f,
        servings=recipe.servings,
        instructions=recipe.instructions,
        quality_score=recipe.quality_score,
        quality_bucket=recipe.quality_bucket,
        instruction_confidence=_instruction_confidence_from_quality_reason(recipe.quality_reason),
        review_status=recipe.review_status,
        is_weeknight_friendly=recipe.is_weeknight_friendly,
        is_beginner_friendly=recipe.is_beginner_friendly,
        equipment=_read_json_list(recipe.equipment_json),
        tips=_read_json_list(recipe.tips_json),
        substitutions=_read_json_list(recipe.substitutions_json),
        warnings=_read_json_list(recipe.warnings_json),
        storage=_read_json_list(recipe.storage_json),
        tags=_read_json_list(recipe.tags_json),
        ingredients=ingredients,
        steps=steps,
    )


def _read_json_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item) for item in parsed if isinstance(item, str)]


def _instruction_confidence_from_quality_reason(value: str | None) -> str:
    if not value:
        return "medium"
    lowered = value.lower()
    if "low_instruction_confidence" in lowered:
        return "low"
    return "medium"
