from __future__ import annotations

import json

from app.db import SessionLocal, ensure_schema
from app.services.real_recipe_pack_service import archive_flagged_recipes, seed_real_recipe_pack
from app.services.recipe_quality_service import run_recipe_quality_backfill


def main() -> None:
    ensure_schema()
    db = SessionLocal()
    try:
        summary = {
            "seed": seed_real_recipe_pack(db),
            "quality": run_recipe_quality_backfill(db),
            "archive": archive_flagged_recipes(db),
        }
        print(json.dumps(summary, indent=2, sort_keys=True))
    finally:
        db.close()


if __name__ == "__main__":
    main()
