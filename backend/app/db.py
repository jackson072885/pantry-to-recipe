from __future__ import annotations

from contextlib import contextmanager
from typing import Generator, Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db_migrations import (
    ensure_pantry_item_columns,
    ensure_pantry_transaction_columns,
    ensure_recipe_ingredient_columns,
    ensure_recipe_metadata_columns,
    ensure_runtime_bootstrap_tables,
)
from app.models.base import Base

DATABASE_URL = settings.database_url

# Import model modules eagerly so Base.metadata is complete before create_all runs.
from app import models as _models  # noqa: F401,E402

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def ensure_schema() -> None:
    init_db()
    ensure_recipe_metadata_columns(engine)
    ensure_recipe_ingredient_columns(engine)
    ensure_pantry_item_columns(engine)
    ensure_pantry_transaction_columns(engine)
    ensure_runtime_bootstrap_tables(engine)


@contextmanager
def db_session() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
