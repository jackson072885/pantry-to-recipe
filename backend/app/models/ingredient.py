from __future__ import annotations
from typing import List, Optional

from sqlalchemy import String, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Ingredient(Base):
    __tablename__ = "ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    canonical_name: Mapped[str] = mapped_column(
        String(120),
        unique=True,
        index=True
    )

    category: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)

    is_staple: Mapped[bool] = mapped_column(Boolean, default=False)

    aliases: Mapped[List["IngredientAlias"]] = relationship(
        back_populates="ingredient",
        cascade="all, delete-orphan"
    )