from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.pantry_item import PantryItem
from app.models.pantry_transaction import PantryTransaction
from app.models.recipe import Recipe, RecipeIngredient


def cook_recipe(db: Session, recipe_id: int) -> dict:
    recipe = db.get(Recipe, recipe_id)
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

    missing: list[str] = []

    pantry_by_ing = {
        item.ingredient_id: item
        for item in db.query(PantryItem).filter(
            PantryItem.ingredient_id.in_([ing.id for _, ing in required])
        )
    }

    for _, ing in required:
        pantry_item = pantry_by_ing.get(ing.id)
        if not pantry_item or pantry_item.quantity < 1:
            missing.append(ing.canonical_name)

    if missing:
        raise ValueError(f"Missing required ingredients: {', '.join(sorted(missing))}")

    deducted: list[str] = []
    for _, ing in required:
        pantry_item = pantry_by_ing[ing.id]
        pantry_item.quantity -= 1
        deducted.append(ing.canonical_name)
        db.add(PantryTransaction(
            ingredient_id=ing.id,
            change=-1,
            reason=f"cook:{recipe_id}",
        ))

    db.commit()

    return {
        "recipe_id": recipe.id,
        "recipe_name": recipe.name,
        "deducted": sorted(deducted),
    }
