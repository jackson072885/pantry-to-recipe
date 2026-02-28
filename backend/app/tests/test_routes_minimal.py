from __future__ import annotations


def test_match_endpoint(client):
    response = client.post("/match", json={"pantry": ["chicken", "rice", "salt"]})
    assert response.status_code == 200
    data = response.json()
    assert "cookable" in data
    assert "almost" in data
    assert "not_cookable" in data


def test_pantry_add_remove(client):
    response = client.post("/pantry/add", json={"name": "test_ingredient", "amount": 2})
    assert response.status_code == 200
    data = response.json()
    items = {item["ingredient"]: item for item in data.get("items", [])}
    assert items["test_ingredient"]["quantity"] == 2.0
    assert items["test_ingredient"]["unit"] == "ea"

    response = client.post("/pantry/remove", json={"name": "test_ingredient", "amount": 1})
    assert response.status_code == 200
    data = response.json()
    items = {item["ingredient"]: item for item in data.get("items", [])}
    assert items["test_ingredient"]["quantity"] == 1.0
    assert items["test_ingredient"]["unit"] == "ea"


def test_search_endpoints(client):
    tags_response = client.get("/search/tags")
    assert tags_response.status_code == 200
    tags_data = tags_response.json()
    assert "groups" in tags_data

    search_response = client.post("/search", json={"include": {}, "exclude": {}})
    assert search_response.status_code == 200
    search_data = search_response.json()
    assert "cook_now" in search_data
    assert "almost_there" in search_data
    assert "not_practical" in search_data
