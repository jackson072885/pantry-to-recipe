import re

from sqlalchemy import String, ForeignKey, event
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

UNIT_TOKENS = {
    "lb",
    "lbs",
    "oz",
    "g",
    "kg",
    "ml",
    "l",
    "cup",
    "cups",
    "tbsp",
    "tsp",
    "teaspoon",
    "teaspoons",
    "tablespoon",
    "tablespoons",
    "pint",
    "quart",
    "gallon",
    "ea",
    "each",
}
JUNK_TOKENS = {"unknown", "n/a", "n a", "na", "none"}


def _singularize_token(token: str) -> str:
    if token.endswith("ss"):
        return token
    if len(token) > 3 and token.endswith("ies"):
        return f"{token[:-3]}y"
    if len(token) > 3 and token.endswith("s"):
        return token[:-1]
    return token


def normalize_alias_text(text: str | None) -> str:
    if not text:
        return ""
    value = str(text).strip().lower()
    if re.fullmatch(r"[a-z0-9_-]+", value):
        return "" if value in JUNK_TOKENS else value
    value = re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", value)
    value = re.sub(r"[_/-]", " ", value)
    value = re.sub(r"[()[\]{}.,:;'\"!?]", "", value)
    value = re.sub(r"\s+", " ", value).strip()
    if not value:
        return ""

    tokens = [
        _singularize_token(token)
        for token in value.split(" ")
        if token
        and token not in UNIT_TOKENS
        and not re.fullmatch(r"\d+([.,]\d+)?", token)
    ]
    cleaned = " ".join(tokens).strip()
    if not cleaned or cleaned in JUNK_TOKENS:
        return ""
    return cleaned


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
    target.normalized_alias = normalize_alias_text(target.alias)


@event.listens_for(IngredientAlias, "before_update")
def set_normalized_before_update(mapper, connection, target):
    target.normalized_alias = normalize_alias_text(target.alias)
