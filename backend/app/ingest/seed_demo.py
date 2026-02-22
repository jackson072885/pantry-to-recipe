from __future__ import annotations

from app.core.db import SessionLocal, init_db
from app.ingest.seed_ingredients import seed_ingredients
from app.ingest.seed_recipes import seed_recipes


def main() -> None:
    init_db()

    db = SessionLocal()
    try:
        ing_count = seed_ingredients(db)
        rec_count = seed_recipes(db)
        print(f"Seed complete: ingredients_processed={ing_count}, recipes_processed={rec_count}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
