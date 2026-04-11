from __future__ import annotations

import json
import hashlib
import re
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.ingredient import Ingredient
from app.models.ingredient_alias import IngredientAlias, normalize_alias_text
from app.models.recipe import Recipe, RecipeIngredient, RecipeStep
from app.services.recipe_enrichment_service import (
    QUALITY_BUCKETS,
    build_enriched_recipe,
    find_duplicate_pairs,
    ingredient_aliases,
    score_recipe,
)

_ARCHIVE_PREFIX = "[ARCHIVED:"
_KEEP_REASONS = {"KEEP_AS_IS", "KEEP_AND_ENRICH", "KEEP_BUT_FLAG_FOR_REVIEW"}
CANONICAL_SOURCE_NAME = "recipes_real_v1"
RUNTIME_STATE_DATASET_HASH_KEY = "canonical_recipe_dataset_hash"
RUNTIME_STATE_RECIPE_COUNT_KEY = "canonical_recipe_dataset_count"
RUNTIME_STATE_SOURCE_PATH_KEY = "canonical_recipe_source_path"
_PLACEHOLDER_PATTERNS = ("placeholder", "todo", "lorem ipsum", "tbd", "until done")


def audit_recipes(db: Session) -> dict:
    recipes = _active_recipes(db)
    enriched_rows = [_serialize_recipe(recipe) for recipe in recipes]
    bucket_counts: dict[str, int] = {bucket: 0 for bucket in QUALITY_BUCKETS}
    flagged: list[dict] = []

    for row in enriched_rows:
        bucket = row.get("quality_bucket") or "KEEP_BUT_FLAG_FOR_REVIEW"
        if bucket not in bucket_counts:
            bucket_counts[bucket] = 0
        bucket_counts[bucket] += 1

        if bucket not in _KEEP_REASONS:
            flagged.append(
                {
                    "recipe_id": row["id"],
                    "recipe_name": row["name"],
                    "bucket": bucket,
                    "reason": row.get("quality_reason"),
                }
            )

    return {
        "total_active": len(enriched_rows),
        "bucket_counts": bucket_counts,
        "flagged": flagged,
        "duplicates": find_duplicate_pairs(enriched_rows),
    }


def archive_flagged_recipes(db: Session) -> dict:
    report = audit_recipes(db)
    archive_ids = {row["recipe_id"] for row in report["flagged"]}
    archived: list[dict] = []
    for recipe in _active_recipes(db):
        if recipe.id not in archive_ids:
            continue
        original_name = recipe.name
        recipe.name = f"{_ARCHIVE_PREFIX}{recipe.id}] {original_name}"
        archived.append(
            {
                "recipe_id": recipe.id,
                "original_name": original_name,
                "reason": recipe.quality_reason or "quality_gate",
            }
        )
    if archived:
        db.commit()
    return {"archived_count": len(archived), "archived": archived}


def seed_real_recipe_pack(db: Session) -> dict:
    source_snapshot = load_canonical_recipe_snapshot()
    enriched_source = source_snapshot["recipes"]
    curated_names = {row["name"] for row in enriched_source}
    curated_keys = {row["source_recipe_key"] for row in enriched_source}

    pruned_managed = _prune_stale_managed_recipes(db, curated_keys)
    archived_legacy = _archive_non_curated_active_recipes(db, curated_names)
    created = 0
    updated = 0

    for row in enriched_source:
        recipe = (
            db.query(Recipe)
            .filter(
                Recipe.source_dataset == CANONICAL_SOURCE_NAME,
                Recipe.source_recipe_key == row["source_recipe_key"],
            )
            .first()
        )
        if recipe is None:
            recipe = (
                db.query(Recipe)
                .filter(Recipe.name == row["name"], ~Recipe.name.like(f"{_ARCHIVE_PREFIX}%"))
                .first()
            )
        if recipe is None:
            recipe = Recipe(name=row["name"])
            db.add(recipe)
            db.flush()
            created += 1
        else:
            updated += 1

        _apply_recipe_fields(recipe, row)
        _sync_recipe_ingredients(db, recipe, row["ingredients"])
        _sync_recipe_steps(db, recipe, row["steps"])

    _write_runtime_bootstrap_state(
        db,
        dataset_hash=source_snapshot["dataset_hash"],
        recipe_count=len(enriched_source),
        source_path=str(_data_path()),
    )
    db.commit()
    return {
        "created": created,
        "updated": updated,
        "archived_legacy_count": archived_legacy,
        "pruned_managed_count": pruned_managed,
        "total_source": len(enriched_source),
        "dataset_hash": source_snapshot["dataset_hash"],
    }


