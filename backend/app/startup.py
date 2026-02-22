
from sqlalchemy.orm import Session

from app.db import engine, SessionLocal
from app.models import Base  # IMPORTANT: ensures all models are registered
from app.services.seed_service import seed_basic_ingredients


def initialize_database():
    # Create tables AFTER models imported
    Base.metadata.create_all(bind=engine)

    # Seed minimal data safely
    db: Session = SessionLocal()
    try:
        seed_basic_ingredients(db)
    finally:
        db.close()






