from __future__ import annotations

from pathlib import Path

from app.core.config import (
    DEFAULT_DB_PATH,
    LEGACY_DB_PATH,
    database_path_from_url,
    is_legacy_database_path,
    settings,
)
from app.db import SessionLocal, ensure_schema
from app.services.real_recipe_pack_service import inspect_canonical_recipe_drift
from app.services.seed_service import run_seed

CANONICAL_RECIPE_SOURCE = Path(__file__).resolve().parents[1] / "data" / "recipes_real_v1.json"


def describe_runtime_bootstrap() -> dict[str, object]:
    database_path = database_path_from_url(settings.database_url)
    return {
        "database_url": settings.database_url,
        "database_path": str(database_path) if database_path else None,
        "default_database_path": str(DEFAULT_DB_PATH),
        "legacy_database_path": str(LEGACY_DB_PATH),
        "legacy_database_exists": LEGACY_DB_PATH.exists(),
        "legacy_database_selected": is_legacy_database_path(settings.database_url),
        "canonical_recipe_source": str(CANONICAL_RECIPE_SOURCE),
    }


def bootstrap_runtime_state() -> dict[str, object]:
    ensure_schema()
    summary = describe_runtime_bootstrap()
    db = SessionLocal()
    try:
        summary["drift_before_sync"] = inspect_canonical_recipe_drift(db)
    finally:
        db.close()
    summary["seed"] = run_seed()
    db = SessionLocal()
    try:
        summary["drift_after_sync"] = inspect_canonical_recipe_drift(db)
    finally:
        db.close()
    if summary["drift_after_sync"]["drift_detected"]:
        raise RuntimeError("Runtime bootstrap completed with unresolved canonical recipe drift")
    return summary
