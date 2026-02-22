from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.ingredient_alias import IngredientAlias
from app.models.pantry_item import PantryItem
from app.models.pantry_transaction import PantryTransaction
from app.services.normalize_service import normalize_item


# -------------------------------------------------------
# Helpers
# -------------------------------------------------------

def _normalize_name(name: str) -> str:
    normalized = normalize_item(name)
    if not normalized:
        raise ValueError("Ingredient name is required")
    return normalized


def _find_ingredient(db: Session, name: str) -> Ingredient | None:
    name = name.strip().lower()

    # canonical match
    ing = db.query(Ingredient).filter(Ingredient.canonical_name.ilike(name)).first()
    if ing:
        return ing

    # alias match
    alias = db.query(IngredientAlias).filter(IngredientAlias.alias.ilike(name)).first()
    if alias:
        return db.get(Ingredient, alias.ingredient_id)

    return None


def _get_or_create_ingredient(db: Session, name: str) -> Ingredient:
    normalized = _normalize_name(name)
    ing = _find_ingredient(db, normalized)
    if ing:
        return ing

    ing = Ingredient(canonical_name=normalized)
    db.add(ing)
    db.flush()
    return ing


# -------------------------------------------------------
# Public API
# -------------------------------------------------------

def add_item(db: Session, name: str, amount: int = 1, reason: str = "manual") -> dict:
    if amount < 1:
        raise ValueError("Amount must be at least 1")

    ing = _get_or_create_ingredient(db, name)
    pantry = db.query(PantryItem).filter_by(ingredient_id=ing.id).first()

    if not pantry:
        pantry = PantryItem(ingredient_id=ing.id, quantity=0)
        db.add(pantry)

    pantry.quantity += amount

    db.add(PantryTransaction(
        ingredient_id=ing.id,
        change=amount,
        reason=reason
    ))

    db.commit()
    return {
        "status": "added",
        "item": {"ingredient": ing.canonical_name, "quantity": pantry.quantity},
    }


def remove_item(db: Session, name: str, amount: int = 1, reason: str = "manual") -> dict:
    if amount < 1:
        raise ValueError("Amount must be at least 1")

    normalized = _normalize_name(name)
    ing = _find_ingredient(db, normalized)
    if not ing:
        raise ValueError(f"Unknown ingredient: {normalized}")

    pantry = db.query(PantryItem).filter_by(ingredient_id=ing.id).first()
    if not pantry or pantry.quantity <= 0:
        raise ValueError("Item not in pantry")

    pantry.quantity = max(0, pantry.quantity - amount)

    db.add(PantryTransaction(
        ingredient_id=ing.id,
        change=-amount,
        reason=reason
    ))

    db.commit()
    return {
        "status": "removed",
        "item": {"ingredient": ing.canonical_name, "quantity": pantry.quantity},
    }


def list_pantry(db: Session) -> list[dict]:
    items = db.query(PantryItem).all()

    return [
        {
            "ingredient": item.ingredient.canonical_name,
            "quantity": item.quantity
        }
        for item in items
        if item.quantity > 0
    ]