def _load_source_payload() -> list[dict]:
    path = _data_path()
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError("recipes_real_v1.json must contain a list")
    return payload


def load_canonical_recipe_snapshot() -> dict[str, object]:
    payload = _load_source_payload()
    validated_rows: list[dict] = []
    identities: set[str] = set()

    for index, row in enumerate(payload, start=1):
        validated = _validate_source_row(row, index)
        key = _recipe_identity_key(validated["name"])
        if key in identities:
            raise ValueError(f"Canonical recipe dataset contains duplicate identity '{key}'")
        identities.add(key)

        enriched = build_enriched_recipe(validated, index)
        enriched["source_dataset"] = CANONICAL_SOURCE_NAME
        enriched["source_recipe_key"] = key
        enriched["source_payload_hash"] = _source_payload_hash(enriched)
        validated_rows.append(enriched)

    dataset_hash = _dataset_hash(validated_rows)
    return {
        "recipes": validated_rows,
        "dataset_hash": dataset_hash,
        "recipe_count": len(validated_rows),
    }


def inspect_canonical_recipe_drift(db: Session) -> dict[str, object]:
    source_snapshot = load_canonical_recipe_snapshot()
    expected_rows = {
        str(row["source_recipe_key"]): str(row["source_payload_hash"])
        for row in source_snapshot["recipes"]
    }
    managed_rows = (
        db.query(Recipe)
        .filter(Recipe.source_dataset == CANONICAL_SOURCE_NAME)
        .order_by(Recipe.id.asc())
        .all()
    )
    actual_rows = {
        str(recipe.source_recipe_key): str(recipe.source_payload_hash)
        for recipe in managed_rows
        if recipe.source_recipe_key
    }

    missing_keys = sorted(set(expected_rows) - set(actual_rows))
    extra_keys = sorted(set(actual_rows) - set(expected_rows))
    changed_keys = sorted(
        key
        for key in set(expected_rows) & set(actual_rows)
        if actual_rows[key] != expected_rows[key]
    )
    stored_dataset_hash = _read_runtime_bootstrap_state(db, RUNTIME_STATE_DATASET_HASH_KEY)
    stored_recipe_count = _read_runtime_bootstrap_state(db, RUNTIME_STATE_RECIPE_COUNT_KEY)
    expected_count = int(source_snapshot["recipe_count"])
    drift_detected = bool(
        missing_keys
        or extra_keys
        or changed_keys
        or stored_dataset_hash != source_snapshot["dataset_hash"]
        or stored_recipe_count != str(expected_count)
    )

    return {
        "drift_detected": drift_detected,
        "dataset_hash": source_snapshot["dataset_hash"],
        "stored_dataset_hash": stored_dataset_hash,
        "expected_recipe_count": expected_count,
        "stored_recipe_count": stored_recipe_count,
        "missing_keys": missing_keys,
        "extra_keys": extra_keys,
        "changed_keys": changed_keys,
    }


def _active_recipes(db: Session) -> list[Recipe]:
    return (
        db.query(Recipe)
        .filter(~Recipe.name.like(f"{_ARCHIVE_PREFIX}%"), Recipe.is_production_ready.is_(True))
        .order_by(Recipe.id.asc())
        .all()
    )


