from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.ingredient_alias import IngredientAlias
from app.models.pantry_item import PantryItem
from app.models.pantry_transaction import PantryTransaction
from app.services.normalize_service import normalize_item
from app.services.unit_service import to_canonical


# -------------------------------------------------------
# Helpers
# -------------------------------------------------------

def _normalize_name(db: Session, name: str) -> str:
    normalized = normalize_item(name, db)
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
    normalized = _normalize_name(db, name)
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

def add_item(db: Session, name: str, amount: float = 1, unit: str | None = None, reason: str = "manual") -> None:
    if amount < 1:
        raise ValueError("Amount must be at least 1")

    ing = _get_or_create_ingredient(db, name)
    pantry = db.query(PantryItem).filter_by(ingredient_id=ing.id).first()
    canonical_amount, canonical_unit = to_canonical(float(amount), unit)

    if not pantry:
        pantry = PantryItem(ingredient_id=ing.id, quantity=0, unit=canonical_unit)
        db.add(pantry)
    elif pantry.unit != canonical_unit:
        raise ValueError(f"Unit mismatch for {ing.canonical_name}: pantry has {pantry.unit}, got {canonical_unit}")

    pantry.quantity += canonical_amount

    db.add(PantryTransaction(
        ingredient_id=ing.id,
        change=canonical_amount,
        unit=canonical_unit,
        reason=reason,
    ))

    db.commit()


def remove_item(db: Session, name: str, amount: float = 1, unit: str | None = None, reason: str = "manual") -> None:
    if amount < 1:
        raise ValueError("Amount must be at least 1")

    normalized = _normalize_name(db, name)
    ing = _find_ingredient(db, normalized)
    if not ing:
        return

    pantry = db.query(PantryItem).filter_by(ingredient_id=ing.id).first()
    if not pantry or pantry.quantity <= 0:
        return

    canonical_amount, canonical_unit = to_canonical(float(amount), unit)
    if pantry.unit != canonical_unit:
        raise ValueError(f"Unit mismatch for {ing.canonical_name}: pantry has {pantry.unit}, got {canonical_unit}")

    pantry.quantity = max(0, pantry.quantity - canonical_amount)

    db.add(PantryTransaction(
        ingredient_id=ing.id,
        change=-canonical_amount,
        unit=canonical_unit,
        reason=reason,
    ))

    db.commit()


def list_pantry(db: Session) -> list[dict]:
    items = db.query(PantryItem).all()

    results = [
        {
            "ingredient": item.ingredient.canonical_name,
            "quantity": item.quantity,
            "unit": item.unit,
        }
        for item in items
        if item.quantity > 0
    ]

    return sorted(results, key=lambda item: item["ingredient"])
