from __future__ import annotations

from collections.abc import Mapping
import logging
import re
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.schemas.external_recipe import ExternalRecipeCandidate, ExternalRecipeSearchResult, FilterMode
from app.services.living_filter_service import apply_candidate_filters, build_living_filter_counts
from app.services.pantry_feasibility_service import score_candidates_feasibility
from app.services.recommendation_service import DEFAULT_RECOMMENDATION_MODE, recommend_recipes

logger = logging.getLogger(__name__)

DEFAULT_LIMIT = 10
MAX_LIMIT = 25
SPOONACULAR_FIND_BY_INGREDIENTS_URL = "https://api.spoonacular.com/recipes/findByIngredients"
SCORING_VERSION = "external_candidate_v1"
CONTROLLED_PROVIDER_STATUSES = {"disabled", "missing_api_key", "error"}
WEIGHING_LABEL_RE = re.compile(
    r"^(?P<ingredient>chicken)\s+weighing\s+\d+(?:\.\d+)?\s*(?:kg|g|lb|lbs|pounds?)$",
    re.IGNORECASE,
)


def search_external_recipes_by_ingredients(
    ingredients: list[str],
    preferences: dict | None = None,
    limit: int = DEFAULT_LIMIT,
    selected_filters: dict[str, list[str]] | None = None,
    filter_mode: FilterMode = "cookable_tonight",
    fallback_db: Session | None = None,
    session_id: str = "anonymous",
) -> ExternalRecipeSearchResult:
    normalized_ingredients = _normalize_input_ingredients(ingredients)
    safe_limit = _safe_limit(limit)
    provider = _configured_provider()

    if provider == "disabled":
        return _internal_fallback_result(
            "disabled",
            "disabled",
            normalized_ingredients,
            safe_limit,
            selected_filters,
            filter_mode,
            fallback_db,
            session_id,
        )

    if not normalized_ingredients:
        return ExternalRecipeSearchResult(provider=provider, provider_status="configured")

    if provider == "spoonacular":
        if not settings.spoonacular_api_key.strip():
            return _internal_fallback_result(
                provider,
                "missing_api_key",
                normalized_ingredients,
                safe_limit,
                selected_filters,
                filter_mode,
                fallback_db,
                session_id,
            )

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
            return _internal_fallback_result(
                provider,
                "error",
                normalized_ingredients,
                safe_limit,
                selected_filters,
                filter_mode,
                fallback_db,
                session_id,
                error_message="External recipe provider failed",
            )

    return _internal_fallback_result(
        provider,
        "error",
        normalized_ingredients,
        safe_limit,
        selected_filters,
        filter_mode,
        fallback_db,
        session_id,
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
            _with_display_contract(
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


def _internal_fallback_result(
    provider: str,
    provider_status: str,
    ingredients: list[str],
    limit: int,
    selected_filters: dict[str, list[str]] | None,
    filter_mode: FilterMode,
    fallback_db: Session | None,
    session_id: str,
    error_message: str | None = None,
) -> ExternalRecipeSearchResult:
    controlled_status = provider_status if provider_status in CONTROLLED_PROVIDER_STATUSES else "error"
    if fallback_db is None or not ingredients:
        return ExternalRecipeSearchResult(
            provider=provider,
            provider_status=controlled_status,
            error_message=error_message,
        )

    try:
        recommendations = recommend_recipes(
            fallback_db,
            ingredients,
            DEFAULT_RECOMMENDATION_MODE,
            session_id,
        )
        candidates = _internal_recommendations_to_candidates(recommendations)
        filtered_candidates = (
            apply_candidate_filters(candidates, selected_filters, "all")
            if selected_filters
            else candidates
        )
        ranked = sorted(filtered_candidates, key=lambda candidate: candidate.score, reverse=True)[:limit]
        eligible = [candidate for candidate in ranked if candidate.feasibility_bucket != "rejected"]
        best = eligible[0] if eligible else None
        return ExternalRecipeSearchResult(
            provider=provider,
            provider_status=controlled_status,
            best=best,
            alternatives=eligible[1:] if best is not None else [],
            candidates=ranked,
            filter_counts=build_living_filter_counts(candidates, filter_mode, selected_filters),
            error_message=error_message,
        )
    except Exception as exc:
        logger.warning("Internal recipe fallback failed: provider=%s error=%s", provider, exc)
        return ExternalRecipeSearchResult(
            provider=provider,
            provider_status=controlled_status,
            error_message=error_message,
        )


def _internal_recommendations_to_candidates(recommendations: dict) -> list[ExternalRecipeCandidate]:
    entries: list[dict] = []
    seen: set[str] = set()
    for bucket in ("cook_now", "almost_there", "closest_options", "not_worth_it"):
        for entry in recommendations.get(bucket, []) or []:
            recipe = entry.get("recipe", {})
            source_id = str(recipe.get("recipe_id") or "")
            if source_id and source_id not in seen:
                entries.append(entry)
                seen.add(source_id)
    best_entry = recommendations.get("best_tonight")
    if best_entry:
        recipe = best_entry.get("recipe", {})
        source_id = str(recipe.get("recipe_id") or "")
        if source_id and source_id not in seen:
            entries.insert(0, best_entry)
            seen.add(source_id)

    return [_internal_recommendation_to_candidate(entry) for entry in entries]


def _internal_recommendation_to_candidate(entry: dict) -> ExternalRecipeCandidate:
    recipe = entry.get("recipe", {})
    missing = entry.get("missing", {}) or {}
    missing_ingredients = list(missing.get("ingredients") or recipe.get("missing_ingredients") or [])
    core_missing = list(missing.get("core_ingredients") or [])
    minor_missing = list(missing.get("minor_ingredients") or [])
    moderate_missing = [item for item in missing_ingredients if item not in core_missing and item not in minor_missing]
    pantry_items = list((entry.get("generated_from") or {}).get("pantry_items") or [])
    ingredients = _dedupe_strings([*pantry_items, *missing_ingredients])
    recommendation_type = entry.get("recommendation_type") or recipe.get("recommendation_type")
    feasibility_bucket = _internal_recommendation_bucket(recommendation_type)

    return _with_display_contract(
        ExternalRecipeCandidate(
            source="internal_recipe_bank",
            source_id=str(recipe.get("recipe_id") or ""),
            source_url=f"/recipes/{recipe.get('recipe_id')}" if recipe.get("recipe_id") else None,
            title=str(recipe.get("recipe_name") or "").strip(),
            ready_minutes=_positive_int_or_none(recipe.get("estimated_time_minutes")),
            servings=_positive_int_or_none(recipe.get("servings")),
            ingredients=ingredients,
            used_ingredients=pantry_items,
            missed_ingredients=missing_ingredients,
            critical_missing_ingredients=core_missing,
            moderate_missing_ingredients=moderate_missing,
            minor_missing_ingredients=minor_missing,
            score=float(entry.get("tonight_score") or 0.0),
            feasibility_bucket=feasibility_bucket,
            feasibility_reasons=[entry.get("explanation")] if entry.get("explanation") else [],
            raw_score_fields={
                "fallback_source": "internal_recipe_bank",
                "recommendation_type": recommendation_type,
                "confidence_score": entry.get("confidence_score"),
            },
        )
    )


def _internal_recommendation_bucket(recommendation_type: str | None) -> str:
    if recommendation_type == "cook_now":
        return "cookable_tonight"
    if recommendation_type == "almost_there":
        return "almost_there"
    if recommendation_type == "not_worth_it":
        return "inspiration"
    return "inspiration"


def _with_display_contract(candidate: ExternalRecipeCandidate) -> ExternalRecipeCandidate:
    display_title = " ".join(candidate.title.strip().split())
    display_ingredients, ingredient_notes = _display_ingredient_list(candidate.ingredients, "ingredients")
    display_used, used_notes = _display_ingredient_list(candidate.used_ingredients, "used_ingredients")
    display_missed, missed_notes = _display_ingredient_list(candidate.missed_ingredients, "missed_ingredients")

    candidate.display_title = display_title or candidate.title
    candidate.display_ingredients = display_ingredients
    candidate.display_used_ingredients = display_used
    candidate.display_missed_ingredients = display_missed
    candidate.normalization_notes = [*ingredient_notes, *used_notes, *missed_notes]
    candidate.source_provenance = {
        "source": candidate.source,
        "source_id": candidate.source_id,
        "source_url": candidate.source_url,
    }
    return candidate


def _display_ingredient_list(values: list[str], field_name: str) -> tuple[list[str], list[str]]:
    display_values: list[str] = []
    notes: list[str] = []
    seen: set[str] = set()
    for value in values:
        display_value = _display_ingredient_label(value)
        key = display_value.casefold()
        if not display_value or key in seen:
            continue
        display_values.append(display_value)
        seen.add(key)
        raw_value = " ".join(value.strip().split())
        if raw_value and raw_value != display_value:
            notes.append(f"{field_name}: {raw_value!r} displayed as {display_value!r}")
    return display_values, notes


def _display_ingredient_label(value: str) -> str:
    if not isinstance(value, str):
        return ""
    normalized = " ".join(value.strip().split())
    if not normalized:
        return ""

    key = normalized.casefold()
    if key in {"bulb garlic", "bulbs garlic"}:
        return "Garlic"
    if key == "salt and pepper":
        return "Salt and pepper"

    weighing_match = WEIGHING_LABEL_RE.match(normalized)
    if weighing_match:
        return _humanize_display_label(weighing_match.group("ingredient"))

    return _humanize_display_label(normalized)


def _humanize_display_label(value: str) -> str:
    if not value:
        return ""
    if value.islower():
        return value[:1].upper() + value[1:]
    return value[:1].upper() + value[1:]