def _archive_non_curated_active_recipes(db: Session, curated_names: set[str]) -> int:
    archived_count = 0
    for recipe in _active_recipes(db):
        if recipe.source_dataset == CANONICAL_SOURCE_NAME:
            continue
        if recipe.name in curated_names:
            continue
        recipe.name = f"{_ARCHIVE_PREFIX}{recipe.id}] {recipe.name}"
        archived_count += 1
    if archived_count:
        db.flush()
    return archived_count


def _prune_stale_managed_recipes(db: Session, curated_keys: set[str]) -> int:
    stale_rows = (
        db.query(Recipe)
        .filter(Recipe.source_dataset == CANONICAL_SOURCE_NAME)
        .all()
    )
    pruned_count = 0
    for recipe in stale_rows:
        if recipe.source_recipe_key in curated_keys:
            continue
        db.delete(recipe)
        pruned_count += 1
    if pruned_count:
        db.flush()
    return pruned_count


def _apply_recipe_fields(recipe: Recipe, row: dict) -> None:
    recipe.name = row["name"]
    recipe.short_description = row.get("short_description")
    recipe.instructions = row.get("instructions")
    recipe.cook_method = row.get("cook_method")
    recipe.prep_time_minutes = row.get("prep_time_minutes")
    recipe.cook_time_minutes = row.get("cook_time_minutes")
    recipe.total_time_minutes = row.get("total_time_minutes")
    recipe.oven_temp_f = row.get("oven_temp_f")
    recipe.air_fryer_temp_f = row.get("air_fryer_temp_f")
    recipe.servings = row.get("servings", 2)
    recipe.difficulty = row.get("difficulty")
    recipe.primary_method = row.get("primary_method")
    recipe.primary_protein = row.get("primary_protein")
    recipe.cuisine = row.get("cuisine")
    recipe.cleanup_score = row.get("cleanup_score")
    recipe.prep_complexity = row.get("prep_complexity")
    recipe.meal_type = row.get("meal_type")
    recipe.equipment_json = row.get("equipment_json")
    recipe.substitutions_json = row.get("substitutions_json")
    recipe.tips_json = row.get("tips_json")
    recipe.warnings_json = row.get("warnings_json")
    recipe.storage_json = row.get("storage_json")
    recipe.tags_json = row.get("tags_json")
    recipe.quality_score = row.get("quality_score")
    recipe.quality_bucket = row.get("quality_bucket")
    recipe.quality_reason = row.get("quality_reason")
    recipe.review_status = row.get("review_status")
    recipe.is_weeknight_friendly = row.get("is_weeknight_friendly")
    recipe.is_beginner_friendly = row.get("is_beginner_friendly")
    recipe.is_production_ready = bool(row.get("is_production_ready", True))
    recipe.source_dataset = str(row["source_dataset"])
    recipe.source_recipe_key = str(row["source_recipe_key"])
    recipe.source_payload_hash = str(row["source_payload_hash"])


def _upsert_ingredient(db: Session, name: str, aliases: list[str]) -> Ingredient:
    canonical = name.strip().lower()
    ingredient = db.query(Ingredient).filter(Ingredient.canonical_name == canonical).first()
    if not ingredient:
        ingredient = Ingredient(canonical_name=canonical)
        db.add(ingredient)
        db.flush()

    for alias in aliases:
        alias_value = alias.strip().lower()
        if not alias_value or alias_value == canonical:
            continue
        normalized_alias = normalize_alias_text(alias_value)
        if not normalized_alias:
            continue
        exists = (
            db.query(IngredientAlias)
            .filter(
                IngredientAlias.ingredient_id == ingredient.id,
                IngredientAlias.normalized_alias == normalized_alias,
            )
            .first()
        )
        if not exists:
            db.add(IngredientAlias(ingredient_id=ingredient.id, alias=alias_value))

    return ingredient


