from __future__ import annotations

import re


_STYLE_KEYWORDS = {
    "skillet": "skillet",
    "bowl": "bowl",
    "wrap": "wrap",
    "sheet pan": "sheet_pan",
    "pasta": "pasta",
    "soup": "soup",
    "stir fry": "stir_fry",
}

_PROTEIN_KEYWORDS = [
    "chicken",
    "beef",
    "pork",
    "fish",
    "shrimp",
    "egg",
    "tofu",
    "beans",
    "lentils",
]

_FLAVOR_KEYWORDS = [
    "spicy",
    "savory",
    "creamy",
    "smoky",
    "garlic",
    "ginger",
    "herby",
    "comfort",
    "fresh",
]

_BANNED_PATTERN = re.compile(r"(?:no|without|avoid)\s+([a-zA-Z ]+)")


def _extract_style(text: str) -> str:
    lowered = text.lower()
    for key, style in _STYLE_KEYWORDS.items():
        if key in lowered:
            return style
    return "skillet"


def _extract_protein(text: str) -> str:
    lowered = text.lower()
    for protein in _PROTEIN_KEYWORDS:
        if protein in lowered:
            return protein
    return "any"


def _extract_flavors(text: str) -> list[str]:
    lowered = text.lower()
    found = [keyword for keyword in _FLAVOR_KEYWORDS if keyword in lowered]
    return sorted(set(found))[:4]


def _extract_banned(text: str) -> list[str]:
    lowered = text.lower()
    banned: list[str] = []
    for match in _BANNED_PATTERN.finditer(lowered):
        item = match.group(1).strip()
        if item:
            banned.append(item)
    return sorted(set(banned))[:3]


def optimize_recipe_prompt(payload) -> dict:
    raw_prompt = payload.raw_prompt.strip()
    style = _extract_style(raw_prompt)
    protein = _extract_protein(raw_prompt)
    flavors = _extract_flavors(raw_prompt)
    banned_items = _extract_banned(raw_prompt)

    pantry_hint = (
        f"prefer pantry ids {sorted(set(payload.pantry_ids))[:25]}"
        if payload.pantry_ids
        else "prefer pantry ingredients when possible"
    )

    optimized_prompt = (
        f"Create a {style} dinner. "
        f"Protein preference: {protein}. "
        f"Time band: {payload.constraints.time_band}. "
        f"Budget band: {payload.constraints.budget_band}. "
        f"Household band: {payload.constraints.household_band}. "
        f"{pantry_hint}. Allow max 2 missing ingredients. "
        f"Flavor notes: {', '.join(flavors) if flavors else 'balanced savory'}."
    )

    confidence = "high" if len(raw_prompt) >= 30 else "med"
    if not flavors and protein == "any":
        confidence = "low"

    return {
        "optimized_prompt": optimized_prompt,
        "extracted_intent": {
            "dish_style": style,
            "protein_pref": protein,
            "flavor_notes": flavors,
            "banned_items": banned_items,
        },
        "confidence": confidence,
    }
