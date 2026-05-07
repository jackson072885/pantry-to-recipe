
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Integer, ForeignKey, DateTime, String, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PantryTransaction(Base):
    __tablename__ = "pantry_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(String(128), default="anonymous", index=True)

    ingredient_id: Mapped[int] = mapped_column(
        ForeignKey("ingredients.id", ondelete="CASCADE"),
        index=True
    )

    change: Mapped[float] = mapped_column(Float)  # +1 add, -1 remove
    unit: Mapped[str] = mapped_column(String(16), default="ea")
    reason: Mapped[str] = mapped_column(String(100), default="manual")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    ingredient = relationship("Ingredient")
