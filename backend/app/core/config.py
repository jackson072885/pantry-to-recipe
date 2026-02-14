from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Local dev (SQLite file in backend root). No install needed.
    # For Postgres later:
    # postgresql+psycopg://user:pass@host:5432/onhand
    database_url: str = "sqlite:///./onhand.db"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")


settings = Settings()