from __future__ import annotations

from app.schemas.external_recipe import ExternalRecipeCandidate

SCORING_VERSION = "pantry_feasibility_v2"

TERM_NORMALIZATIONS = {
    "hamburger meat": "ground beef",
    "minced beef": "ground beef",
    "mince beef": "ground beef",
    "ground hamburger": "ground beef",
    "chicken breast": "chicken",
    "chicken breasts": "chicken",
    "chicken thigh": "chicken",
    "chicken thighs": "chicken",
    "eggs": "egg",
}

MINOR_TERMS = {
    "parsley",
    "cilantro",
    "green onion",
    "scallion",
    "red pepper flakes",
    "sesame seeds",
    "garnish",
    "lemon wedge",
    "lime wedge",
    "optional herbs",
}

MODERATE_TERMS = {
    "soy sauce",
    "broth",
    "stock",
    "cream",
    "milk",
    "butter",
    "oil",
    "vinegar",
    "lemon juice",
    "lime juice",
}

TITLE_MAIN_INGREDIENTS = {
    "chicken": {"chicken", "chicken breast", "chicken thigh"},
    "steak": {"steak", "skirt steak", "beef"},
    "churrasco": {"steak", "skirt steak", "beef"},
    "rice": {"rice"},
    "fried rice": {"rice"},
    "egg": {"egg"},
    "beef": {"beef", "ground beef", "steak", "skirt steak"},
    "pork": {"pork"},
    "shrimp": {"shrimp"},
}

DISH_FAMILY_REQUIREMENTS = {
    "churrasco": {"steak", "beef"},
    "chicken fried rice": {"chicken", "rice"},
    "fried rice": {"rice"},
    "quesadilla": {"tortilla"},
    "alfredo": {"pasta", "cream", "alfredo"},
}


def score_candidates_feasibility(
    candidates: list[ExternalRecipeCandidate],
    pantry_ingredients: list[str],
    preferences: dict | None = None,
) -> list[ExternalRecipeCandidate]:
    return [
        score_candidate_feasibility(candidate, pantry_ingredients, preferences)
        for candidate in candidates
    ]


def score_candidate_feasibility(
    candidate: ExternalRecipeCandidate,
    pantry_ingredients: list[str],
    preferences: dict | None = None,
) -> ExternalRecipeCandidate:
    preferences = preferences or {}
    if not candidate.source.strip() or not candidate.source_id.strip() or not candidate.title.strip():
        return _reject(candidate, "missing required candidate identity")

    pantry = {_normalize_ingredient(item) for item in pantry_ingredients}
    pantry.discard("")
    missed = _candidate_missed_ingredients(candidate, pantry)
    critical, moderate, minor, other = _classify_missing(candidate.title, missed)

    score = 60.0
    score += len(_normalized_values(candidate.used_ingredients)) * 12
    score -= len(critical) * 80
    score -= len(moderate) * 14
    score -= len(other) * 24
    score -= len(minor) * 4
    if not candidate.instructions:
        score -= 6
    ready_minutes = candidate.ready_minutes
    max_time = _positive_int_or_none(preferences.get("max_time_minutes"))
    if ready_minutes is not None:
        if ready_minutes <= 45:
            score += 4
        if max_time is not None and ready_minutes <= max_time:
            score += 4

    reasons: list[str] = []
    if critical:
        bucket = "rejected"
        reasons.append("missing critical title or dish-family ingredient")
    elif other and len(other) >= 4:
        bucket = "rejected"
        reasons.append("too many missing core ingredients")
    elif not missed or (minor and len(minor) == len(missed)):
        bucket = "cookable_tonight"
        reasons.append("no critical missing ingredients")
    elif len(moderate) <= 2 and not other:
        bucket = "almost_there"
        reasons.append("missing moderate pantry items")
    elif len(minor) >= 3 and not other:
        bucket = "almost_there"
        reasons.append("only several minor missing items")
    else:
        bucket = "inspiration"
        reasons.append("meaningful shopping likely needed")

    candidate.critical_missing_ingredients = critical
    candidate.moderate_missing_ingredients = moderate
    candidate.minor_missing_ingredients = minor
    candidate.feasibility_reasons = reasons
    candidate.feasibility_bucket = bucket
    candidate.score = round(score, 2)
    candidate.raw_score_fields = {
        **candidate.raw_score_fields,
        "scoring_version": SCORING_VERSION,
        "critical_missing_ingredients": critical,
        "moderate_missing_ingredients": moderate,
        "minor_missing_ingredients": minor,
        "other_missing_ingredients": other,
        "feasibility_reasons": reasons,
    }
    return candidate


def normalize_ingredient_label(value: str) -> str:
    return _normalize_ingredient(value)


