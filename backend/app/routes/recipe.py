from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.responses import route_response
from app.api.session import get_pantry_session_id
from app.db import get_db
from app.models import Ingredient, RecipeIngredient
from app.schemas.recipe import RecipeDetailOut, RecipeIngredientOut, RecipeListOut, RecipeReadinessOut, RecipeStepOut
from app.services.recipe_dataset_service import get_production_recipe, production_recipe_select
from app.services.recipe_quantity_service import (
    canonical_requirement,
    pantry_lookup_for_names,
    requirement_status,
    soft_family_availability,
    soft_family_pantry_names_for_requirements,
)

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
def recipe_detail(
    recipe_id: int,
    db: Session = Depends(get_db),
    session_id: str = Depends(get_pantry_session_id),
):
    return route_response(
        lambda: _recipe_detail(db, recipe_id, session_id),
        db=db,
        default_error="Recipe detail failed",
    )


def _list_recipes(db: Session, limit: int) -> list[RecipeListOut]:
    rows = db.execute(production_recipe_select().limit(limit)).scalars().all()
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


def _recipe_detail(db: Session, recipe_id: int, session_id: str = "anonymous") -> RecipeDetailOut:
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

    ingredient_names = {ingredient.canonical_name for _, ingredient in ingredient_rows}
    pantry_available = pantry_lookup_for_names(
        db,
        ingredient_names | soft_family_pantry_names_for_requirements(ingredient_names),
        session_id,
    )

    required_ready_count = 0
    required_count = 0
    missing_required_ingredients: list[str] = []
    missing_optional_ingredients: list[str] = []
    required_quantity_confirmation_ingredients: list[str] = []
    optional_quantity_confirmation_ingredients: list[str] = []

    ingredients: list[RecipeIngredientOut] = []
    for recipe_ingredient, ingredient in ingredient_rows:
        required_quantity, required_unit = canonical_requirement(
            recipe_ingredient.required_quantity,
            recipe_ingredient.unit,
        )
        availability = pantry_available.get(ingredient.canonical_name)
        family_match = None if availability is not None else soft_family_availability(
            ingredient.canonical_name,
            pantry_available,
        )
        status = requirement_status(
            availability if family_match is None else family_match[1],
            required_quantity,
            required_unit,
            family_match_name=None if family_match is None else family_match[0],
        )
        label = recipe_ingredient.display_name or ingredient.canonical_name

        if recipe_ingredient.is_required:
            required_count += 1
            if status.is_satisfied:
                required_ready_count += 1
            elif status.needs_quantity_confirmation:
                required_quantity_confirmation_ingredients.append(label)
            else:
                missing_required_ingredients.append(label)
        elif not status.is_satisfied:
            if status.needs_quantity_confirmation:
                optional_quantity_confirmation_ingredients.append(label)
            else:
                missing_optional_ingredients.append(label)

        ingredients.append(
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
                pantry_status=(
                    "ready"
                    if status.is_satisfied
                    else "needs_quantity_confirmation"
                    if status.needs_quantity_confirmation
                    else "missing"
                ),
                pantry_quantity=status.pantry_quantity,
                pantry_unit=status.pantry_unit,
                pantry_quantity_is_known=status.pantry_quantity_is_known,
                pantry_has_enough=status.is_satisfied,
                pantry_match_kind=status.pantry_match_kind,
                pantry_matched_name=status.pantry_matched_name,
                pantry_note=status.pantry_note,
            )
        )

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
        primary_protein=recipe.primary_protein,
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
        readiness=RecipeReadinessOut(
            can_cook_now=(
                not missing_required_ingredients
                and not required_quantity_confirmation_ingredients
            ),
            required_ready_count=required_ready_count,
            required_count=required_count,
            missing_required_ingredients=missing_required_ingredients,
            missing_optional_ingredients=missing_optional_ingredients,
            required_quantity_confirmation_ingredients=required_quantity_confirmation_ingredients,
            optional_quantity_confirmation_ingredients=optional_quantity_confirmation_ingredients,
        ),
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
