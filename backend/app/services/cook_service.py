from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.pantry_item import PantryItem
from app.models.pantry_transaction import PantryTransaction
from app.models.recipe import RecipeIngredient
from app.services.recipe_dataset_service import get_production_recipe
from app.services.recipe_quantity_service import (
    canonical_pantry_amount,
    canonical_requirement,
    pantry_lookup_for_names,
    requirement_status,
    requirement_is_satisfied,
)


def cook_recipe(db: Session, recipe_id: int, session_id: str = "anonymous") -> dict:
    recipe = get_production_recipe(db, recipe_id)
    if not recipe:
        raise ValueError("Recipe not found")

    rows = (
        db.query(RecipeIngredient, Ingredient)
        .join(Ingredient, Ingredient.id == RecipeIngredient.ingredient_id)
        .filter(RecipeIngredient.recipe_id == recipe_id)
        .all()
    )

    required = [
        (ri, ing)
        for ri, ing in rows
        if ri.is_required
    ]

    if not required:
        raise ValueError("Recipe has no required ingredients")

    pantry_by_ing = {
        item.ingredient_id: item
        for item in db.query(PantryItem).filter(
            PantryItem.session_id == session_id,
            PantryItem.ingredient_id.in_([ing.id for _, ing in required])
        )
    }
    pantry_available = pantry_lookup_for_names(
        db,
        {ing.canonical_name for _, ing in required},
        session_id,
    )

    requirement_map: dict[int, tuple[float, str]] = {}
    missing: list[str] = []
    for ri, ing in required:
        required_quantity, required_unit = canonical_requirement(ri.required_quantity, ri.unit)
        requirement_map[ing.id] = (required_quantity, required_unit)
        status = requirement_status(
            pantry_available.get(ing.canonical_name),
            required_quantity,
            required_unit,
        )
        if not status.is_satisfied:
            missing.append(ing.canonical_name)

    if missing:
        raise ValueError(f"Missing required ingredients: {', '.join(sorted(missing))}")

    deducted: list[str] = []
    deductions: list[dict] = []
    for _, ing in required:
        pantry_item = pantry_by_ing[ing.id]
        required_quantity, required_unit = requirement_map[ing.id]
        pantry_item.quantity -= required_quantity
        deducted.append(ing.canonical_name)
        deductions.append({
            "ingredient": ing.canonical_name,
            "quantity": required_quantity,
            "unit": required_unit,
        })
        db.add(PantryTransaction(
            session_id=session_id,
            ingredient_id=ing.id,
            change=-required_quantity,
            unit=required_unit,
            reason=f"cook:{recipe_id}",
        ))

    db.commit()

    return {
        "recipe_id": recipe.id,
        "recipe_name": recipe.name,
        "deducted": sorted(deducted),
        "deductions": sorted(deductions, key=lambda row: row["ingredient"]),
    }
