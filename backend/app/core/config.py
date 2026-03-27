from __future__ import annotations

import shutil
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings


BACKEND_ROOT = Path(__file__).resolve().parents[2]
LEGACY_DB_PATH = BACKEND_ROOT / "pantry.db"


def _default_db_dir() -> Path:
    # Use a user-home path that is consistently writable in local development.
    return Path.home() / ".pantry-to-recipe"


def _default_database_url() -> str:
    db_dir = _default_db_dir()
    db_dir.mkdir(parents=True, exist_ok=True)

    target_path = db_dir / "pantry.db"
    if not target_path.exists() and LEGACY_DB_PATH.exists():
        shutil.copy2(LEGACY_DB_PATH, target_path)

    return f"sqlite:///{target_path.as_posix()}"


class Settings(BaseSettings):
    # SQLite local dev DB. Defaults to a guaranteed user-writable location.
    database_url: str = Field(default_factory=_default_database_url)

    class Config:
        env_file = ".env"


settings = Settings()
