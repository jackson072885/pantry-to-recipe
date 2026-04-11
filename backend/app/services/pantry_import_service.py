from __future__ import annotations

import re
from dataclasses import asdict, dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.ingredient_alias import IngredientAlias
from app.models.pantry_item import PantryItem
from app.schemas.pantry import PantryImportLineResult
from app.services.normalize_service import CANONICAL_ALIAS_MAP, normalize_text
from app.services.pantry_import_parser import ParsedPantryImportLine, parse_line
from app.services.pantry_service import add_item_no_commit, list_pantry
from app.services.unit_service import to_canonical

ACCEPTED = "accepted"
REVIEW = "review"
REJECTED = "rejected"
DEFAULT_IMPORT_AMOUNT = 1.0
DEFAULT_IMPORT_UNIT = "ea"
IMPORT_REASON = "bulk_import"
MULTI_ITEM_INGREDIENT_RE = re.compile(r"(?:\s&\s|\sand\s)", re.IGNORECASE)


@dataclass(frozen=True)
class PantryImportResolvedLine:
    raw_line: str
    cleaned_line: str
    status: str
    parsed_quantity: float | None
    parsed_unit: str | None
    parsed_ingredient_text: str | None
    canonical_unit: str | None
    canonical_ingredient: str | None
    reason_code: str
    reason_message: str

    def to_schema(self) -> PantryImportLineResult:
        return PantryImportLineResult(**asdict(self))


@dataclass(frozen=True)
class PantryImportPreview:
    results: list[PantryImportResolvedLine]

    @property
    def accepted_count(self) -> int:
        return sum(1 for row in self.results if row.status == ACCEPTED)

    @property
    def review_count(self) -> int:
        return sum(1 for row in self.results if row.status == REVIEW)

    @property
    def rejected_count(self) -> int:
        return sum(1 for row in self.results if row.status == REJECTED)


def preview_lines(db: Session, raw_lines: list[str]) -> PantryImportPreview:
    pantry_units = _load_existing_pantry_units(db)
    preview_results: list[PantryImportResolvedLine] = []
    pending_units = dict(pantry_units)

    for raw_line in raw_lines:
        result = _preview_single_line(db, raw_line, pending_units)
        preview_results.append(result)
        if result.status != ACCEPTED or result.canonical_ingredient is None:
            continue

        storage_unit = _storage_unit_for_result(result)
        if storage_unit is not None:
            pending_units[result.canonical_ingredient] = storage_unit

    return PantryImportPreview(results=preview_results)


def commit_lines(db: Session, raw_lines: list[str]) -> dict:
    preview = preview_lines(db, raw_lines)

    for result in preview.results:
        if result.status != ACCEPTED:
            continue

        add_item_no_commit(
            db,
            name=result.canonical_ingredient or "",
            amount=_storage_amount_for_result(result),
            unit=_storage_unit_for_result(result),
            reason=IMPORT_REASON,
        )

    db.commit()

    return {
        "results": [row.to_schema() for row in preview.results],
        "summary": _summary_dict(preview),
        "committed_count": preview.accepted_count,
        "items": list_pantry(db),
    }


def _preview_single_line(
    db: Session,
    raw_line: str,
    pending_units: dict[str, str],
) -> PantryImportResolvedLine:
    try:
        parsed = parse_line(raw_line)
    except ValueError as exc:
        return PantryImportResolvedLine(
            raw_line=raw_line,
            cleaned_line=_clean_fallback(raw_line),
            status=REJECTED,
            parsed_quantity=None,
            parsed_unit=None,
            parsed_ingredient_text=None,
            canonical_unit=None,
            canonical_ingredient=None,
            reason_code="line_not_parseable",
            reason_message=str(exc),
        )

    if not parsed.parsed_ingredient_text:
        return _resolved_line(
            parsed,
            status=REJECTED,
            reason_code="missing_ingredient",
            reason_message="Ingredient text is required",
        )

    resolved_ingredient = _resolve_existing_ingredient(db, parsed.parsed_ingredient_text)
    if resolved_ingredient is None:
        if _looks_like_multi_item_ingredient(parsed.parsed_ingredient_text):
            return _resolved_line(
                parsed,
                status=REJECTED,
                reason_code="multi_item_line",
                reason_message="Use one pantry item per line",
            )
        return _resolved_line(
            parsed,
            status=REVIEW,
            reason_code="ingredient_not_found",
            reason_message="Ingredient did not match an existing canonical ingredient or safe alias",
        )

    if parsed.parsed_unit is None:
        canonical_unit = None
    else:
        _, canonical_unit = to_canonical(parsed.parsed_quantity or 0.0, parsed.parsed_unit)

    incoming_storage_unit = _storage_unit_for_parsed_line(parsed)
    existing_unit = pending_units.get(resolved_ingredient)
    if existing_unit is not None and existing_unit != incoming_storage_unit:
        return _resolved_line(
            parsed,
            status=REJECTED,
            canonical_unit=canonical_unit,
            canonical_ingredient=resolved_ingredient,
            reason_code="unit_conflict",
            reason_message=(
                f"{resolved_ingredient} is already tracked in {existing_unit}, so this import line cannot safely use "
                f"{incoming_storage_unit}"
            ),
        )

    return _resolved_line(
        parsed,
        status=ACCEPTED,
        canonical_unit=canonical_unit,
        canonical_ingredient=resolved_ingredient,
        reason_code="accepted",
        reason_message="Line is safe to import",
    )


