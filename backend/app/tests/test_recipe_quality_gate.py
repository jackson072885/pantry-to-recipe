from __future__ import annotations

import re

from app.db import SessionLocal
from app.models.recipe import Recipe, RecipeIngredient


_PLACEHOLDER_PATTERNS = ("pantry snack plate", "placeholder", "todo", "lorem ipsum", "tbd")


def _normalize_title(value: str) -> str:
    lowered = value.strip().lower()
    lowered = re.sub(r"[^a-z0-9\\s]", "", lowered)
    lowered = re.sub(r"\\s+", " ", lowered).strip()
    return lowered


def test_recipe_quality_gate(client) -> None:  # noqa: ARG001 - startup fixture ensures DB + seed
    db = SessionLocal()
    try:
        rows = (
            db.query(Recipe)
            .filter(~Recipe.name.like("[ARCHIVED:%"))
            .order_by(Recipe.id.asc())
            .all()
        )
        assert len(rows) >= 50

        title_groups: dict[str, list[int]] = {}
        for recipe in rows:
            norm = _normalize_title(recipe.name)
            title_groups.setdefault(norm, []).append(recipe.id)

        duplicate_groups = [ids for ids in title_groups.values() if len(ids) > 1]
        assert len(duplicate_groups) <= 1

        for recipe in rows:
            instructions = (recipe.instructions or "").strip().lower()
            assert instructions != ""
            assert not any(token in instructions for token in _PLACEHOLDER_PATTERNS)
            assert not any(token in recipe.name.lower() for token in _PLACEHOLDER_PATTERNS)

            required_count = (
                db.query(RecipeIngredient)
                .filter(RecipeIngredient.recipe_id == recipe.id, RecipeIngredient.is_required.is_(True))
                .count()
            )
            assert required_count >= 2
    finally:
        db.close()
