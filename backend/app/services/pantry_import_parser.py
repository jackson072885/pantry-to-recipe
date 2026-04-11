from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.unit_service import normalize_unit

QUANTITY_PATTERN = r"(?:\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?)"
LEADING_QUANTITY_RE = re.compile(rf"^(?P<quantity>{QUANTITY_PATTERN})(?:\s+(?P<remainder>.+))?$")
FRACTION_RE = re.compile(r"^(?P<numerator>\d+)/(?P<denominator>\d+)$")
DECIMAL_RE = re.compile(r"^\d+(?:\.\d+)?$")
INTEGER_RE = re.compile(r"^\d+$")
MIXED_FRACTION_RE = re.compile(r"^(?P<whole>\d+)\s+(?P<numerator>\d+)/(?P<denominator>\d+)$")
SPELLED_NUMBER_PREFIX_RE = re.compile(
    r"^(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten)\b",
    re.IGNORECASE,
)
RANGE_RE = re.compile(r"^\d+(?:\.\d+)?\s*(?:-|to)\s*\d+(?:\.\d+)?\b", re.IGNORECASE)
MULTI_ITEM_RE = re.compile(r"\s*,\s*")
NOTE_PREFIX_RE = re.compile(
    r"^(?:buy|get|grab|pick up|leftover|use up|cook|make|need)\b",
    re.IGNORECASE,
)

PACKAGING_UNITS = {
    "bag",
    "bags",
    "package",
    "packages",
    "pack",
    "packs",
    "bottle",
    "bottles",
    "box",
    "boxes",
    "carton",
    "cartons",
    "container",
    "containers",
    "jar",
    "jars",
    "can",
    "cans",
}
VAGUE_QUANTITY_PREFIXES = ("some ", "few ", "a few ", "several ", "many ")


@dataclass(frozen=True)
class ParsedPantryImportLine:
    raw_line: str
    cleaned_line: str
    parsed_quantity: float | None
    parsed_unit: str | None
    parsed_ingredient_text: str | None


def clean_line(raw_line: str) -> str:
    return " ".join((raw_line or "").strip().split())


def parse_line(raw_line: str) -> ParsedPantryImportLine:
    cleaned_line = clean_line(raw_line)
    if not cleaned_line:
        raise ValueError("Empty lines cannot be imported")

    lowered = cleaned_line.lower()
    if MULTI_ITEM_RE.search(cleaned_line):
        raise ValueError("Use one pantry item per line")
    if NOTE_PREFIX_RE.match(lowered):
        raise ValueError("Notes or instructions are not valid pantry lines")
    if RANGE_RE.match(lowered):
        raise ValueError("Ranges are not supported")
    if SPELLED_NUMBER_PREFIX_RE.match(cleaned_line):
        raise ValueError("Spell-out quantities are not supported")
    if any(lowered.startswith(prefix) for prefix in VAGUE_QUANTITY_PREFIXES):
        raise ValueError("Vague quantities are not supported")

    quantity_match = LEADING_QUANTITY_RE.match(cleaned_line)
    if quantity_match is None:
        return ParsedPantryImportLine(
            raw_line=raw_line,
            cleaned_line=cleaned_line,
            parsed_quantity=None,
            parsed_unit=None,
            parsed_ingredient_text=cleaned_line,
        )

    parsed_quantity = _parse_quantity_token(quantity_match.group("quantity"))
    remainder = (quantity_match.group("remainder") or "").strip()
    if not remainder:
        raise ValueError("Ingredient text is required after the quantity")

    parts = remainder.split(" ", 1)
    unit_candidate = parts[0].lower()
    ingredient_text = remainder
    parsed_unit: str | None = None

    if unit_candidate in PACKAGING_UNITS:
        raise ValueError("Packaging units are too ambiguous for import")

    try:
        normalize_unit(unit_candidate)
    except ValueError:
        ingredient_text = remainder
    else:
        parsed_unit = unit_candidate
        ingredient_text = parts[1].strip() if len(parts) > 1 else ""
        if not ingredient_text:
            raise ValueError("Ingredient text is required after the unit")

    if not ingredient_text:
        raise ValueError("Ingredient text is required")

    return ParsedPantryImportLine(
        raw_line=raw_line,
        cleaned_line=cleaned_line,
        parsed_quantity=parsed_quantity,
        parsed_unit=parsed_unit,
        parsed_ingredient_text=ingredient_text,
    )


def _parse_quantity_token(token: str) -> float:
    mixed_match = MIXED_FRACTION_RE.fullmatch(token)
    if mixed_match is not None:
        whole = float(mixed_match.group("whole"))
        fraction = _parse_fraction(
            mixed_match.group("numerator"),
            mixed_match.group("denominator"),
        )
        return whole + fraction

    fraction_match = FRACTION_RE.fullmatch(token)
    if fraction_match is not None:
        return _parse_fraction(
            fraction_match.group("numerator"),
            fraction_match.group("denominator"),
        )

    if INTEGER_RE.fullmatch(token) or DECIMAL_RE.fullmatch(token):
        value = float(token)
        if value <= 0:
            raise ValueError("Quantity must be greater than 0")
        return value

    raise ValueError("Quantity format is not supported")


def _parse_fraction(numerator_text: str, denominator_text: str) -> float:
    numerator = int(numerator_text)
    denominator = int(denominator_text)
    if denominator == 0:
        raise ValueError("Fractions must have a non-zero denominator")

    value = numerator / denominator
    if value <= 0:
        raise ValueError("Quantity must be greater than 0")
    return value
