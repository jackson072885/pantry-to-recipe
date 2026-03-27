from __future__ import annotations

from collections import defaultdict
from typing import Iterable

from sqlalchemy.orm import Session

from app.models.recipe import Recipe
from app.models.tag import Tag
from app.services.recipe_dataset_service import active_recipe_query


WEAK_THRESHOLD = 10
OVERLOADED_THRESHOLD = 40
PAIR_GROUPS = ["Cooking Method", "Protein Base", "Time & Effort"]


def compute_density(db: Session) -> dict:
    tags = db.query(Tag).all()
    recipes = active_recipe_query(db).all()
    total = len(recipes)

    tag_by_id = {t.id: t for t in tags}
    recipe_tag_ids = {r.id: {t.id for t in r.tags} for r in recipes}

    tag_counts = {t.id: 0 for t in tags}
    for ids in recipe_tag_ids.values():
        for tid in ids:
            tag_counts[tid] += 1

    # group tags
    group_tags: dict[str, list[Tag]] = defaultdict(list)
    for t in tags:
        group_tags[t.group_name].append(t)

    tag_entries = []
    weak = []
    balanced = []
    overloaded = []

    for t in sorted(tags, key=lambda x: (x.group_name, x.display_name)):
        count = tag_counts[t.id]
        entry = {
            "group": t.group_name,
            "tag": t.display_name,
            "slug": t.slug,
            "count": count,
        }
        tag_entries.append(entry)

        if count < WEAK_THRESHOLD:
            weak.append(entry)
        elif count > OVERLOADED_THRESHOLD:
            overloaded.append(entry)
        else:
            balanced.append(entry)

    # cross-tag sparsity zones (pair counts for key groups)
    pair_counts = defaultdict(int)
    for recipe in recipes:
        tag_ids = recipe_tag_ids.get(recipe.id, set())
        for i, g1 in enumerate(PAIR_GROUPS):
            for g2 in PAIR_GROUPS[i + 1:]:
                tags1 = [t for t in group_tags[g1] if t.id in tag_ids]
                tags2 = [t for t in group_tags[g2] if t.id in tag_ids]
                for t1 in tags1:
                    for t2 in tags2:
                        pair_counts[(g1, t1.display_name, g2, t2.display_name)] += 1

    sparsity = [
        {
            "group_a": g1,
            "tag_a": t1,
            "group_b": g2,
            "tag_b": t2,
            "count": count,
        }
        for (g1, t1, g2, t2), count in pair_counts.items()
        if count < WEAK_THRESHOLD
    ]

    coverage_percent = (len([t for t in tag_entries if t["count"] > 0]) / max(len(tag_entries), 1)) * 100

    return {
        "total_recipes": total,
        "tags": tag_entries,
        "weak_tags": weak,
        "balanced_tags": balanced,
        "overloaded_tags": overloaded,
        "cross_tag_sparsity": sparsity,
        "coverage_percent": round(coverage_percent, 2),
    }
