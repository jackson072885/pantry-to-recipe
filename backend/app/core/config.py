from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # SQLite local dev DB
    database_url: str = "sqlite:///./pantry.db"

    class Config:
        env_file = ".env"


settings = Settings()
