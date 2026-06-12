from __future__ import annotations

import re

from fastapi import Header, HTTPException

DEFAULT_PANTRY_SESSION_ID = "anonymous"
_SESSION_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$")


def normalize_pantry_session_id(value: str | None) -> str:
    session_id = (value or DEFAULT_PANTRY_SESSION_ID).strip()
    if not _SESSION_ID_RE.fullmatch(session_id):
        raise ValueError("Invalid pantry session id")
    return session_id


def get_pantry_session_id(
    x_pantry_session_id: str | None = Header(default=None, alias="X-Pantry-Session-Id"),
) -> str:
    try:
        return normalize_pantry_session_id(x_pantry_session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
