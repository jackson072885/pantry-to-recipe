from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class UnitSpec:
    canonical: str
    multiplier: float
    family: str


_UNIT_MAP: dict[str, UnitSpec] = {
    # Count
    "ea": UnitSpec("ea", 1.0, "count"),
    "each": UnitSpec("ea", 1.0, "count"),
    "piece": UnitSpec("ea", 1.0, "count"),
    "pieces": UnitSpec("ea", 1.0, "count"),
    "pcs": UnitSpec("ea", 1.0, "count"),
    # Weight
    "g": UnitSpec("g", 1.0, "weight"),
    "gram": UnitSpec("g", 1.0, "weight"),
    "grams": UnitSpec("g", 1.0, "weight"),
    "kg": UnitSpec("g", 1000.0, "weight"),
    "kilogram": UnitSpec("g", 1000.0, "weight"),
    "kilograms": UnitSpec("g", 1000.0, "weight"),
    "oz": UnitSpec("g", 28.3495, "weight"),
    "ounce": UnitSpec("g", 28.3495, "weight"),
    "ounces": UnitSpec("g", 28.3495, "weight"),
    "lb": UnitSpec("g", 453.592, "weight"),
    "pound": UnitSpec("g", 453.592, "weight"),
    "pounds": UnitSpec("g", 453.592, "weight"),
    # Volume
    "ml": UnitSpec("ml", 1.0, "volume"),
    "milliliter": UnitSpec("ml", 1.0, "volume"),
    "milliliters": UnitSpec("ml", 1.0, "volume"),
    "l": UnitSpec("ml", 1000.0, "volume"),
    "liter": UnitSpec("ml", 1000.0, "volume"),
    "liters": UnitSpec("ml", 1000.0, "volume"),
    "tsp": UnitSpec("ml", 5.0, "volume"),
    "teaspoon": UnitSpec("ml", 5.0, "volume"),
    "teaspoons": UnitSpec("ml", 5.0, "volume"),
    "tbsp": UnitSpec("ml", 15.0, "volume"),
    "tablespoon": UnitSpec("ml", 15.0, "volume"),
    "tablespoons": UnitSpec("ml", 15.0, "volume"),
    "cup": UnitSpec("ml", 240.0, "volume"),
    "cups": UnitSpec("ml", 240.0, "volume"),
}

_FAMILY_OPTIONS: dict[str, list[str]] = {
    "count": ["ea", "each"],
    "weight": ["g", "kg", "oz", "lb"],
    "volume": ["ml", "l", "tsp", "tbsp", "cup"],
}


def normalize_unit(raw: str | None) -> UnitSpec:
    if not raw:
        return _UNIT_MAP["ea"]

    key = raw.strip().lower()
    if key in _UNIT_MAP:
        return _UNIT_MAP[key]

    # allow plural "s" fallback
    if key.endswith("s") and key[:-1] in _UNIT_MAP:
        return _UNIT_MAP[key[:-1]]

    raise ValueError(f"Unsupported unit: {raw}")


def to_canonical(amount: float, unit: str | None) -> tuple[float, str]:
    spec = normalize_unit(unit)
    return amount * spec.multiplier, spec.canonical


def compatible_units(unit: str | None) -> list[str]:
    spec = normalize_unit(unit)
    return _FAMILY_OPTIONS.get(spec.family, [spec.canonical])
