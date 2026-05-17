from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.pantry_item import PantryItem
from app.services.unit_service import to_canonical


@dataclass(frozen=True)
class PantryAvailability:
    quantity: float | None
    unit: str | None
    quantity_is_known: bool
    source: str = "manual"


@dataclass(frozen=True)
class RequirementStatus:
    pantry_present: bool
    pantry_quantity: float | None
    pantry_unit: str | None
    pantry_quantity_is_known: bool | None
    is_satisfied: bool
    needs_quantity_confirmation: bool
    pantry_match_kind: str = "exact"
    pantry_matched_name: str | None = None
    pantry_note: str | None = None


GENERIC_CHEESE_PANTRY_NAME = "cheese"
GENERIC_CHEESE_SOFT_TARGETS = frozenset(
    {
        "cheddar",
        "mozzarella",
        "monterey jack",
        "swiss cheese",
        "provolone",
    }
)


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
    *,
    quantity_is_known: bool = True,
) -> bool:
    if not quantity_is_known:
        return False
    if available_quantity is None or available_unit is None:
        return False
    return available_unit == required_unit and available_quantity >= required_quantity


def units_are_comparable(available_unit: str | None, required_unit: str) -> bool:
    if available_unit is None:
        return False
    return available_unit == required_unit


def requirement_status(
    availability: PantryAvailability | None,
    required_quantity: float,
    required_unit: str,
    *,
    family_match_name: str | None = None,
) -> RequirementStatus:
    if availability is None:
        return RequirementStatus(
            pantry_present=False,
            pantry_quantity=None,
            pantry_unit=None,
            pantry_quantity_is_known=None,
            is_satisfied=False,
            needs_quantity_confirmation=False,
        )

    if family_match_name is not None:
        return RequirementStatus(
            pantry_present=True,
            pantry_quantity=None if not availability.quantity_is_known else availability.quantity,
            pantry_unit=None if not availability.quantity_is_known else availability.unit,
            pantry_quantity_is_known=availability.quantity_is_known,
            is_satisfied=False,
            needs_quantity_confirmation=True,
            pantry_match_kind="family",
            pantry_matched_name=family_match_name,
            pantry_note=(
                f"You have {family_match_name} saved. Confirm it works where this recipe "
                "prefers this cheese."
            ),
        )

    if not availability.quantity_is_known:
        return RequirementStatus(
            pantry_present=True,
            pantry_quantity=None,
            pantry_unit=None,
            pantry_quantity_is_known=False,
            is_satisfied=False,
            needs_quantity_confirmation=True,
        )

    units_match = units_are_comparable(availability.unit, required_unit)

    return RequirementStatus(
        pantry_present=True,
        pantry_quantity=availability.quantity,
        pantry_unit=availability.unit,
        pantry_quantity_is_known=True,
        is_satisfied=requirement_is_satisfied(
            availability.quantity,
            availability.unit,
            required_quantity,
            required_unit,
            quantity_is_known=True,
        ),
        needs_quantity_confirmation=not units_match,
    )


def pantry_lookup_for_names(
    db: Session,
    pantry_names: set[str],
    session_id: str = "anonymous",
) -> dict[str, PantryAvailability]:
    if not pantry_names:
        return {}

    rows = (
        db.query(
            Ingredient.canonical_name,
            PantryItem.quantity,
            PantryItem.unit,
            PantryItem.quantity_is_known,
            PantryItem.source,
        )
        .join(PantryItem, PantryItem.ingredient_id == Ingredient.id)
        .filter(Ingredient.canonical_name.in_(pantry_names))
        .filter(PantryItem.session_id == session_id)
        .all()
    )

    pantry_map: dict[str, PantryAvailability] = {}
    for canonical_name, quantity, unit, quantity_is_known, source in rows:
        if quantity_is_known:
            canonical_quantity, canonical_unit = canonical_pantry_amount(quantity, unit)
            pantry_map[canonical_name] = PantryAvailability(
                quantity=canonical_quantity,
                unit=canonical_unit,
                quantity_is_known=True,
                source=source or "manual",
            )
            continue

        pantry_map[canonical_name] = PantryAvailability(
            quantity=None,
            unit=None,
            quantity_is_known=False,
            source=source or "manual",
        )

    return pantry_map


def soft_family_pantry_names_for_requirement(ingredient_name: str) -> set[str]:
    if ingredient_name in GENERIC_CHEESE_SOFT_TARGETS:
        return {GENERIC_CHEESE_PANTRY_NAME}
    return set()


def soft_family_pantry_names_for_requirements(ingredient_names: set[str]) -> set[str]:
    names: set[str] = set()
    for ingredient_name in ingredient_names:
        names.update(soft_family_pantry_names_for_requirement(ingredient_name))
    return names


def soft_family_availability(
    ingredient_name: str,
    pantry_available: dict[str, PantryAvailability],
) -> tuple[str, PantryAvailability] | None:
    for pantry_name in sorted(soft_family_pantry_names_for_requirement(ingredient_name)):
        availability = pantry_available.get(pantry_name)
        if availability is not None:
            return pantry_name, availability
    return None