def _resolve_existing_ingredient(db: Session, ingredient_text: str) -> str | None:
    normalized = normalize_text(ingredient_text)
    if not normalized:
        return None

    canonical_candidate = CANONICAL_ALIAS_MAP.get(normalized, normalized)
    direct = db.execute(
        select(Ingredient.canonical_name)
        .where(Ingredient.canonical_name == canonical_candidate)
        .order_by(Ingredient.id.asc())
    ).scalars().first()
    if direct is not None:
        return normalize_text(direct)

    alias_matches = db.execute(
        select(Ingredient.canonical_name)
        .join(IngredientAlias, IngredientAlias.ingredient_id == Ingredient.id)
        .where(IngredientAlias.normalized_alias == normalized)
        .order_by(Ingredient.id.asc(), IngredientAlias.id.asc())
    ).scalars().all()
    distinct_matches = sorted({normalize_text(name) for name in alias_matches if name})
    if len(distinct_matches) != 1:
        return None
    return distinct_matches[0]


def _load_existing_pantry_units(db: Session) -> dict[str, str]:
    rows = db.execute(
        select(Ingredient.canonical_name, PantryItem.unit)
        .join(PantryItem, PantryItem.ingredient_id == Ingredient.id)
    ).all()
    return {normalize_text(name): unit for name, unit in rows if name and unit}


def _storage_amount_for_result(result: PantryImportResolvedLine) -> float:
    if result.parsed_quantity is None:
        return DEFAULT_IMPORT_AMOUNT
    return result.parsed_quantity


def _storage_unit_for_result(result: PantryImportResolvedLine) -> str | None:
    if result.parsed_quantity is None:
        return DEFAULT_IMPORT_UNIT
    return result.parsed_unit


def _storage_unit_for_parsed_line(parsed: ParsedPantryImportLine) -> str:
    if parsed.parsed_quantity is None:
        return DEFAULT_IMPORT_UNIT
    _, canonical_unit = to_canonical(parsed.parsed_quantity, parsed.parsed_unit)
    return canonical_unit


def _resolved_line(
    parsed: ParsedPantryImportLine,
    *,
    status: str,
    reason_code: str,
    reason_message: str,
    canonical_unit: str | None = None,
    canonical_ingredient: str | None = None,
) -> PantryImportResolvedLine:
    return PantryImportResolvedLine(
        raw_line=parsed.raw_line,
        cleaned_line=parsed.cleaned_line,
        status=status,
        parsed_quantity=parsed.parsed_quantity,
        parsed_unit=parsed.parsed_unit,
        parsed_ingredient_text=parsed.parsed_ingredient_text,
        canonical_unit=canonical_unit,
        canonical_ingredient=canonical_ingredient,
        reason_code=reason_code,
        reason_message=reason_message,
    )


def _clean_fallback(raw_line: str) -> str:
    return " ".join((raw_line or "").strip().split())


def _looks_like_multi_item_ingredient(ingredient_text: str | None) -> bool:
    if not ingredient_text:
        return False
    return MULTI_ITEM_INGREDIENT_RE.search(ingredient_text) is not None


def _summary_dict(preview: PantryImportPreview) -> dict[str, int]:
    return {
        "line_count": len(preview.results),
        "accepted_count": preview.accepted_count,
        "review_count": preview.review_count,
        "rejected_count": preview.rejected_count,
    }
