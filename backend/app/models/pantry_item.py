
from __future__ import annotations

from sqlalchemy import Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PantryItem(Base):
    __tablename__ = "pantry_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    ingredient_id: Mapped[int] = mapped_column(
        ForeignKey("ingredients.id", ondelete="CASCADE"),
        index=True
    )

    quantity: Mapped[int] = mapped_column(Integer, default=1)

    ingredient = relationship("Ingredient")

    __table_args__ = (
        UniqueConstraint("ingredient_id", name="uq_pantry_ingredient"),
    )






