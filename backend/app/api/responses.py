from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

BAD_REQUEST = "BAD_REQUEST"
CONFLICT = "CONFLICT"
INSUFFICIENT_PANTRY = "INSUFFICIENT_PANTRY"
INTERNAL_ERROR = "INTERNAL_ERROR"
NOT_FOUND = "NOT_FOUND"
VALIDATION_ERROR = "VALIDATION_ERROR"

logger = logging.getLogger(__name__)


class APIError(Exception):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def success_response(data: Any = None, status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": True,
            "data": jsonable_encoder(data),
            "error": None,
        },
    )


def error_response(code: str, message: str, status_code: int, data: Any = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "data": jsonable_encoder(data),
            "error": {
                "code": code,
                "message": message,
            },
        },
    )


def _code_from_status(status_code: int) -> str:
    if status_code == 404:
        return NOT_FOUND
    if status_code == 409:
        return CONFLICT
    if status_code == 422:
        return VALIDATION_ERROR
    if 400 <= status_code < 500:
        return BAD_REQUEST
    return INTERNAL_ERROR


def _http_error_parts(exc: HTTPException) -> tuple[str, str, int]:
    detail = exc.detail
    if isinstance(detail, dict):
        code = str(detail.get("code") or _code_from_status(exc.status_code))
        message = str(detail.get("message") or "Request failed")
        return code, message, exc.status_code

    message = detail if isinstance(detail, str) else "Request failed"
    return _code_from_status(exc.status_code), message, exc.status_code


def route_response(
    action: Callable[[], Any],
    *,
    success_status_code: int = 200,
    value_error_code: str = BAD_REQUEST,
    value_error_status_code: int = 400,
    error_mapper: Callable[[ValueError], tuple[str, str, int]] | None = None,
    default_error: str,
    db: Session | None = None,
) -> JSONResponse:
    try:
        return success_response(action(), status_code=success_status_code)
    except APIError as exc:
        if db is not None:
            db.rollback()
        logger.warning("API error: code=%s status=%s message=%s", exc.code, exc.status_code, exc.message)
        return error_response(exc.code, exc.message, exc.status_code)
    except ValueError as exc:
        if db is not None:
            db.rollback()
        if error_mapper is not None:
            code, message, status_code = error_mapper(exc)
        else:
            code, message, status_code = value_error_code, str(exc), value_error_status_code
        logger.warning("Validation error: code=%s status=%s message=%s", code, status_code, message)
        return error_response(code, message, status_code)
    except HTTPException as exc:
        if db is not None:
            db.rollback()
        code, message, status_code = _http_error_parts(exc)
        logger.warning("HTTP error: code=%s status=%s message=%s", code, status_code, message)
        return error_response(code, message, status_code)
    except Exception:
        if db is not None:
            db.rollback()
        logger.exception("Unhandled route error")
        return error_response(INTERNAL_ERROR, default_error, 500)
