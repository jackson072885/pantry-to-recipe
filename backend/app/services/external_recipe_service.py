from __future__ import annotations

from collections.abc import Mapping
import logging
from typing import Any

import httpx

from app.core.config import settings
from app.schemas.external_recipe import ExternalRecipeCandidate, ExternalRecipeSearchResult, FilterMode
from app.services.living_filter_service import apply_candidate_filters, build_living_filter_counts
from app.services.pantry_feasibility_service import score_candidates_feasibility

logger = logging.getLogger(__name__)

DEFAULT_LIMIT = 10
MAX_LIMIT = 25
SPOONACULAR_FIND_BY_INGREDIENTS_URL = "https://api.spoonacular.com/recipes/findByIngredients"
SCORING_VERSION = "external_candidate_v1"


def search_external_recipes_by_ingredients(
    ingredients: list[str],
    preferences: dict | None = None,
    limit: int = DEFAULT_LIMIT,
    selected_filters: dict[str, list[str]] | None = None,
    filter_mode: FilterMode = "cookable_tonight",
) -> ExternalRecipeSearchResult:
    normalized_ingredients = _normalize_input_ingredients(ingredients)
    safe_limit = _safe_limit(limit)
    provider = _configured_provider()

    if provider == "disabled":
        return ExternalRecipeSearchResult(provider="disabled", provider_status="disabled")

    if not normalized_ingredients:
        return ExternalRecipeSearchResult(provider=provider, provider_status="configured")

    if provider == "spoonacular":
        if not settings.spoonacular_api_key.strip():
            return ExternalRecipeSearchResult(provider=provider, provider_status="missing_api_key")

        try:
            payload = _fetch_spoonacular_candidates(normalized_ingredients, safe_limit)
            candidates = score_candidates_feasibility(
                _normalize_spoonacular_candidates(payload),
                normalized_ingredients,
                preferences or {},
            )
            return _ranked_result(provider, candidates, selected_filters, filter_mode)
        except Exception as exc:
            logger.warning("External recipe provider failed: provider=%s error=%s", provider, exc)
            return ExternalRecipeSearchResult(
                provider=provider,
                provider_status="error",
                error_message="External recipe provider failed",
            )

    return ExternalRecipeSearchResult(
        provider=provider,
        provider_status="error",
        error_message=f"Unsupported external recipe provider: {provider}",
    )


