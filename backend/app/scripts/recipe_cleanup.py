from __future__ import annotations

import json

from app.db import SessionLocal
from app.services.real_recipe_pack_service import archive_flagged_recipes


def main() -> None:
    db = SessionLocal()
    try:
        summary = archive_flagged_recipes(db)
        print(json.dumps(summary, indent=2, sort_keys=True))
    finally:
        db.close()


if __name__ == "__main__":
    main()
