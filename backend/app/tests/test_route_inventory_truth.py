from __future__ import annotations


LIVE_PATHS = {
    "/",
    "/health",
    "/pantry",
    "/pantry/add",
    "/pantry/add-presence",
    "/pantry/remove",
    "/pantry/clear",
    "/recommendations",
    "/recipes",
    "/recipes/{recipe_id}",
    "/cook/{recipe_id}",
    "/events",
    "/api/health",
    "/api/pantry",
    "/api/pantry/add",
    "/api/pantry/add-presence",
    "/api/pantry/remove",
    "/api/pantry/clear",
    "/api/recommendations",
    "/api/recipes",
    "/api/recipes/{recipe_id}",
    "/api/cook/{recipe_id}",
    "/api/events",
}

PARKED_PREFIXES = (
    "/match",
    "/search/density",
    "/insights",
    "/plan",
    "/unlock",
    "/onboarding",
    "/ai/recipe",
    "/supply",
)


def test_openapi_exposes_live_routes_and_hides_parked_routes(client) -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200

    paths = set(response.json()["paths"].keys())

    assert LIVE_PATHS.issubset(paths)
    assert all(not any(path == prefix or path.startswith(f"{prefix}/") for prefix in PARKED_PREFIXES) for path in paths)
