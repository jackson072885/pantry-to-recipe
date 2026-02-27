
from sqlalchemy.orm import Session

from app.db import engine, SessionLocal
from app.models import Base  # IMPORTANT: ensures all models are registered
from app.services.seed_service import seed_basic_ingredients
from app.db_migrations import (
    ensure_pantry_item_columns,
    ensure_pantry_transaction_columns,
    ensure_recipe_ingredient_columns,
    ensure_recipe_metadata_columns,
)


def initialize_database():
    # Create tables AFTER models imported
    Base.metadata.create_all(bind=engine)
    ensure_recipe_metadata_columns(engine)
    ensure_recipe_ingredient_columns(engine)
    ensure_pantry_item_columns(engine)
    ensure_pantry_transaction_columns(engine)

    # Seed minimal data safely
    db: Session = SessionLocal()
    try:
        seed_basic_ingredients(db)
    finally:
        db.close()






