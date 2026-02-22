from __future__ import annotations
from typing import List

from sqlalchemy import String, Integer, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


# -------------------------------------------------------
# Recipe
# -------------------------------------------------------

class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)

    ingredients: Mapped[List["RecipeIngredient"]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan"
    )

    tags: Mapped[List["Tag"]] = relationship(
        "Tag",
        secondary="recipe_tags",
        back_populates="recipes",
    )


# -------------------------------------------------------
# RecipeIngredient (join table)
# -------------------------------------------------------

class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    recipe_id: Mapped[int] = mapped_column(
        ForeignKey("recipes.id", ondelete="CASCADE"),
        index=True
    )

    ingredient_id: Mapped[int] = mapped_column(
        ForeignKey("ingredients.id", ondelete="CASCADE"),
        index=True
    )

    is_required: Mapped[bool] = mapped_column(Boolean, default=True)

    recipe: Mapped["Recipe"] = relationship(back_populates="ingredients")

    __table_args__ = (
        UniqueConstraint("recipe_id", "ingredient_id", name="uq_recipe_ingredient"),
    )
