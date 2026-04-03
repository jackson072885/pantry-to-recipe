from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path


VALID_CUISINES = {
    "american",
    "tex_mex",
    "mexican",
    "italian",
    "asian",
    "mediterranean",
    "indian",
    "southern",
    "bbq",
}
TIME_TAGS = {"15_min", "30_min", "45_min_plus"}
DIFFICULTY_TAGS = {"easy", "medium"}
COST_TAGS = {"budget", "moderate"}
CLEANUP_TAGS = {"one_pan", "one_pot", "sheet_pan", "multi_pan"}
STYLE_TAGS = {
    "tacos",
    "quesadillas",
    "fajitas",
    "burrito_bowls",
    "enchilada_style",
    "tostadas",
    "bean_forward",
    "rice_skillet",
}
PLACEHOLDER_PATTERNS = ("placeholder", "todo", "lorem ipsum", "tbd", "until done")


def _dataset_path() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "recipes_real_v1.json"


def _normalize_title(value: str) -> str:
    lowered = value.strip().lower()
    lowered = re.sub(r"[^a-z0-9\\s]", "", lowered)
    return re.sub(r"\\s+", " ", lowered).strip()


def test_recipe_source_dataset_contract() -> None:
    rows = json.loads(_dataset_path().read_text(encoding="utf-8"))
    assert isinstance(rows, list)
    assert len(rows) >= 90

    normalized_titles = [_normalize_title(row["name"]) for row in rows]
    assert len(normalized_titles) == len(set(normalized_titles))

    cuisine_counts = Counter()
    style_coverage: set[str] = set()

    for row in rows:
        assert (row.get("name") or "").strip() != ""
        assert isinstance(row.get("required"), list) and len(row["required"]) >= 2
        assert isinstance(row.get("optional"), list)
        assert (row.get("instructions") or "").strip() != ""
        lowered_instructions = row["instructions"].strip().lower()
        assert not any(token in lowered_instructions for token in PLACEHOLDER_PATTERNS)
        assert lowered_instructions.count(".") >= 2

        cuisine = row.get("cuisine")
        assert cuisine in VALID_CUISINES
        cuisine_counts[cuisine] += 1

        tags = row.get("tags")
        assert isinstance(tags, list) and tags
        assert len(tags) == len(set(tags))
        assert all(tag == tag.lower() for tag in tags)
        assert all("-" not in tag for tag in tags)
        assert all(" " not in tag for tag in tags)
        assert all(re.fullmatch(r"[a-z0-9_]+", tag) for tag in tags)

        assert len(set(tags) & TIME_TAGS) == 1
        assert len(set(tags) & DIFFICULTY_TAGS) == 1
        assert len(set(tags) & COST_TAGS) == 1
        assert len(set(tags) & CLEANUP_TAGS) == 1
        style_coverage.update(set(tags) & STYLE_TAGS)

    assert cuisine_counts["tex_mex"] >= 8
    assert cuisine_counts["mexican"] >= 4
    assert style_coverage == STYLE_TAGS
