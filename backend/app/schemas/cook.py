from __future__ import annotations

from pydantic import BaseModel


class CookResponse(BaseModel):
    recipe_id: int
    recipe_name: str
    deducted: list[str]
