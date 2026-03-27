from __future__ import annotations

from sqlalchemy import Select, exists, select
from sqlalchemy.orm import Query, Session

from app.models.recipe import Recipe, RecipeIngredient

ARCHIVE_PREFIX = "[ARCHIVED:"


def active_recipe_query(db: Session) -> Query:
    return db.query(Recipe).filter(_active_recipe_condition())


def active_recipe_select() -> Select:
    return select(Recipe).where(_active_recipe_condition())


def get_active_recipe(db: Session, recipe_id: int) -> Recipe | None:
    return active_recipe_query(db).filter(Recipe.id == recipe_id).first()


def active_recipe_ingredient_rows(db: Session):
    return (
        db.query(RecipeIngredient.recipe_id)
        .join(Recipe, Recipe.id == RecipeIngredient.recipe_id)
        .filter(_active_recipe_condition())
    )


def archive_incomplete_active_recipes(db: Session) -> dict:
    active_recipes = active_recipe_query(db).order_by(Recipe.id.asc()).all()
    archived: list[dict] = []

    for recipe in active_recipes:
        reason = _incomplete_reason(db, recipe)
        if not reason:
            continue
        original_name = recipe.name
        recipe.name = f"{ARCHIVE_PREFIX}{recipe.id}] {original_name}"
        archived.append(
            {
                "recipe_id": recipe.id,
                "original_name": original_name,
                "reason": reason,
            }
        )

    if archived:
        db.commit()

    return {
        "archived_count": len(archived),
        "archived": archived,
    }


def validate_active_recipes(db: Session) -> dict:
    active_recipes = active_recipe_query(db).order_by(Recipe.id.asc()).all()
    invalid: list[dict] = []
    for recipe in active_recipes:
        reason = _incomplete_reason(db, recipe)
        if reason:
            invalid.append(
                {
                    "recipe_id": recipe.id,
                    "recipe_name": recipe.name,
                    "reason": reason,
                }
            )

    return {
        "active_count": len(active_recipes),
        "invalid_count": len(invalid),
        "invalid": invalid,
    }


def _active_recipe_condition():
    return ~Recipe.name.like(f"{ARCHIVE_PREFIX}%")


def _has_any_ingredient(db: Session, recipe_id: int) -> bool:
    return db.query(
        exists().where(RecipeIngredient.recipe_id == recipe_id)
    ).scalar()


def _incomplete_reason(db: Session, recipe: Recipe) -> str | None:
    if not (recipe.instructions or "").strip():
        return "missing_instructions"
    if not _has_any_ingredient(db, recipe.id):
        return "missing_ingredients"
    return None