def _sync_recipe_ingredients(db: Session, recipe: Recipe, ingredient_rows: list[dict]) -> None:
    existing = db.query(RecipeIngredient).filter(RecipeIngredient.recipe_id == recipe.id).all()
    existing_by_ingredient = {row.ingredient_id: row for row in existing}
    desired_ids: set[int] = set()

    for row in ingredient_rows:
        ingredient = _upsert_ingredient(
            db,
            str(row["canonical_name"]).strip().lower(),
            list(row.get("aliases", [])) + ingredient_aliases(str(row["canonical_name"]).strip().lower()),
        )
        desired_ids.add(ingredient.id)
        link = existing_by_ingredient.get(ingredient.id)
        if link is None:
            link = RecipeIngredient(recipe_id=recipe.id, ingredient_id=ingredient.id)
            db.add(link)
        link.is_required = bool(row.get("is_required", True))
        link.required_quantity = float(row.get("required_quantity") or 1.0)
        link.unit = str(row.get("unit") or "ea")
        link.display_quantity = row.get("display_quantity")
        link.display_unit = row.get("display_unit")
        link.display_name = row.get("display_name")
        link.pantry_name = row.get("pantry_name")
        link.prep_state = row.get("prep_state")
        link.notes = row.get("notes")
        link.sort_order = row.get("sort_order")
        link.measurement_is_estimated = bool(row.get("measurement_is_estimated", True))

    for row in existing:
        if row.ingredient_id not in desired_ids:
            db.delete(row)


def _sync_recipe_steps(db: Session, recipe: Recipe, step_rows: list[dict]) -> None:
    existing = db.query(RecipeStep).filter(RecipeStep.recipe_id == recipe.id).all()
    existing_by_number = {row.step_number: row for row in existing}
    desired_numbers: set[int] = set()

    for payload in step_rows:
        step_number = int(payload["step_number"])
        desired_numbers.add(step_number)
        step = existing_by_number.get(step_number)
        if step is None:
            step = RecipeStep(recipe_id=recipe.id, step_number=step_number)
            db.add(step)
        step.instruction_text = str(payload["instruction_text"]).strip()
        step.timing_minutes = payload.get("timing_minutes")
        step.temperature_f = payload.get("temperature_f")
        step.equipment = payload.get("equipment")
        step.doneness_cue = payload.get("doneness_cue")

    for row in existing:
        if row.step_number not in desired_numbers:
            db.delete(row)


def _serialize_recipe(recipe: Recipe) -> dict:
    equipment = _json_list(recipe.equipment_json)
    substitutions = _json_list(recipe.substitutions_json)
    tips = _json_list(recipe.tips_json)
    warnings = _json_list(recipe.warnings_json)
    storage = _json_list(recipe.storage_json)
    tags = _json_list(recipe.tags_json)
    ingredients = [
        {
            "pantry_name": ingredient.pantry_name or "",
            "is_required": ingredient.is_required,
        }
        for ingredient in sorted(
            recipe.ingredients,
            key=lambda row: (row.sort_order or 0, row.id or 0),
        )
    ]
    steps = [
        {
            "step_number": step.step_number,
            "instruction_text": step.instruction_text,
        }
        for step in recipe.steps
    ]
    row = {
        "id": recipe.id,
        "name": recipe.name,
        "short_description": recipe.short_description,
        "servings": recipe.servings,
        "total_time_minutes": recipe.total_time_minutes,
        "difficulty": recipe.difficulty,
        "meal_type": recipe.meal_type,
        "equipment": equipment,
        "substitutions": substitutions,
        "tips": tips,
        "warnings": warnings,
        "storage": storage,
        "tags": tags,
        "ingredients": ingredients,
        "steps": steps,
        "quality_score": recipe.quality_score,
        "quality_bucket": recipe.quality_bucket,
        "quality_reason": recipe.quality_reason,
        "review_status": recipe.review_status,
        "is_production_ready": recipe.is_production_ready,
    }
    if not row["quality_bucket"]:
        row.update(score_recipe(row))
    return row


