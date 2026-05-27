from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings


BACKEND_ROOT = Path(__file__).resolve().parents[2]
RUNTIME_ROOT = BACKEND_ROOT / ".runtime"
LEGACY_DB_PATH = BACKEND_ROOT / "pantry.db"
DEFAULT_DB_PATH = RUNTIME_ROOT / "pantry.db"
SQLITE_PREFIX = "sqlite:///"
LOCAL_CORS_ALLOWED_ORIGINS = (
    "http://127.0.0.1:5173",
    "http://localhost:5173",
)


def _default_db_dir() -> Path:
    # Keep runtime state inside the repo so it is visible, resettable, and ignored.
    return RUNTIME_ROOT


def _default_database_url() -> str:
    db_dir = _default_db_dir()
    db_dir.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"


def database_path_from_url(url: str) -> Path | None:
    if not url.startswith(SQLITE_PREFIX):
        return None
    raw_path = url.removeprefix(SQLITE_PREFIX)
    if not raw_path:
        return None
    return Path(raw_path)


def _normalized_database_path(path: Path) -> Path:
    if not path.is_absolute():
        path = Path.cwd() / path
    return path.resolve(strict=False)


def is_legacy_database_path(url: str) -> bool:
    path = database_path_from_url(url)
    if path is None:
        return False
    return _normalized_database_path(path) == LEGACY_DB_PATH.resolve(strict=False)


def validate_database_url(url: str, *, allow_legacy: bool) -> None:
    if is_legacy_database_path(url) and not allow_legacy:
        raise ValueError(
            "DATABASE_URL points to legacy backend/pantry.db. "
            "Use backend/.runtime/pantry.db or set ALLOW_LEGACY_DATABASE_PATH=true for an explicit one-off override."
        )


def cors_allowed_origin_list(extra_origins: str = "") -> list[str]:
    origins: list[str] = []
    for origin in [*LOCAL_CORS_ALLOWED_ORIGINS, *extra_origins.split(",")]:
        normalized = origin.strip().rstrip("/")
        if normalized and normalized not in origins:
            origins.append(normalized)
    return origins


class Settings(BaseSettings):
    # SQLite local dev DB. Defaults to a repo-local runtime path for reproducible resets.
    database_url: str = Field(default_factory=_default_database_url)
    allow_legacy_database_path: bool = False
    cors_allowed_origins: str = ""
    external_recipe_provider: str = "disabled"
    spoonacular_api_key: str = ""
    edamam_app_id: str = ""
    edamam_app_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
validate_database_url(
    settings.database_url,
    allow_legacy=settings.allow_legacy_database_path,
)
