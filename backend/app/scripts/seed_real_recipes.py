from __future__ import annotations

import json

from app.db import SessionLocal
from app.services.real_recipe_pack_service import archive_flagged_recipes, seed_real_recipe_pack


def main() -> None:
    db = SessionLocal()
    try:
        cleanup = archive_flagged_recipes(db)
        seeded = seed_real_recipe_pack(db)
        print(json.dumps({"cleanup": cleanup, "seeded": seeded}, indent=2, sort_keys=True))
    finally:
        db.close()


if __name__ == "__main__":
    main()
