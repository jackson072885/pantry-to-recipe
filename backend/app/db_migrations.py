from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.engine import Engine


RECIPE_COLUMNS = {
    "short_description": "TEXT",
    "instructions": "TEXT",
    "cook_method": "VARCHAR(40)",
    "prep_time_minutes": "INTEGER",
    "cook_time_minutes": "INTEGER",
    "total_time_minutes": "INTEGER",
    "oven_temp_f": "INTEGER",
    "air_fryer_temp_f": "INTEGER",
    "servings": "INTEGER DEFAULT 2",
    "difficulty": "VARCHAR(40)",
    "primary_method": "VARCHAR(60)",
    "primary_protein": "VARCHAR(60)",
    "cuisine": "VARCHAR(60)",
    "cleanup_score": "INTEGER",
    "prep_complexity": "VARCHAR(60)",
    "meal_type": "VARCHAR(60)",
    "equipment_json": "TEXT",
    "substitutions_json": "TEXT",
    "tips_json": "TEXT",
    "warnings_json": "TEXT",
    "storage_json": "TEXT",
    "tags_json": "TEXT",
    "quality_score": "INTEGER",
    "quality_bucket": "VARCHAR(40)",
    "quality_reason": "TEXT",
    "review_status": "VARCHAR(40)",
    "is_weeknight_friendly": "BOOLEAN",
    "is_beginner_friendly": "BOOLEAN",
    "is_production_ready": "BOOLEAN DEFAULT 1",
    "source_dataset": "VARCHAR(80)",
    "source_recipe_key": "VARCHAR(200)",
    "source_payload_hash": "VARCHAR(64)",
}

RECIPE_INGREDIENT_COLUMNS = {
    "required_quantity": "REAL DEFAULT 1.0",
    "unit": "VARCHAR(16) DEFAULT 'ea'",
    "display_quantity": "REAL",
    "display_unit": "VARCHAR(24)",
    "display_name": "VARCHAR(120)",
    "pantry_name": "VARCHAR(120)",
    "prep_state": "VARCHAR(80)",
    "notes": "TEXT",
    "sort_order": "INTEGER",
    "measurement_is_estimated": "BOOLEAN DEFAULT 1",
}

PANTRY_ITEM_COLUMNS = {
    "unit": "VARCHAR(16) DEFAULT 'ea'",
    "use_soon": "BOOLEAN DEFAULT 0",
}

PANTRY_TRANSACTION_COLUMNS = {
    "unit": "VARCHAR(16) DEFAULT 'ea'",
}


def _existing_columns(engine: Engine, table_name: str) -> set[str]:
    with engine.connect() as conn:
        result = conn.execute(text(f"PRAGMA table_info({table_name})"))
        return {row[1] for row in result}


def ensure_recipe_metadata_columns(engine: Engine) -> None:
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


def ensure_recipe_ingredient_columns(engine: Engine) -> None:
    if engine.url.get_backend_name() != "sqlite":
        return

    existing = _existing_columns(engine, "recipe_ingredients")
    missing = {
        name: ddl for name, ddl in RECIPE_INGREDIENT_COLUMNS.items() if name not in existing
    }

    if not missing:
        return

    with engine.connect() as conn:
        for name, ddl in missing.items():
            conn.execute(text(f"ALTER TABLE recipe_ingredients ADD COLUMN {name} {ddl}"))
        conn.commit()


def ensure_pantry_item_columns(engine: Engine) -> None:
    if engine.url.get_backend_name() != "sqlite":
        return

    existing = _existing_columns(engine, "pantry_items")
    missing = {name: ddl for name, ddl in PANTRY_ITEM_COLUMNS.items() if name not in existing}

    if not missing:
        return

    with engine.connect() as conn:
        for name, ddl in missing.items():
            conn.execute(text(f"ALTER TABLE pantry_items ADD COLUMN {name} {ddl}"))
        conn.commit()


def ensure_pantry_transaction_columns(engine: Engine) -> None:
    if engine.url.get_backend_name() != "sqlite":
        return

    existing = _existing_columns(engine, "pantry_transactions")
    missing = {
        name: ddl for name, ddl in PANTRY_TRANSACTION_COLUMNS.items() if name not in existing
    }

    if not missing:
        return

    with engine.connect() as conn:
        for name, ddl in missing.items():
            conn.execute(text(f"ALTER TABLE pantry_transactions ADD COLUMN {name} {ddl}"))
        conn.commit()


def ensure_runtime_bootstrap_tables(engine: Engine) -> None:
    if engine.url.get_backend_name() != "sqlite":
        return

    with engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS runtime_bootstrap_state (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
        )
        conn.commit()
