from __future__ import annotations

from fastapi import APIRouter

from app.api.responses import error_response

MATCH_ENDPOINT_DEPRECATED = "MATCH_ENDPOINT_DEPRECATED"
MATCH_REPLACEMENT_MESSAGE = (
    "The /match endpoints are deprecated. Use GET /recommendations?pantry=item&pantry=item for the live recommendation flow."
)

router = APIRouter(prefix="/match", tags=["match"])


@router.get("")
@router.get("/")
@router.post("")
@router.post("/")
def match_deprecated():
    return _deprecated_match_response("/recommendations")


@router.get("/v2")
@router.post("/v2")
def match_v2_deprecated():
    return _deprecated_match_response("/recommendations")


def _deprecated_match_response(replacement_path: str):
    return error_response(
        MATCH_ENDPOINT_DEPRECATED,
        MATCH_REPLACEMENT_MESSAGE,
        410,
        data={
            "deprecated_endpoint": "/match",
            "replacement": {
                "path": replacement_path,
                "method": "GET",
                "query_format": "pantry=item&pantry=item",
            },
        },
    )
