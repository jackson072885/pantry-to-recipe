from __future__ import annotations


def _unwrap(response):
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    return body["data"]


def test_pantry_remove_accepts_the_saved_row_quantity_and_unit(client):
    client.post("/pantry/clear")

    add_response = client.post("/pantry/add", json={"name": "precision_rice", "amount": 2, "unit": "cup"})
    assert add_response.status_code == 200

    remove_response = client.post("/pantry/remove", json={"name": "precision_rice", "amount": 480, "unit": "ml"})
    assert remove_response.status_code == 200
    data = _unwrap(remove_response)
    assert data["items"] == []


def test_pantry_accepts_fractional_add_amounts(client):
    client.post("/pantry/clear")

    response = client.post("/pantry/add", json={"name": "fractional_oil", "amount": 0.25, "unit": "cup"})
    assert response.status_code == 200
    data = _unwrap(response)
    assert data["items"] == [
        {
            "ingredient": "fractional_oil",
            "quantity": 60.0,
            "unit": "ml",
        }
    ]


def test_pantry_fractional_remove_preserves_remaining_quantity(client):
    client.post("/pantry/clear")

    add_response = client.post("/pantry/add", json={"name": "fractional_stock", "amount": 1.5, "unit": "cup"})
    assert add_response.status_code == 200

    remove_response = client.post("/pantry/remove", json={"name": "fractional_stock", "amount": 0.5, "unit": "cup"})
    assert remove_response.status_code == 200
    data = _unwrap(remove_response)
    assert data["items"] == [
        {
            "ingredient": "fractional_stock",
            "quantity": 240.0,
            "unit": "ml",
        }
    ]


def test_pantry_remove_exact_fractional_row_deletes_the_row(client):
    client.post("/pantry/clear")

    add_response = client.post("/pantry/add", json={"name": "fractional_broth", "amount": 0.5, "unit": "cup"})
    assert add_response.status_code == 200

    remove_response = client.post("/pantry/remove", json={"name": "fractional_broth", "amount": 120, "unit": "ml"})
    assert remove_response.status_code == 200
    data = _unwrap(remove_response)
    assert data["items"] == []


def test_pantry_rejects_non_positive_fractional_amounts_with_clear_message(client):
    response = client.post("/pantry/add", json={"name": "bad_fraction", "amount": 0})
    assert response.status_code == 400
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "BAD_REQUEST"
    assert body["error"]["message"] == "Amount must be greater than 0"


def test_pantry_rejects_non_numeric_fractional_amounts_with_clear_message(client):
    response = client.post("/pantry/add", json={"name": "bad_fraction", "amount": "half"})
    assert response.status_code == 400
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "BAD_REQUEST"
    assert body["error"]["message"] == "Amount must be a number"


def test_pantry_unit_mismatch_returns_clear_guidance_without_changing_saved_amount(client):
    client.post("/pantry/clear")

    add_response = client.post("/pantry/add", json={"name": "precision_milk", "amount": 2, "unit": "cup"})
    assert add_response.status_code == 200

    mismatch_response = client.post("/pantry/add", json={"name": "precision_milk", "amount": 1, "unit": "g"})
    assert mismatch_response.status_code == 400
    body = mismatch_response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "BAD_REQUEST"
    assert body["error"]["message"] == (
        'Can\'t add precision_milk with "g" because your pantry currently tracks it in "ml". '
        "Use a compatible volume unit (ml, l, tsp, tbsp, cup). If you meant to restart this ingredient "
        "in a different unit, remove the current row first."
    )

    pantry_response = client.get("/pantry")
    pantry_data = _unwrap(pantry_response)
    assert pantry_data["items"] == [
        {
            "ingredient": "precision_milk",
            "quantity": 480.0,
            "unit": "ml",
        }
    ]
