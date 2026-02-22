
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Integer, ForeignKey, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PantryTransaction(Base):
    __tablename__ = "pantry_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    ingredient_id: Mapped[int] = mapped_column(
        ForeignKey("ingredients.id", ondelete="CASCADE"),
        index=True
    )

    change: Mapped[int] = mapped_column(Integer)  # +1 add, -1 remove
    reason: Mapped[str] = mapped_column(String(100), default="manual")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    ingredient = relationship("Ingredient")