def _normalize_input_ingredients(ingredients: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for ingredient in ingredients:
        if not isinstance(ingredient, str):
            continue
        value = " ".join(ingredient.strip().split())
        key = value.casefold()
        if value and key not in seen:
            normalized.append(value)
            seen.add(key)
    return normalized


def _safe_limit(limit: int) -> int:
    try:
        parsed = int(limit)
    except (TypeError, ValueError):
        parsed = DEFAULT_LIMIT
    return max(1, min(parsed, MAX_LIMIT))


def _configured_provider() -> str:
    provider = (settings.external_recipe_provider or "disabled").strip().casefold()
    return provider or "disabled"


def _fetch_spoonacular_candidates(ingredients: list[str], limit: int) -> list[dict[str, Any]]:
    params = {
        "apiKey": settings.spoonacular_api_key,
        "ingredients": ",".join(ingredients),
        "number": limit,
        "ranking": 1,
        "ignorePantry": False,
    }
    with httpx.Client(timeout=8.0) as client:
        response = client.get(SPOONACULAR_FIND_BY_INGREDIENTS_URL, params=params)
        response.raise_for_status()
        payload = response.json()
    if not isinstance(payload, list):
        raise ValueError("Spoonacular response was not a list")
    return payload


def _normalize_spoonacular_candidates(payload: list[Mapping[str, Any]]) -> list[ExternalRecipeCandidate]:
    candidates: list[ExternalRecipeCandidate] = []
    for row in payload:
        if not isinstance(row, Mapping):
            continue
        used = _ingredient_names(row.get("usedIngredients"))
        missed = _ingredient_names(row.get("missedIngredients"))
        unused = _ingredient_names(row.get("unusedIngredients"))
        ingredients = _dedupe_strings([*used, *missed, *unused])
        instructions = _instruction_list(row.get("instructions"))
        raw_score_fields: dict[str, Any] = {
            "has_instructions": bool(instructions),
            "provider_used_count": len(used),
            "provider_missed_count": len(missed),
            "provider_unused_count": len(unused),
            "scoring_version": SCORING_VERSION,
        }
        if row.get("likes") is not None:
            raw_score_fields["provider_likes"] = row.get("likes")

        candidates.append(
            ExternalRecipeCandidate(
                source="spoonacular",
                source_id=str(row.get("id") or ""),
                source_url=_string_or_none(row.get("sourceUrl")),
                title=str(row.get("title") or "").strip(),
                image_url=_string_or_none(row.get("image")),
                ready_minutes=_positive_int_or_none(row.get("readyInMinutes")),
                servings=_positive_int_or_none(row.get("servings")),
                ingredients=ingredients,
                used_ingredients=used,
                missed_ingredients=missed,
                unused_ingredients=unused,
                instructions=instructions,
                raw_score_fields=raw_score_fields,
            )
        )
    return candidates


def _ingredient_names(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    names: list[str] = []
    for ingredient in value:
        if not isinstance(ingredient, Mapping):
            continue
        for key in ("name", "originalName", "original"):
            name = _string_or_none(ingredient.get(key))
            if name:
                names.append(name)
                break
    return _dedupe_strings(names)


def _instruction_list(value: Any) -> list[str]:
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    if isinstance(value, list):
        return [item.strip() for item in value if isinstance(item, str) and item.strip()]
    return []


def _dedupe_strings(values: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = " ".join(value.strip().split())
        key = normalized.casefold()
        if normalized and key not in seen:
            deduped.append(normalized)
            seen.add(key)
    return deduped


def _string_or_none(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    return normalized or None


def _positive_int_or_none(value: Any) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _score_candidate(candidate: ExternalRecipeCandidate, preferences: dict) -> ExternalRecipeCandidate:
    if not candidate.source.strip() or not candidate.source_id.strip() or not candidate.title.strip():
        candidate.feasibility_bucket = "rejected"
        candidate.score = -100.0
        return candidate

    missed_count = len(candidate.missed_ingredients)
    score = 50.0
    score += len(candidate.used_ingredients) * 12
    score -= missed_count * 10
    if not candidate.instructions:
        score -= 8
    max_time = _positive_int_or_none((preferences or {}).get("max_time_minutes"))
    if candidate.ready_minutes is not None:
        if max_time is not None and candidate.ready_minutes <= max_time:
            score += 4
        elif max_time is None and candidate.ready_minutes <= 45:
            score += 3
        if candidate.ready_minutes <= 45:
            score += 2
    if missed_count == 0:
        candidate.feasibility_bucket = "cookable_tonight"
        score += 20
    elif missed_count <= 2:
        candidate.feasibility_bucket = "almost_there"
        score += 5
    else:
        candidate.feasibility_bucket = "inspiration"
        score -= 5

    # TODO: Replace count-based v1 scoring with weighted pantry feasibility:
    # missing parsley is minor, missing steak in churrasco is fatal, and
    # missing chicken in chicken fried rice is fatal.
    candidate.score = round(score, 2)
    return candidate


def _ranked_result(
    provider: str,
    candidates: list[ExternalRecipeCandidate],
    selected_filters: dict[str, list[str]] | None = None,
    filter_mode: FilterMode = "cookable_tonight",
) -> ExternalRecipeSearchResult:
    filtered_candidates = (
        apply_candidate_filters(candidates, selected_filters, "all")
        if selected_filters
        else candidates
    )
    ranked = sorted(filtered_candidates, key=lambda candidate: candidate.score, reverse=True)
    eligible = [candidate for candidate in ranked if candidate.feasibility_bucket != "rejected"]
    best = eligible[0] if eligible else None
    alternatives = eligible[1:] if best is not None else []
    return ExternalRecipeSearchResult(
        provider=provider,
        provider_status="configured",
        best=best,
        alternatives=alternatives,
        candidates=ranked,
        filter_counts=build_living_filter_counts(candidates, filter_mode, selected_filters),
    )
