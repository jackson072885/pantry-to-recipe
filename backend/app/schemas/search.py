from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class TagOut(BaseModel):
    id: int
    group_name: str
    display_name: str
    slug: str
    parent_id: int | None
    weight: int


class TagGroupOut(BaseModel):
    name: str
    tags: list[TagOut] = Field(default_factory=list)


class TagsResponse(BaseModel):
    groups: list[TagGroupOut] = Field(default_factory=list)


class SearchRequest(BaseModel):
    include: dict[str, list[str]] = Field(default_factory=dict)
    exclude: dict[str, list[str]] = Field(default_factory=dict)


class SearchRecipeOut(BaseModel):
    recipe_id: int
    recipe_name: str
    matched_tags: list[str] = Field(default_factory=list)


class SearchResponse(BaseModel):
    cook_now: list[SearchRecipeOut] = Field(default_factory=list)
    almost_there: list[SearchRecipeOut] = Field(default_factory=list)
    not_practical: list[SearchRecipeOut] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)
