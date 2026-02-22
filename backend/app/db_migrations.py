from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Engine


RECIPE_COLUMNS = {
    "cook_time_minutes": "INTEGER",
    "difficulty": "VARCHAR(40)",
    "primary_method": "VARCHAR(60)",
    "primary_protein": "VARCHAR(60)",
    "cuisine": "VARCHAR(60)",
    "cleanup_score": "INTEGER",
    "prep_complexity": "VARCHAR(60)",
}


def _existing_columns(engine: Engine, table_name: str) -> set[str]:
    with engine.connect() as conn:
        result = conn.execute(text(f"PRAGMA table_info({table_name})"))
        return {row[1] for row in result}


def ensure_recipe_metadata_columns(engine: Engine) -> None:
    # SQLite-only pragmatic migration
    if engine.url.get_backend_name() != "sqlite":
        return

    existing = _existing_columns(engine, "recipes")
    missing = {name: ddl for name, ddl in RECIPE_COLUMNS.items() if name not in existing}

    if not missing:
        return

    with engine.connect() as conn:
        for name, ddl in missing.items():
            conn.execute(text(f"ALTER TABLE recipes ADD COLUMN {name} {ddl}"))
        conn.commit()
