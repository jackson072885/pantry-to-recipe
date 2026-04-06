from __future__ import annotations

from contextlib import asynccontextmanager
import logging
import time

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.responses import INTERNAL_ERROR, VALIDATION_ERROR, error_response, success_response
from app.api.router import api_router
from app.services.runtime_bootstrap_service import bootstrap_runtime_state

logger = logging.getLogger(__name__)
REQUEST_LOG_PATHS = ("/recommendations", "/pantry", "/recipes", "/cook", "/events")


def configure_logging() -> None:
    root_logger = logging.getLogger()
    if root_logger.handlers:
        return

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


def _should_log_request(path: str) -> bool:
    return path == "/" or any(path.startswith(prefix) for prefix in REQUEST_LOG_PATHS)


@asynccontextmanager
async def app_lifespan(_app: FastAPI):
    try:
        summary = bootstrap_runtime_state()
        logger.info(
            "Runtime bootstrap completed: database_path=%s canonical_recipe_source=%s",
            summary.get("database_path"),
            summary.get("canonical_recipe_source"),
        )
    except Exception as exc:
        logger.exception("Runtime bootstrap failed: %s", exc)
        raise

    yield


def create_app() -> FastAPI:
    configure_logging()

    app = FastAPI(title="Pantry-to-Recipe API", version="0.1", lifespan=app_lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        should_log = _should_log_request(request.url.path)
        started_at = time.perf_counter()

        if should_log:
            logger.info("Request start: method=%s path=%s", request.method, request.url.path)

        try:
            response = await call_next(request)
        except Exception:
            if should_log:
                elapsed_ms = (time.perf_counter() - started_at) * 1000
                logger.exception(
                    "Request failed: method=%s path=%s duration_ms=%.2f",
                    request.method,
                    request.url.path,
                    elapsed_ms,
                )
            raise

        if should_log:
            elapsed_ms = (time.perf_counter() - started_at) * 1000
            logger.info(
                "Request end: method=%s path=%s status=%s duration_ms=%.2f",
                request.method,
                request.url.path,
                response.status_code,
                elapsed_ms,
            )
        return response

    app.include_router(api_router)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        logger.warning("Request validation failed: path=%s errors=%s", request.url.path, exc.errors())
        return error_response(VALIDATION_ERROR, "Validation failed", 422, data=exc.errors())

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        logger.warning("HTTP exception: path=%s status=%s detail=%s", request.url.path, exc.status_code, exc.detail)
        if isinstance(exc.detail, dict):
            code = str(exc.detail.get("code") or "BAD_REQUEST")
            message = str(exc.detail.get("message") or "Request failed")
            return error_response(code, message, exc.status_code)

        detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
        code = "NOT_FOUND" if exc.status_code == 404 else "VALIDATION_ERROR" if exc.status_code == 422 else "BAD_REQUEST"
        return error_response(code, detail, exc.status_code)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled application error: path=%s", request.url.path)
        return error_response(INTERNAL_ERROR, "Internal server error", 500)

    @app.get("/")
    def root() -> JSONResponse:
        return success_response({"status": "running"})

    return app


app = create_app()
