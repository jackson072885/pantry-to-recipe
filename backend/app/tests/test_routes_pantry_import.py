from __future__ import annotations


def _unwrap(response):
    body = response.json()
    assert body["success"] is True
    assert body["error"] is None
    return body["data"]


def test_pantry_import_preview_returns_structured_line_results(client):
    client.post("/pantry/clear")

    preview_response = client.post(
        "/pantry/import/preview",
        json={"lines": ["1 lb chicken", "mystery powder", "1 bag rice"]},
    )

    assert preview_response.status_code == 200
    data = _unwrap(preview_response)
    assert data["summary"] == {
        "line_count": 3,
        "accepted_count": 1,
        "review_count": 1,
        "rejected_count": 1,
    }
    assert data["results"][0] == {
        "raw_line": "1 lb chicken",
        "cleaned_line": "1 lb chicken",
        "status": "accepted",
        "parsed_quantity": 1.0,
        "parsed_unit": "lb",
        "parsed_ingredient_text": "chicken",
        "canonical_unit": "g",
        "canonical_ingredient": "chicken",
        "reason_code": "accepted",
        "reason_message": "Line is safe to import",
    }
    assert data["results"][1]["status"] == "review"
    assert data["results"][1]["reason_code"] == "ingredient_not_found"
    assert data["results"][2]["status"] == "rejected"
    assert data["results"][2]["reason_code"] == "line_not_parseable"


def test_pantry_import_commit_only_writes_accepted_lines_after_revalidation(client):
    client.post("/pantry/clear")

    commit_response = client.post(
        "/pantry/import/commit",
        json={"lines": ["1 cup rice", "mystery powder", "1 bag rice", "onion"]},
    )

    assert commit_response.status_code == 200
    data = _unwrap(commit_response)
    assert data["committed_count"] == 2
    assert data["summary"] == {
        "line_count": 4,
        "accepted_count": 2,
        "review_count": 1,
        "rejected_count": 1,
    }
    assert data["items"] == [
        {
            "ingredient": "onion",
            "quantity": 1.0,
            "unit": "ea",
            "use_soon": False,
        },
        {
            "ingredient": "rice",
            "quantity": 240.0,
            "unit": "ml",
            "use_soon": False,
        },
    ]


def test_pantry_import_commit_revalidates_lines_instead_of_trusting_preview_objects(client):
    client.post("/pantry/clear")

    preview_response = client.post("/pantry/import/preview", json={"lines": ["rice"]})
    assert preview_response.status_code == 200

    client.post("/pantry/add", json={"name": "rice", "amount": 1, "unit": "cup"})

    commit_response = client.post("/pantry/import/commit", json={"lines": ["rice"]})
    assert commit_response.status_code == 200
    data = _unwrap(commit_response)

    assert data["committed_count"] == 0
    assert data["results"][0]["status"] == "rejected"
    assert data["results"][0]["reason_code"] == "unit_conflict"
    assert data["items"] == [
        {
            "ingredient": "rice",
            "quantity": 240.0,
            "unit": "ml",
            "use_soon": False,
        }
    ]
