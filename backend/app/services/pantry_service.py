from __future__ import annotations

import math

from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.ingredient_alias import IngredientAlias
from app.models.pantry_item import PantryItem
from app.models.pantry_transaction import PantryTransaction
from app.services.normalize_service import normalize_item
from app.services.unit_service import compatible_units, normalize_unit, to_canonical

QUANTITY_EPSILON = 1e-6


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


def _describe_unit(raw: str | None) -> str:
    return (raw or "ea").strip().lower() or "ea"


def _unit_mismatch_message(*, action: str, ingredient_name: str, pantry_unit: str, attempted_unit: str | None) -> str:
    family = normalize_unit(pantry_unit).family
    supported = ", ".join(compatible_units(pantry_unit))
    requested = _describe_unit(attempted_unit)
    return (
        f"Can't {action} {ingredient_name} with \"{requested}\" because your pantry currently tracks it in "
        f"\"{pantry_unit}\". Use a compatible {family} unit ({supported}). If you meant to restart this ingredient "
        "in a different unit, remove the current row first."
    )


def _validated_amount(amount: float) -> float:
    numeric_amount = float(amount)
    if not math.isfinite(numeric_amount):
        raise ValueError("Amount must be a finite number")
    if numeric_amount <= 0:
        raise ValueError("Amount must be greater than 0")
    return numeric_amount


def _canonical_amount(amount: float, unit: str | None) -> tuple[float, str]:
    normalized_amount = _validated_amount(amount)
    canonical_amount, canonical_unit = to_canonical(normalized_amount, unit)
    return round(canonical_amount, 6), canonical_unit


# -------------------------------------------------------
# Public API
# -------------------------------------------------------

def add_item_no_commit(
    db: Session,
    name: str,
    amount: float = 1,
    unit: str | None = None,
    reason: str = "manual",
) -> None:
    ing = _get_or_create_ingredient(db, name)
    pantry = db.query(PantryItem).filter_by(ingredient_id=ing.id).first()
    canonical_amount, canonical_unit = _canonical_amount(amount, unit)

    if not pantry:
        pantry = PantryItem(
            ingredient_id=ing.id,
            quantity=0,
            unit=canonical_unit,
            quantity_is_known=True,
        )
        db.add(pantry)
    elif not pantry.quantity_is_known:
        pantry.quantity = 0
        pantry.unit = canonical_unit
        pantry.quantity_is_known = True
    elif pantry.unit != canonical_unit:
        raise ValueError(
            _unit_mismatch_message(
                action="add",
                ingredient_name=ing.canonical_name,
                pantry_unit=pantry.unit,
                attempted_unit=unit,
            )
        )

    pantry.quantity += canonical_amount
    pantry.quantity = round(pantry.quantity, 6)

    db.add(PantryTransaction(
        ingredient_id=ing.id,
        change=canonical_amount,
        unit=canonical_unit,
        reason=reason,
    ))


def add_presence_only_item_no_commit(
    db: Session,
    name: str,
) -> None:
    ing = _get_or_create_ingredient(db, name)
    pantry = db.query(PantryItem).filter_by(ingredient_id=ing.id).first()

    if pantry is None:
        pantry = PantryItem(
            ingredient_id=ing.id,
            quantity=1.0,
            unit="ea",
            quantity_is_known=False,
        )
        db.add(pantry)
        return

    if pantry.quantity_is_known:
        return

    pantry.quantity = 1.0
    pantry.unit = "ea"
    pantry.quantity_is_known = False


def add_item(db: Session, name: str, amount: float = 1, unit: str | None = None, reason: str = "manual") -> None:
    add_item_no_commit(db, name, amount, unit, reason)

    db.commit()


def remove_item(db: Session, name: str, amount: float = 1, unit: str | None = None, reason: str = "manual") -> None:
    normalized = _normalize_name(db, name)
    ing = _find_ingredient(db, normalized)
    if not ing:
        return

    pantry = db.query(PantryItem).filter_by(ingredient_id=ing.id).first()
    if pantry is None:
        return
    if not pantry.quantity_is_known:
        db.delete(pantry)
        db.commit()
        return
    if pantry.quantity <= 0:
        return

    canonical_amount, canonical_unit = _canonical_amount(amount, unit)
    if pantry.unit != canonical_unit:
        raise ValueError(
            _unit_mismatch_message(
                action="remove",
                ingredient_name=ing.canonical_name,
                pantry_unit=pantry.unit,
                attempted_unit=unit,
            )
        )

    remaining_quantity = round(max(0.0, pantry.quantity - canonical_amount), 6)
    if remaining_quantity <= QUANTITY_EPSILON:
        db.delete(pantry)
    else:
        pantry.quantity = remaining_quantity

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
            "quantity": item.quantity if item.quantity_is_known else None,
            "unit": item.unit if item.quantity_is_known else None,
            "quantity_is_known": bool(item.quantity_is_known),
            "use_soon": bool(item.use_soon),
        }
        for item in items
        if item.quantity > 0 or not item.quantity_is_known
    ]

    return sorted(results, key=lambda item: item["ingredient"])


def clear_pantry(db: Session) -> int:
    cleared_count = db.query(PantryItem).count()
    if cleared_count == 0:
        return 0

    db.query(PantryItem).delete(synchronize_session=False)
    db.commit()
    return cleared_count


def set_use_soon(db: Session, name: str, use_soon: bool) -> None:
    normalized = _normalize_name(db, name)
    ing = _find_ingredient(db, normalized)
    if ing is None:
        raise ValueError(f"{normalized} is not in your pantry")

    pantry = db.query(PantryItem).filter_by(ingredient_id=ing.id).first()
    if pantry is None:
        raise ValueError(f"{normalized} is not in your pantry")

    if pantry.quantity_is_known and pantry.quantity <= 0:
        raise ValueError(f"{normalized} is not in your pantry")

    pantry.use_soon = bool(use_soon)
    db.commit()
