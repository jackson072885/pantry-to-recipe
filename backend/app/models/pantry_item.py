
from __future__ import annotations

from sqlalchemy import Integer, ForeignKey, UniqueConstraint, String, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PantryItem(Base):
    __tablename__ = "pantry_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    ingredient_id: Mapped[int] = mapped_column(
        ForeignKey("ingredients.id", ondelete="CASCADE"),
        index=True
    )

    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit: Mapped[str] = mapped_column(String(16), default="ea")
    quantity_is_known: Mapped[bool] = mapped_column(Boolean, default=True)
    use_soon: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(32), default="manual")

    ingredient = relationship("Ingredient")

    __table_args__ = (
        UniqueConstraint("ingredient_id", name="uq_pantry_ingredient"),
    )






