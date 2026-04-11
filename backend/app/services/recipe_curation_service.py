from __future__ import annotations

from collections import Counter

from sqlalchemy.orm import Session

from app.models.recipe import Recipe
from app.services.recipe_dataset_service import ARCHIVE_PREFIX
from app.services.recipe_quality_service import (
    KEEP_AND_ENRICH,
    KEEP_AS_IS,
    KEEP_BUT_FLAG_FOR_REVIEW,
    MERGE_WITH_DUPLICATE,
    REMOVE_AS_JUNK,
    _enrich_recipe,
    _find_duplicate_winners,
    _load_recipe_ingredients,
    _score_recipe,
    run_recipe_quality_backfill,
)

QUALITY_BUCKETS = (
    KEEP_AS_IS,
    KEEP_AND_ENRICH,
    KEEP_BUT_FLAG_FOR_REVIEW,
    REMOVE_AS_JUNK,
    MERGE_WITH_DUPLICATE,
)


def recipe_quality_rubric() -> list[dict]:
    return [
        {"category": "TITLE_QUALITY", "max_points": 5, "focus": "clear, specific, useful title"},
        {
            "category": "INGREDIENT_COMPLETENESS",
            "max_points": 5,
            "focus": "required ingredients, quantity transparency, ingredient clarity",
        },
        {"category": "STEP_QUALITY", "max_points": 5, "focus": "enough detail to cook confidently"},
        {"category": "TRUST_AND_COOKABILITY", "max_points": 5, "focus": "servings, timing, practical cookability"},
        {
            "category": "PRODUCT_VALUE",
            "max_points": 5,
            "focus": "fit for a pantry-based dinner decision tool",
        },
        {"category": "DATA_HYGIENE", "max_points": 5, "focus": "duplicate safety, malformed data, placeholder content"},
    ]


def audit_recipe_catalog(db: Session) -> dict:
    recipes = (
        db.query(Recipe)
        .filter(~Recipe.name.like(f"{ARCHIVE_PREFIX}%"))
        .order_by(Recipe.id.asc())
        .all()
    )
    ingredient_rows = {recipe.id: _load_recipe_ingredients(db, recipe.id) for recipe in recipes}
    duplicate_winners = _find_duplicate_winners(recipes, ingredient_rows)

    audits: list[dict] = []
    for recipe in recipes:
        enrichment = _enrich_recipe(recipe, ingredient_rows[recipe.id])
        decision = _score_recipe(recipe, ingredient_rows[recipe.id], enrichment, duplicate_winners.get(recipe.id))
        score_breakdown = decision["score_breakdown"]
        audits.append(
            {
                "recipe_id": recipe.id,
                "recipe_name": recipe.name,
                "total_score": decision["score"],
                "bucket": decision["bucket"],
                "reason_summary": "; ".join(decision["reasons"]),
                "stored_bucket": recipe.quality_bucket,
                "stored_review_status": recipe.review_status,
                "stored_production_ready": recipe.is_production_ready,
                "title_quality": score_breakdown["title_quality"],
                "ingredient_completeness": score_breakdown["ingredient_completeness"],
                "step_quality": score_breakdown["step_quality"],
                "trust_and_cookability": score_breakdown["trust_and_cookability"],
                "product_value": score_breakdown["product_value"],
                "data_hygiene": score_breakdown["data_hygiene"],
            }
        )

    bucket_counts = Counter(item["bucket"] for item in audits)
    examples = {
        bucket: [
            {
                "recipe_id": item["recipe_id"],
                "recipe_name": item["recipe_name"],
                "reason_summary": item["reason_summary"],
            }
            for item in audits
            if item["bucket"] == bucket
        ][:5]
        for bucket in QUALITY_BUCKETS
    }

    return {
        "rubric": recipe_quality_rubric(),
        "total_active": len(audits),
        "bucket_counts": dict(bucket_counts),
        "stored_bucket_counts": dict(Counter(item["stored_bucket"] for item in audits)),
        "stored_production_ready_count": sum(1 for item in audits if item["stored_production_ready"]),
        "examples": examples,
        "recipes": audits,
    }


def apply_recipe_curation(db: Session) -> dict:
    result = run_recipe_quality_backfill(db)
    return {
        "updated": result["total_active"],
        "archived": sum(1 for row in result["impacted"] if row["bucket"] in {MERGE_WITH_DUPLICATE, REMOVE_AS_JUNK}),
        "production_ready": sum(1 for row in result["impacted"] if row["production_ready"]),
        "bucket_counts": result["counts"],
    }
