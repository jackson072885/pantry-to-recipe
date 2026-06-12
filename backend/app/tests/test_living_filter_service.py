from __future__ import annotations

from app.schemas.external_recipe import ExternalRecipeCandidate
from app.services.living_filter_service import apply_candidate_filters, build_living_filter_counts


def _candidate(
    source_id: str,
    bucket: str,
    cuisine_tags: list[str] | None = None,
    dish_type_tags: list[str] | None = None,
    method_tags: list[str] | None = None,
    flavor_tags: list[str] | None = None,
    sauce_tags: list[str] | None = None,
    used_ingredients: list[str] | None = None,
    missed_ingredients: list[str] | None = None,
    ready_minutes: int | None = None,
) -> ExternalRecipeCandidate:
    return ExternalRecipeCandidate(
        source="test",
        source_id=source_id,
        title=f"Recipe {source_id}",
        cuisine_tags=cuisine_tags or [],
        dish_type_tags=dish_type_tags or [],
        method_tags=method_tags or [],
        flavor_tags=flavor_tags or [],
        sauce_tags=sauce_tags or [],
        used_ingredients=used_ingredients or [],
        missed_ingredients=missed_ingredients or [],
        ingredients=[*(used_ingredients or []), *(missed_ingredients or [])],
        ready_minutes=ready_minutes,
        feasibility_bucket=bucket,
    )


def _values(counts: dict, family: str) -> list[tuple[str, int]]:
    return [(row["value"], row["count"]) for row in counts["families"][family]]


def test_counts_by_mode_exclude_rejected_for_normal_counts():
    candidates = [
        _candidate("cookable", "cookable_tonight", cuisine_tags=["cuban"]),
        _candidate("almost", "almost_there", cuisine_tags=["mexican"]),
        _candidate("inspire", "inspiration", cuisine_tags=["thai"]),
        _candidate("reject", "rejected", cuisine_tags=["cuban"]),
    ]

    cookable = build_living_filter_counts(candidates, "cookable_tonight")
    almost = build_living_filter_counts(candidates, "almost_there")
    inspiration = build_living_filter_counts(candidates, "inspiration")

    assert _values(cookable, "feasibility_bucket") == [("cookable_tonight", 1)]
    assert _values(almost, "feasibility_bucket") == [("almost_there", 1), ("cookable_tonight", 1)]
    assert _values(inspiration, "cuisine_tags") == [("cuban", 1), ("mexican", 1), ("thai", 1)]


def test_counts_families_ignore_empty_values_and_sort_deterministically():
    candidates = [
        _candidate(
            "1",
            "cookable_tonight",
            cuisine_tags=["Cuban", " "],
            dish_type_tags=["rice bowl"],
            method_tags=["skillet"],
            flavor_tags=["savory"],
            sauce_tags=["chimichurri"],
            used_ingredients=["Chicken", "eggs"],
            missed_ingredients=["parsley"],
            ready_minutes=25,
        ),
        _candidate(
            "2",
            "cookable_tonight",
            cuisine_tags=["Mexican"],
            dish_type_tags=["tacos"],
            method_tags=["skillet"],
            flavor_tags=["savory"],
            sauce_tags=["salsa"],
            used_ingredients=["chicken"],
            ready_minutes=40,
        ),
        _candidate("3", "cookable_tonight", cuisine_tags=["cuban"], method_tags=["grill"]),
    ]

    counts = build_living_filter_counts(candidates, "cookable_tonight")

    assert _values(counts, "cuisine_tags") == [("cuban", 2), ("mexican", 1)]
    assert _values(counts, "method_tags") == [("skillet", 2), ("grill", 1)]
    assert _values(counts, "flavor_tags") == [("savory", 2)]
    assert _values(counts, "sauce_tags") == [("chimichurri", 1), ("salsa", 1)]
    assert _values(counts, "used_ingredients") == [("chicken", 2), ("egg", 1)]
    assert _values(counts, "ready_minutes") == [("30 minutes or less", 1), ("45 minutes or less", 1)]


def test_selected_filter_or_within_family_and_and_across_families():
    candidates = [
        _candidate("cuban-chimi", "cookable_tonight", cuisine_tags=["cuban"], sauce_tags=["chimichurri"]),
        _candidate("cuban-salsa", "cookable_tonight", cuisine_tags=["cuban"], sauce_tags=["salsa"]),
        _candidate("mexican-salsa", "cookable_tonight", cuisine_tags=["mexican"], sauce_tags=["salsa"]),
        _candidate("thai", "cookable_tonight", cuisine_tags=["thai"], sauce_tags=["chili"]),
    ]

    or_matches = apply_candidate_filters(candidates, {"cuisine_tags": ["cuban", "mexican"]}, "all")
    and_matches = apply_candidate_filters(
        candidates,
        {"cuisine_tags": ["cuban"], "sauce_tags": ["chimichurri"]},
        "all",
    )

    assert {candidate.source_id for candidate in or_matches} == {
        "cuban-chimi",
        "cuban-salsa",
        "mexican-salsa",
    }
    assert [candidate.source_id for candidate in and_matches] == ["cuban-chimi"]


def test_selected_filters_narrow_before_counts_and_zero_matches_are_controlled():
    candidates = [
        _candidate("cuban-chimi", "cookable_tonight", cuisine_tags=["cuban"], sauce_tags=["chimichurri"]),
        _candidate("mexican-salsa", "cookable_tonight", cuisine_tags=["mexican"], sauce_tags=["salsa"]),
    ]

    narrowed_counts = build_living_filter_counts(
        candidates,
        "cookable_tonight",
        {"cuisine_tags": ["cuban"], "sauce_tags": ["chimichurri"]},
    )
    empty_counts = build_living_filter_counts(candidates, "cookable_tonight", {"cuisine_tags": ["thai"]})

    assert _values(narrowed_counts, "cuisine_tags") == [("cuban", 1)]
    assert _values(narrowed_counts, "sauce_tags") == [("chimichurri", 1)]
    assert empty_counts["families"]["cuisine_tags"] == []


def test_unknown_and_empty_filters_are_safely_ignored():
    candidates = [_candidate("1", "cookable_tonight", cuisine_tags=["cuban"])]

    matches = apply_candidate_filters(candidates, {"unknown": ["x"], "cuisine_tags": [""]}, "all")

    assert [candidate.source_id for candidate in matches] == ["1"]