def _reject(candidate: ExternalRecipeCandidate, reason: str) -> ExternalRecipeCandidate:
    candidate.feasibility_bucket = "rejected"
    candidate.score = -100.0
    candidate.feasibility_reasons = [reason]
    candidate.raw_score_fields = {
        **candidate.raw_score_fields,
        "scoring_version": SCORING_VERSION,
        "feasibility_reasons": [reason],
    }
    return candidate


def _candidate_missed_ingredients(candidate: ExternalRecipeCandidate, pantry: set[str]) -> list[str]:
    missed = _dedupe(candidate.missed_ingredients)
    if missed:
        return missed

    inferred: list[str] = []
    for ingredient in candidate.ingredients:
        normalized = _normalize_ingredient(ingredient)
        if normalized and not _ingredient_matches_any(normalized, pantry):
            inferred.append(ingredient)
    return _dedupe(inferred)


def _classify_missing(title: str, missed_ingredients: list[str]) -> tuple[list[str], list[str], list[str], list[str]]:
    critical: list[str] = []
    moderate: list[str] = []
    minor: list[str] = []
    other: list[str] = []
    title_key = _normalize_text(title)

    for ingredient in missed_ingredients:
        normalized = _normalize_ingredient(ingredient)
        if _is_critical_missing(title_key, normalized):
            critical.append(ingredient)
        elif _is_minor_missing(normalized):
            minor.append(ingredient)
        elif _is_moderate_missing(title_key, normalized):
            if _moderate_is_title_dependent(title_key, normalized):
                critical.append(ingredient)
            else:
                moderate.append(ingredient)
        else:
            other.append(ingredient)
    return critical, moderate, minor, other


def _is_critical_missing(title_key: str, ingredient: str) -> bool:
    if not ingredient:
        return False
    if _title_requires_family(title_key, ingredient):
        return True
    for title_term, ingredient_terms in TITLE_MAIN_INGREDIENTS.items():
        if title_term in title_key and _matches_any_term(ingredient, ingredient_terms):
            return True
    if "taco" in title_key and "bowl" not in title_key and "skillet" not in title_key:
        return _matches_any_term(ingredient, {"tortilla", "taco shell"})
    if "burger" in title_key and "bowl" not in title_key and "skillet" not in title_key:
        return _matches_any_term(ingredient, {"ground beef", "patty", "bun"})
    return False


def _title_requires_family(title_key: str, ingredient: str) -> bool:
    for dish, required_terms in DISH_FAMILY_REQUIREMENTS.items():
        if dish in title_key and _matches_any_term(ingredient, required_terms):
            return True
    return False


def _is_minor_missing(ingredient: str) -> bool:
    return _matches_any_term(ingredient, MINOR_TERMS)


def _is_moderate_missing(title_key: str, ingredient: str) -> bool:
    if _matches_any_term(ingredient, MODERATE_TERMS):
        return True
    return False


def _moderate_is_title_dependent(title_key: str, ingredient: str) -> bool:
    if not ingredient:
        return False
    if "cream" in ingredient and ("cream" in title_key or "creamy" in title_key or "alfredo" in title_key):
        return True
    if "broth" in ingredient and "broth" in title_key:
        return True
    if "stock" in ingredient and "stock" in title_key:
        return True
    if "butter" in ingredient and "butter" in title_key:
        return True
    return False


def _ingredient_matches_any(ingredient: str, pantry: set[str]) -> bool:
    return any(ingredient == pantry_item or ingredient in pantry_item or pantry_item in ingredient for pantry_item in pantry)


def _matches_any_term(ingredient: str, terms: set[str]) -> bool:
    normalized_terms = {_normalize_ingredient(term) for term in terms}
    return any(ingredient == term or term in ingredient or ingredient in term for term in normalized_terms)


def _normalized_values(values: list[str]) -> list[str]:
    return [normalized for normalized in (_normalize_ingredient(value) for value in values) if normalized]


def _dedupe(values: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = _normalize_ingredient(value)
        if normalized and normalized not in seen:
            deduped.append(" ".join(value.strip().split()))
            seen.add(normalized)
    return deduped


def _normalize_ingredient(value: str) -> str:
    normalized = _normalize_text(value)
    normalized = TERM_NORMALIZATIONS.get(normalized, normalized)
    if normalized.endswith("ies") and len(normalized) > 4:
        normalized = f"{normalized[:-3]}y"
    elif normalized.endswith("es") and normalized not in {"molasses"} and len(normalized) > 4:
        normalized = normalized[:-2]
    elif normalized.endswith("s") and not normalized.endswith("ss") and len(normalized) > 3:
        normalized = normalized[:-1]
    return TERM_NORMALIZATIONS.get(normalized, normalized)


def _normalize_text(value: str) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().casefold().split())


def _positive_int_or_none(value: object) -> int | None:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None
