from sqlalchemy import String, ForeignKey, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def _normalize(text: str) -> str:
    if not text:
        return ""
    return " ".join(text.lower().strip().split())


class IngredientAlias(Base):
    __tablename__ = "ingredient_aliases"

    id: Mapped[int] = mapped_column(primary_key=True)

    ingredient_id: Mapped[int] = mapped_column(
        ForeignKey("ingredients.id", ondelete="CASCADE"),
        index=True
    )

    alias: Mapped[str] = mapped_column(String(120), nullable=False)
    normalized_alias: Mapped[str] = mapped_column(String(120), nullable=False, index=True)

    ingredient = relationship("Ingredient", back_populates="aliases")


# --- automatic normalization ---
@event.listens_for(IngredientAlias, "before_insert")
def set_normalized_before_insert(mapper, connection, target):
    target.normalized_alias = _normalize(target.alias)


@event.listens_for(IngredientAlias, "before_update")
def set_normalized_before_update(mapper, connection, target):
    target.normalized_alias = _normalize(target.alias)
