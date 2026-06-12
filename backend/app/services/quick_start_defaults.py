from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.services.normalize_service import normalize_text
from app.services.unit_service import to_canonical


@dataclass(frozen=True)
class QuickStartMealFloor:
    key: str
    aliases: frozenset[str]
    quantity: float | None
    unit: str | None
    staple_assumption: bool = False

    def covers(self, required_quantity: float, required_unit: str) -> bool:
        if self.staple_assumption:
            return True
        if self.quantity is None or self.unit is None:
            return False
        canonical_required_quantity, canonical_required_unit = to_canonical(required_quantity, required_unit)
        return canonical_required_unit == self.unit and canonical_required_quantity <= self.quantity


@dataclass(frozen=True)
class QuickStartMealFloorIndex:
    by_alias: dict[str, QuickStartMealFloor]

    def match(self, name: str | None) -> QuickStartMealFloor | None:
        normalized = normalize_text(name)
        if not normalized:
            return None
        return self.by_alias.get(normalized)


def _data_path() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "quick_start_meal_floors.json"


@lru_cache(maxsize=1)
def quick_start_meal_floor_index() -> QuickStartMealFloorIndex:
    payload = json.loads(_data_path().read_text(encoding="utf-8"))
    by_alias: dict[str, QuickStartMealFloor] = {}

    for row in payload.get("profiles", []):
        aliases = frozenset(
            normalized
            for normalized in (normalize_text(value) for value in row.get("aliases", []))
            if normalized
        )
        quantity = row.get("quantity")
        unit = row.get("unit")
        canonical_quantity = None
        canonical_unit = None
        if quantity is not None and unit is not None:
            canonical_quantity, canonical_unit = to_canonical(float(quantity), str(unit))

        floor = QuickStartMealFloor(
            key=str(row["key"]).strip().lower(),
            aliases=aliases,
            quantity=canonical_quantity,
            unit=canonical_unit,
            staple_assumption=bool(row.get("staple_assumption", False)),
        )
        for alias in floor.aliases:
            by_alias[alias] = floor

    return QuickStartMealFloorIndex(by_alias=by_alias)
