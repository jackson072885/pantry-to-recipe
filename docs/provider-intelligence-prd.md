# Provider Intelligence PRD (Implementation-Aligned)

## Scope
This document reflects the current backend API surface shipped for provider intelligence search/match flows.

Base URL: `http://127.0.0.1:8000`

## New/Relevant Endpoints

### 1) Match v2
- Method/Path: `POST /match/v2`
- Request JSON:
```json
{
  "ingredients": ["chicken", "rice", "salt"]
}
```
- Response 200 JSON shape:
```json
{
  "cookable": [
    {
      "recipe_id": 1,
      "recipe_name": "Chicken Rice Bowl",
      "missing_count": 0,
      "missing_required": [],
      "dinner_score": 0.75
    }
  ],
  "almost": [],
  "not_recommended": [],
  "meta": {
    "pantry_count": 3,
    "normalized_count": 3,
    "recipe_count": 120,
    "version": "v2"
  }
}
```
- Error behavior:
- `400` for input/domain issues (string detail)
- `500` with `{ "detail": "Match v2 failed" }`

### 2) Search tags catalog
- Method/Path: `GET /search/tags`
- Request body: none
- Response 200 JSON shape:
```json
{
  "groups": [
    {
      "name": "Cooking Method",
      "tags": [
        {
          "id": 1,
          "group_name": "Cooking Method",
          "display_name": "Skillet",
          "slug": "skillet",
          "parent_id": null,
          "weight": 0
        }
      ]
    }
  ]
}
```
- Error behavior:
- `500` with `{ "detail": "Tag list failed" }`

### 3) Search filter options
- Method/Path: `GET /search/filters`
- Request body: none
- Response 200 JSON shape:
```json
{
  "cuisine": ["American", "Italian"],
  "meal_type": ["Breakfast", "Dinner"],
  "method": ["Skillet", "Oven"],
  "ingredients": ["beef", "chicken", "vegetarian"],
  "style": ["Comfort Food", "Healthy"]
}
```
- Error behavior:
- `500` with `{ "detail": "Filter list failed" }`

### 4) Search execution (legacy + filter-mode)
- Method/Path: `POST /search`
- Request JSON (new filter-mode):
```json
{
  "filters": {
    "meal_type": ["Dinner"],
    "method": ["Skillet"],
    "ingredients": ["chicken"]
  },
  "mode": {
    "meal_type": "any",
    "method": "any",
    "ingredients": "all"
  },
  "include": {},
  "exclude": {}
}
```
- Response 200 JSON shape:
```json
{
  "cook_now": [
    {
      "recipe_id": 3,
      "recipe_name": "Skillet Chicken",
      "matched_tags": ["dinner", "skillet", "chicken"],
      "missing_count": 0
    }
  ],
  "almost_there": [],
  "not_practical": [],
  "meta": {
    "total": 42
  }
}
```
- Error behavior:
- `500` with `{ "detail": "Search failed" }`

### 5) Density report
- Method/Path: `GET /search/density`
- Request body: none
- Response 200 JSON shape:
```json
{
  "total_recipes": 120,
  "tags": [
    {
      "group": "Cooking Method",
      "tag": "Skillet",
      "slug": "skillet",
      "count": 18
    }
  ],
  "weak_tags": [],
  "balanced_tags": [],
  "overloaded_tags": [],
  "cross_tag_sparsity": [],
  "coverage_percent": 84.62
}
```
- Error behavior:
- `500` with `{ "detail": "Density report failed" }`

## Compatibility Notes
- Existing `POST /match` remains unchanged and is still used by minimal route tests.
- `POST /search` accepts legacy include/exclude slug maps and new `filters` + `mode` payloads.
- For `mode`, unsupported values are treated as `any` in current implementation.
