from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path


CATALOG_PATH = Path(__file__).resolve().parents[1] / "data" / "ingredient_catalog_v1.json"


def _catalog() -> dict:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def _normalized(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def test_ingredient_catalog_is_curated_app_layer_not_raw_usda_dump() -> None:
    catalog = _catalog()
    items = catalog["items"]

    assert 80 <= len(items) <= 150
    assert catalog["families"]
    assert "Raw USDA files remain local under data/usda/" in " ".join(catalog["sourceNotes"])
    assert all("fdcId" not in item for item in items)


def test_ingredient_catalog_root_shape_is_stable() -> None:
    catalog = _catalog()

    assert set(catalog) == {"schemaVersion", "sourceNotes", "families", "items"}
    assert catalog["schemaVersion"] == 1
    assert isinstance(catalog["sourceNotes"], list)
    assert all(isinstance(note, str) and note.strip() for note in catalog["sourceNotes"])
    assert isinstance(catalog["families"], list)
    assert isinstance(catalog["items"], list)
    assert 80 <= len(catalog["items"]) <= 150


def test_ingredient_catalog_family_contract_matches_product_hierarchy() -> None:
    catalog = _catalog()
    families = catalog["families"]
    expected_family_ids = [
        "proteins",
        "beans_legumes",
        "grains_pasta_starches",
        "vegetables",
        "fruits",
        "dairy",
        "nuts_seeds_butters",
        "oils_fats",
        "sauces_condiments",
        "drinks_plant_milks",
        "pantry_basics",
        "prepared_not_core",
    ]

    assert [family["id"] for family in families] == expected_family_ids
    assert all(set(family) == {"id", "displayName"} for family in families)
    assert all(isinstance(family["displayName"], str) and family["displayName"].strip() for family in families)


def test_ingredient_catalog_items_follow_schema_contract() -> None:
    catalog = _catalog()
    family_ids = {family["id"] for family in catalog["families"]}
    required_item_keys = {
        "id",
        "displayName",
        "canonicalName",
        "family",
        "subfamily",
        "aliases",
        "commonUnits",
        "defaultUnit",
        "quickAdd",
        "browser",
        "matching",
        "tags",
        "usda",
    }

    for item in catalog["items"]:
        assert set(item) == required_item_keys
        assert re.fullmatch(r"[a-z0-9]+(?:_[a-z0-9]+)*", item["id"])
        assert isinstance(item["displayName"], str) and item["displayName"].strip()
        assert "," not in item["displayName"]
        assert isinstance(item["canonicalName"], str) and item["canonicalName"].strip()
        assert item["family"] in family_ids
        assert isinstance(item["subfamily"], str) and item["subfamily"].strip()
        assert isinstance(item["aliases"], list)
        assert all(isinstance(alias, str) and alias.strip() for alias in item["aliases"])
        assert isinstance(item["commonUnits"], list) and item["commonUnits"]
        assert all(isinstance(unit, str) and unit.strip() for unit in item["commonUnits"])
        assert item["defaultUnit"] in item["commonUnits"]
        assert set(item["quickAdd"]) == {"enabled", "priority"}
        assert isinstance(item["quickAdd"]["enabled"], bool)
        assert isinstance(item["quickAdd"]["priority"], int)
        assert set(item["browser"]) == {"enabled", "groupPath"}
        assert isinstance(item["browser"]["enabled"], bool)
        assert isinstance(item["browser"]["groupPath"], list)
        assert item["browser"]["groupPath"][0] == "Ingredients"
        if item["browser"]["enabled"]:
            assert len(item["browser"]["groupPath"]) >= 3
        assert set(item["matching"]) == {"rollups"}
        assert isinstance(item["matching"]["rollups"], list)
        assert all(isinstance(rollup, str) and rollup.strip() for rollup in item["matching"]["rollups"])
        assert isinstance(item["tags"], list)
        assert all(isinstance(tag, str) and tag.strip() for tag in item["tags"])
        assert set(item["usda"]) == {"source", "descriptions", "fdcIds"}
        assert item["usda"]["source"] == "foundation_foods"
        assert isinstance(item["usda"]["descriptions"], list)
        assert all(isinstance(description, str) and description.strip() for description in item["usda"]["descriptions"])
        assert isinstance(item["usda"]["fdcIds"], list)
        assert all(isinstance(fdc_id, int) for fdc_id in item["usda"]["fdcIds"])
        assert all(
            item["displayName"] != description or "," not in description
            for description in item["usda"]["descriptions"]
        )


def test_ingredient_catalog_names_and_aliases_are_unambiguous() -> None:
    items = _catalog()["items"]

    for field in ["id", "displayName", "canonicalName"]:
        values = [_normalized(str(item[field])) for item in items]
        duplicates = sorted(value for value, count in Counter(values).items() if count > 1)
        assert duplicates == []

    alias_owners: dict[str, list[str]] = defaultdict(list)
    primary_terms: dict[str, str] = {}
    for item in items:
        primary_terms[_normalized(item["displayName"])] = item["id"]
        primary_terms[_normalized(item["canonicalName"])] = item["id"]
        aliases = [_normalized(alias) for alias in item["aliases"]]
        assert len(aliases) == len(set(aliases))
        for alias in aliases:
            assert alias != _normalized(item["canonicalName"])
            alias_owners[alias].append(item["id"])

    duplicate_aliases = {alias: owners for alias, owners in alias_owners.items() if len(owners) > 1}
    assert duplicate_aliases == {}

    aliases_for_other_primary_items = {
        alias: {"aliasOwner": owners[0], "primaryOwner": primary_terms[alias]}
        for alias, owners in alias_owners.items()
        if alias in primary_terms and primary_terms[alias] not in owners
    }
    assert aliases_for_other_primary_items == {}


def test_ingredient_catalog_supports_core_pantry_intelligence_fields() -> None:
    catalog = _catalog()
    item_by_id = {item["id"]: item for item in catalog["items"]}

    for required_id in ["ground_beef", "bell_pepper", "chicken_breast", "green_onion", "black_beans"]:
        item = item_by_id[required_id]
        assert item["displayName"]
        assert item["canonicalName"]
        assert item["family"]
        assert item["subfamily"]
        assert isinstance(item["aliases"], list)
        assert item["commonUnits"]
        assert item["defaultUnit"] in item["commonUnits"]
        assert isinstance(item["quickAdd"]["enabled"], bool)
        assert isinstance(item["quickAdd"]["priority"], int)
        assert item["browser"]["groupPath"][0] == "Ingredients"
        assert isinstance(item["matching"]["rollups"], list)
        assert item["usda"]["source"] == "foundation_foods"
        assert isinstance(item["usda"]["descriptions"], list)


def test_protein_and_legume_catalog_families_keep_matching_distinctions() -> None:
    item_by_id = {item["id"]: item for item in _catalog()["items"]}

    assert item_by_id["ground_beef"]["browser"]["groupPath"] == ["Ingredients", "Proteins", "Beef"]
    assert item_by_id["ground_beef"]["matching"]["rollups"] == ["beef"]
    assert item_by_id["bell_pepper"]["aliases"] == [
        "bell peppers",
        "red bell pepper",
        "green bell pepper",
        "yellow bell pepper",
        "orange bell pepper",
        "capsicum",
    ]
    assert item_by_id["green_onion"]["canonicalName"] == "green onion"
    assert "shallot" not in item_by_id["green_onion"]["aliases"]
    assert item_by_id["black_beans"]["family"] == "beans_legumes"
    assert "beans" in item_by_id["black_beans"]["matching"]["rollups"]
