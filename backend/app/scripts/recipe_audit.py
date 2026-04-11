from __future__ import annotations

import json

from app.db import SessionLocal, ensure_schema
from app.services.recipe_curation_service import audit_recipe_catalog
from app.services.real_recipe_pack_service import seed_real_recipe_pack
from app.services.recipe_quality_service import run_recipe_quality_backfill


def main() -> None:
    ensure_schema()
    db = SessionLocal()
    try:
        seed_real_recipe_pack(db)
        run_recipe_quality_backfill(db)
        report = audit_recipe_catalog(db)
        print(json.dumps(report, indent=2, sort_keys=True))
    finally:
        db.close()


if __name__ == "__main__":
    main()
