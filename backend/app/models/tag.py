from __future__ import annotations
from typing import List, Optional

from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_name: Mapped[str] = mapped_column(String(80), index=True)
    display_name: Mapped[str] = mapped_column(String(80))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    parent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("tags.id"), nullable=True)
    weight: Mapped[int] = mapped_column(Integer, default=0)

    parent = relationship("Tag", remote_side=[id], backref="children")
    recipes: Mapped[List["Recipe"]] = relationship(
        "Recipe",
        secondary="recipe_tags",
        back_populates="tags",
    )


class RecipeTag(Base):
    __tablename__ = "recipe_tags"

    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id", ondelete="CASCADE"), primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