def _json_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return [str(item) for item in parsed] if isinstance(parsed, list) else []


def _validate_source_row(row: dict, index: int) -> dict[str, object]:
    if not isinstance(row, dict):
        raise ValueError(f"Canonical recipe row {index} must be an object")

    name = str(row.get("name") or "").strip()
    if not name:
        raise ValueError(f"Canonical recipe row {index} is missing a name")

    instructions = str(row.get("instructions") or "").strip()
    if not instructions:
        raise ValueError(f"Canonical recipe '{name}' is missing instructions")
    lowered_instructions = instructions.lower()
    if any(token in lowered_instructions for token in _PLACEHOLDER_PATTERNS):
        raise ValueError(f"Canonical recipe '{name}' contains placeholder instructions")

    required = row.get("required")
    if not isinstance(required, list):
        raise ValueError(f"Canonical recipe '{name}' must declare a required ingredient list")
    normalized_required = _normalized_ingredient_names(required)
    if len(normalized_required) < 2:
        raise ValueError(f"Canonical recipe '{name}' must have at least two required ingredients")

    optional = row.get("optional", [])
    if not isinstance(optional, list):
        raise ValueError(f"Canonical recipe '{name}' must declare an optional ingredient list")

    servings = row.get("servings", 2)
    if servings is not None and int(servings) <= 0:
        raise ValueError(f"Canonical recipe '{name}' must have positive servings")

    for field_name in ("prep_time_minutes", "cook_time_minutes", "total_time_minutes"):
        value = row.get(field_name)
        if value is not None and int(value) < 0:
            raise ValueError(f"Canonical recipe '{name}' has invalid {field_name}")

    validated = dict(row)
    validated["name"] = name
    validated["instructions"] = instructions
    validated["required"] = normalized_required
    validated["optional"] = _normalized_ingredient_names(optional)
    return validated


def _normalized_ingredient_names(values: list[object]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        name = str(value or "").strip().lower()
        if not name:
            raise ValueError("Canonical recipe ingredient names must be non-empty")
        if name in seen:
            continue
        seen.add(name)
        normalized.append(name)
    return normalized


def _recipe_identity_key(name: str) -> str:
    lowered = name.strip().lower().replace("&", "and")
    lowered = re.sub(r"[^a-z0-9\s]", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def _source_payload_hash(row: dict) -> str:
    payload = {
        key: value
        for key, value in row.items()
        if key not in {"source_dataset", "source_recipe_key", "source_payload_hash"}
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _dataset_hash(rows: list[dict]) -> str:
    payload = [
        {
            "source_recipe_key": row["source_recipe_key"],
            "source_payload_hash": row["source_payload_hash"],
        }
        for row in rows
    ]
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _read_runtime_bootstrap_state(db: Session, key: str) -> str | None:
    row = db.execute(
        text("SELECT value FROM runtime_bootstrap_state WHERE key = :key"),
        {"key": key},
    ).scalar_one_or_none()
    if row is None:
        return None
    return str(row)


def _write_runtime_bootstrap_state(
    db: Session,
    *,
    dataset_hash: str,
    recipe_count: int,
    source_path: str,
) -> None:
    values = {
        RUNTIME_STATE_DATASET_HASH_KEY: dataset_hash,
        RUNTIME_STATE_RECIPE_COUNT_KEY: str(recipe_count),
        RUNTIME_STATE_SOURCE_PATH_KEY: source_path,
    }
    for key, value in values.items():
        db.execute(
            text(
                """
                INSERT INTO runtime_bootstrap_state(key, value)
                VALUES (:key, :value)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """
            ),
            {"key": key, "value": value},
        )


def _data_path() -> Path:
    return Path(__file__).resolve().parents[1] / "data" / "recipes_real_v1.json"
