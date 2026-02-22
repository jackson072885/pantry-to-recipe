from __future__ import annotations

from typing import Iterable

from app.schemas.match import MatchResponse, MatchV2Response, MatchV2Result

DEFAULT_TIME_MINUTES = 30
DEFAULT_SIMPLICITY = 0.5
DEFAULT_CLEANUP = 0.5

WEIGHT_TIME = 0.40
WEIGHT_SIMPLICITY = 0.30
WEIGHT_CLEANUP = 0.20
WEIGHT_KID_BOOST = 0.10


def _dinner_score(
    time_minutes: int | None = None,
    simplicity: float | None = None,
    cleanup: float | None = None,
    kid_boost: bool | None = None,
) -> float:
    time_value = time_minutes if time_minutes is not None else DEFAULT_TIME_MINUTES
    simplicity_value = simplicity if simplicity is not None else DEFAULT_SIMPLICITY
    cleanup_value = cleanup if cleanup is not None else DEFAULT_CLEANUP
    kid_value = 1.0 if kid_boost else 0.0

    time_score = max(0.0, min(1.0, 1.0 - (time_value / 120.0)))

    score = (
        (time_score * WEIGHT_TIME)
        + (simplicity_value * WEIGHT_SIMPLICITY)
        + (cleanup_value * WEIGHT_CLEANUP)
        + (kid_value * WEIGHT_KID_BOOST)
    )

    return round(score, 3)


def _to_v2_result(result) -> MatchV2Result:
    return MatchV2Result(
        recipe_id=result.recipe_id,
        recipe_name=result.recipe_name,
        missing_count=result.missing_required_count,
        missing_required=result.missing_required,
        dinner_score=_dinner_score(),
    )


def _sort_results(results: Iterable[MatchV2Result]) -> list[MatchV2Result]:
    return sorted(
        results,
        key=lambda r: (
            r.missing_count,
            -r.dinner_score,
            r.recipe_id,
        ),
    )


def build_v2_response(match_response: MatchResponse) -> MatchV2Response:
    flat = match_response.cookable + match_response.almost + match_response.not_cookable

    cookable: list[MatchV2Result] = []
    almost: list[MatchV2Result] = []
    not_recommended: list[MatchV2Result] = []

    for result in flat:
        v2 = _to_v2_result(result)
        if v2.missing_count == 0:
            cookable.append(v2)
        elif 1 <= v2.missing_count <= 2:
            almost.append(v2)
        else:
            not_recommended.append(v2)

    return MatchV2Response(
        cookable=_sort_results(cookable),
        almost=_sort_results(almost),
        not_recommended=_sort_results(not_recommended),
        meta={
            "pantry_count": match_response.meta.get("pantry_count"),
            "normalized_count": match_response.meta.get("normalized_count"),
            "recipe_count": match_response.meta.get("recipe_count"),
            "version": "v2",
        },
    )
