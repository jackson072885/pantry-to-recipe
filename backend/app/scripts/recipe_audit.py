from __future__ import annotations

import json

from app.db import SessionLocal
from app.services.real_recipe_pack_service import audit_recipes


def main() -> None:
    db = SessionLocal()
    try:
        report = audit_recipes(db)
        print(json.dumps(report, indent=2, sort_keys=True))
    finally:
        db.close()


if __name__ == "__main__":
    main()
