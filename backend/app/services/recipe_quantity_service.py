from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.pantry_item import PantryItem
from app.services.unit_service import to_canonical


def canonical_requirement(quantity: float | None, unit: str | None) -> tuple[float, str]:
    amount = float(quantity) if quantity is not None else 1.0
    return to_canonical(amount, unit)


def canonical_pantry_amount(quantity: float, unit: str | None) -> tuple[float, str]:
    return to_canonical(float(quantity), unit)


def requirement_is_satisfied(
    available_quantity: float | None,
    available_unit: str | None,
    required_quantity: float,
    required_unit: str,
) -> bool:
    if available_quantity is None or available_unit is None:
        return False
    return available_unit == required_unit and available_quantity >= required_quantity


def pantry_lookup_for_names(db: Session, pantry_names: set[str]) -> dict[str, tuple[float, str]]:
    if not pantry_names:
        return {}

    rows = (
        db.query(Ingredient.canonical_name, PantryItem.quantity, PantryItem.unit)
        .join(PantryItem, PantryItem.ingredient_id == Ingredient.id)
        .filter(Ingredient.canonical_name.in_(pantry_names))
        .all()
    )

    pantry_map: dict[str, tuple[float, str]] = {}
    for canonical_name, quantity, unit in rows:
        pantry_map[canonical_name] = canonical_pantry_amount(quantity, unit)

    return pantry_map
