from __future__ import annotations

from typing import List

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    short_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    cook_method: Mapped[str | None] = mapped_column(String(40), nullable=True)
    prep_time_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cook_time_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_time_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    oven_temp_f: Mapped[int | None] = mapped_column(Integer, nullable=True)
    air_fryer_temp_f: Mapped[int | None] = mapped_column(Integer, nullable=True)
    servings: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    difficulty: Mapped[str | None] = mapped_column(String(40), nullable=True)
    primary_method: Mapped[str | None] = mapped_column(String(60), nullable=True)
    primary_protein: Mapped[str | None] = mapped_column(String(60), nullable=True)
    cuisine: Mapped[str | None] = mapped_column(String(60), nullable=True)
    cleanup_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    prep_complexity: Mapped[str | None] = mapped_column(String(60), nullable=True)
    meal_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    equipment_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    substitutions_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    tips_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    warnings_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    storage_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    quality_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quality_bucket: Mapped[str | None] = mapped_column(String(40), nullable=True)
    quality_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    is_weeknight_friendly: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_beginner_friendly: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    is_production_ready: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    source_dataset: Mapped[str | None] = mapped_column(String(80), nullable=True, index=True)
    source_recipe_key: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    source_payload_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    ingredients: Mapped[List["RecipeIngredient"]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan",
    )
    steps: Mapped[List["RecipeStep"]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan",
        order_by="RecipeStep.step_number",
    )
    tags: Mapped[List["Tag"]] = relationship(
        "Tag",
        secondary="recipe_tags",
        back_populates="recipes",
    )


class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recipe_id: Mapped[int] = mapped_column(
        ForeignKey("recipes.id", ondelete="CASCADE"),
        index=True,
    )
    ingredient_id: Mapped[int] = mapped_column(
        ForeignKey("ingredients.id", ondelete="CASCADE"),
        index=True,
    )
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)
    required_quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit: Mapped[str] = mapped_column(String(16), default="ea")
    display_quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    display_unit: Mapped[str | None] = mapped_column(String(24), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    pantry_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    prep_state: Mapped[str | None] = mapped_column(String(80), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    measurement_is_estimated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    recipe: Mapped["Recipe"] = relationship(back_populates="ingredients")

    __table_args__ = (
        UniqueConstraint("recipe_id", "ingredient_id", name="uq_recipe_ingredient"),
    )


class RecipeStep(Base):
    __tablename__ = "recipe_steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recipe_id: Mapped[int] = mapped_column(
        ForeignKey("recipes.id", ondelete="CASCADE"),
        index=True,
    )
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    instruction_text: Mapped[str] = mapped_column(Text, nullable=False)
    timing_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    temperature_f: Mapped[int | None] = mapped_column(Integer, nullable=True)
    equipment: Mapped[str | None] = mapped_column(String(80), nullable=True)
    doneness_cue: Mapped[str | None] = mapped_column(String(160), nullable=True)

    recipe: Mapped["Recipe"] = relationship(back_populates="steps")
