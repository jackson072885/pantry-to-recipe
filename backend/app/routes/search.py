from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.search import (
    TagsResponse,
    TagGroupOut,
    TagOut,
    FiltersResponse,
    SearchRequest,
    SearchResponse,
    SearchRecipeOut,
)
from app.services.search_service import (
    ensure_tags,
    get_grouped_tags,
    get_filter_options,
    search_recipes,
)

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/tags", response_model=TagsResponse)
def list_tags(db: Session = Depends(get_db)) -> TagsResponse:
    try:
        tags = ensure_tags(db)
        grouped = get_grouped_tags(tags)
        groups = [
            TagGroupOut(
                name=group["name"],
                tags=[
                    TagOut(
                        id=tag.id,
                        group_name=tag.group_name,
                        display_name=tag.display_name,
                        slug=tag.slug,
                        parent_id=tag.parent_id,
                        weight=tag.weight,
                    )
                    for tag in group["tags"]
                ],
            )
            for group in grouped
        ]
        return TagsResponse(groups=groups)
    except Exception:
        raise HTTPException(status_code=500, detail="Tag list failed")


@router.post("", response_model=SearchResponse)
def search(request: SearchRequest, db: Session = Depends(get_db)) -> SearchResponse:
    try:
        results = search_recipes(
            db,
            request.include,
            request.exclude,
            request.filters,
            request.mode,
        )

        def map_items(items):
            return [
                SearchRecipeOut(
                    recipe_id=item["recipe"].id,
                    recipe_name=item["recipe"].name,
                    matched_tags=item["matched_tags"],
                    missing_count=item.get("missing_count", 0),
                )
                for item in items
            ]

        return SearchResponse(
            cook_now=map_items(results["cook_now"]),
            almost_there=map_items(results["almost_there"]),
            not_practical=map_items(results["not_practical"]),
            meta=results["meta"],
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Search failed")


@router.get("/filters", response_model=FiltersResponse)
def list_filters(db: Session = Depends(get_db)) -> FiltersResponse:
    try:
        data = get_filter_options(db)
        return FiltersResponse(**data)
    except Exception:
        raise HTTPException(status_code=500, detail="Filter list failed")
