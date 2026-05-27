from __future__ import annotations

from collections import Counter
from typing import Any

from app.schemas.external_recipe import ExternalRecipeCandidate, FilterMode
from app.services.pantry_feasibility_service import normalize_ingredient_label

FILTER_FAMILIES = {
    "cuisine_tags",
    "dish_type_tags",
    "flavor_tags",
    "sauce_tags",
    "method_tags",
    "ingredients",
    "used_ingredients",
    "missed_ingredients",
    "ready_minutes",
    "feasibility_bucket",
}

SELECTED_FILTER_FAMILIES = FILTER_FAMILIES - {"ready_minutes"}


def build_living_filter_counts(
    candidates: list[ExternalRecipeCandidate],
    mode: FilterMode = "cookable_tonight",
    selected_filters: dict[str, list[str]] | None = None,
) -> dict[str, Any]:
    filtered = apply_candidate_filters(candidates, selected_filters, mode)
    families: dict[str, list[dict[str, int | str]]] = {}
    for family in FILTER_FAMILIES:
        counter: Counter[str] = Counter()
        for candidate in filtered:
            counter.update(_candidate_values(candidate, family))
        families[family] = [
            {"value": value, "count": count}
            for value, count in sorted(counter.items(), key=lambda item: (-item[1], item[0]))
        ]
    return {
        "mode": mode,
        "selected_filters": _clean_selected_filters(selected_filters),
        "families": families,
    }


def apply_candidate_filters(
    candidates: list[ExternalRecipeCandidate],
    selected_filters: dict[str, list[str]] | None = None,
    mode: FilterMode = "all",
) -> list[ExternalRecipeCandidate]:
    mode_candidates = [candidate for candidate in candidates if _candidate_in_mode(candidate, mode)]
    cleaned = _clean_selected_filters(selected_filters)
    if not cleaned:
        return mode_candidates

    narrowed: list[ExternalRecipeCandidate] = []
    for candidate in mode_candidates:
        if all(_candidate_matches_family(candidate, family, values) for family, values in cleaned.items()):
            narrowed.append(candidate)
    return narrowed


def _candidate_in_mode(candidate: ExternalRecipeCandidate, mode: str) -> bool:
    bucket = candidate.feasibility_bucket
    if mode == "cookable_tonight":
        return bucket == "cookable_tonight"
    if mode == "almost_there":
        return bucket in {"cookable_tonight", "almost_there"}
    if mode in {"inspiration", "all"}:
        return bucket != "rejected"
    return bucket != "rejected"


def _candidate_matches_family(candidate: ExternalRecipeCandidate, family: str, selected_values: list[str]) -> bool:
    candidate_values = set(_candidate_values(candidate, family))
    selected = {_normalize_label(value, family) for value in selected_values}
    selected.discard("")
    if not selected:
        return True
    return bool(candidate_values & selected)


def _candidate_values(candidate: ExternalRecipeCandidate, family: str) -> list[str]:
    if family == "feasibility_bucket":
        return [candidate.feasibility_bucket] if candidate.feasibility_bucket else []
    if family == "ready_minutes":
        return [_ready_minutes_bucket(candidate.ready_minutes)] if candidate.ready_minutes is not None else []
    raw_values = getattr(candidate, family, [])
    if not isinstance(raw_values, list):
        return []
    return _dedupe_labels(raw_values, family)


def _clean_selected_filters(selected_filters: dict[str, list[str]] | None) -> dict[str, list[str]]:
    if not selected_filters:
        return {}
    cleaned: dict[str, list[str]] = {}
    for family, values in selected_filters.items():
        if family not in SELECTED_FILTER_FAMILIES or not isinstance(values, list):
            continue
        normalized_values = _dedupe_labels(values, family)
        if normalized_values:
            cleaned[family] = normalized_values
    return cleaned


def _dedupe_labels(values: list[str], family: str) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = _normalize_label(value, family)
        if normalized and normalized not in seen:
            deduped.append(normalized)
            seen.add(normalized)
    return deduped


def _normalize_label(value: str, family: str) -> str:
    if not isinstance(value, str):
        return ""
    normalized = " ".join(value.strip().casefold().split())
    if family in {"ingredients", "used_ingredients", "missed_ingredients"}:
        return normalize_ingredient_label(normalized)
    return normalized


def _ready_minutes_bucket(ready_minutes: int) -> str:
    if ready_minutes <= 20:
        return "20 minutes or less"
    if ready_minutes <= 30:
        return "30 minutes or less"
    if ready_minutes <= 45:
        return "45 minutes or less"
    return "over 45 minutes"
