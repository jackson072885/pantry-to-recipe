from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure test DB is used before app imports
os.environ.setdefault("DATABASE_URL", "sqlite:///./pantry_test.db")

from app.main import create_app  # noqa: E402
from app.db import engine  # noqa: E402


@pytest.fixture(scope="session")
def client() -> TestClient:
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_db() -> None:
    engine.dispose()
    backend_root = Path(__file__).resolve().parents[2]
    db_path = backend_root / "pantry_test.db"
    if db_path.exists():
        db_path.unlink()

    yield

    engine.dispose()
    backend_root = Path(__file__).resolve().parents[2]
    db_path = backend_root / "pantry_test.db"
    if db_path.exists():
        db_path.unlink()
