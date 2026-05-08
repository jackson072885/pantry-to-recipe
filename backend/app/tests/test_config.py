from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.config import cors_allowed_origin_list
from app.main import create_app, settings


def test_cors_allowed_origins_keep_local_dev_defaults():
    assert cors_allowed_origin_list("") == [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ]


def test_cors_allowed_origins_add_hosted_frontend_origin_once():
    assert cors_allowed_origin_list(" https://demo.example.test/ , http://localhost:5173 ") == [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "https://demo.example.test",
    ]


def test_configured_cors_origin_allows_browser_preflight(monkeypatch):
    monkeypatch.setattr(settings, "cors_allowed_origins", "https://demo.example.test")

    with TestClient(create_app()) as client:
        response = client.options(
            "/recommendations",
            headers={
                "Origin": "https://demo.example.test",
                "Access-Control-Request-Method": "GET",
            },
        )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://demo.example.test"
