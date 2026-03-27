from __future__ import annotations

import json

from app.db import SessionLocal
from app.services.recipe_dataset_service import archive_incomplete_active_recipes, validate_active_recipes


def main() -> None:
    db = SessionLocal()
    try:
        before = validate_active_recipes(db)
        cleanup = archive_incomplete_active_recipes(db)
        after = validate_active_recipes(db)
        print(
            json.dumps(
                {
                    "before": before,
                    "cleanup": cleanup,
                    "after": after,
                },
                indent=2,
            )
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
