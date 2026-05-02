from __future__ import annotations

import json
from pathlib import Path


CATALOG_PATH = Path(__file__).resolve().parents[1] / "data" / "ingredient_catalog_v1.json"


def _catalog() -> dict:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def test_ingredient_catalog_is_curated_app_layer_not_raw_usda_dump() -> None:
    catalog = _catalog()
    items = catalog["items"]

    assert 80 <= len(items) <= 150
    assert catalog["families"]
    assert "Raw USDA files remain local under data/usda/" in " ".join(catalog["sourceNotes"])
    assert all("fdcId" not in item for item in items)


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
