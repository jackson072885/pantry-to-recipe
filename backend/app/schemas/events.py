from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

TrackedEventName = Literal[
    "recipe_selected",
    "cook_clicked",
    "ingredients_requested",
    "recipe_cooked_confirmed",
    "recipe_liked",
    "recipe_skipped",
    "cta_rendered",
    "cta_clicked",
    "outbound_link_opened",
]


class UserActionRequest(BaseModel):
    event: TrackedEventName
    recipe_id: int | None = Field(default=None, ge=1)
    metadata: dict[str, Any] = Field(default_factory=dict)


class UserActionResponse(BaseModel):
    action_id: int
    event: TrackedEventName
    recipe_id: int | None = None
    recorded_at: str
    accepted: bool = True
