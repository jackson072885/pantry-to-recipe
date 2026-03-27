from __future__ import annotations

import re

from app.services.normalize_service import normalize_item

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
    "bass",
    "fish",
    "salmon",
    "tilapia",
    "cod",
    "catfish",
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


_ARCHETYPE_KEYWORDS = [
    ("pasta", "pasta_base"),
    ("skillet", "skillet"),
    ("bowl", "bowl"),
    ("wrap", "wrap"),
]

_PANTRY_PROTEINS = [
    "chicken",
    "beef",
    "pork",
    "bass",
    "fish",
    "salmon",
    "tilapia",
    "cod",
    "catfish",
    "egg",
    "beans",
    "tofu",
]

_ARCHETYPE_ESSENTIALS = {
    "pasta_base": ["pasta", "oil", "salt"],
    "skillet": ["onion", "oil", "salt"],
    "bowl": ["rice", "onion", "salt"],
    "wrap": ["tortilla", "onion", "salt"],
}

_ARCHETYPE_OPTIONALS = {
    "pasta_base": ["garlic", "pepper", "tomato sauce"],
    "skillet": ["garlic", "pepper", "tomato"],
    "bowl": ["beans", "pepper", "tomato"],
    "wrap": ["lettuce", "tomato", "cheddar"],
}

_TIME_MINUTES = {
    "quick": 20,
    "standard": 30,
    "i_got_time": 45,
}

_SERVINGS_BAND = {
    "1_2": "1-2 servings",
    "3_4": "3-4 servings",
    "5_plus": "5+ servings",
}


def _infer_archetype(raw_prompt: str) -> str:
    lowered = raw_prompt.lower()
    for keyword, archetype in _ARCHETYPE_KEYWORDS:
        if keyword in lowered:
            return archetype
    return "skillet"


def _pick_protein(raw_prompt: str, pantry_set: set[str], allow_missing: int) -> tuple[str | None, bool]:
    lowered = raw_prompt.lower()
    for protein in _PANTRY_PROTEINS:
        if protein in pantry_set and protein in lowered:
            return protein, True

    for protein in _PANTRY_PROTEINS:
        if protein in pantry_set:
            return protein, True

    prompt_protein = next((protein for protein in _PANTRY_PROTEINS if protein in lowered), "chicken")
    if allow_missing >= 1:
        return prompt_protein, False
    return None, False


def _build_ingredient_rows(archetype: str, protein: str | None, pantry_set: set[str], allow_missing: int) -> tuple[list[dict], list[str], list[str]]:
    required = list(_ARCHETYPE_ESSENTIALS[archetype])
    optionals = list(_ARCHETYPE_OPTIONALS[archetype])
    if protein:
        required.insert(0, protein)

    ingredients: list[dict] = []
    used_from_pantry: list[str] = []
    missing: list[str] = []

    for name in required:
        from_pantry = name in pantry_set
        if not from_pantry:
            if len(missing) >= allow_missing:
                continue
            missing.append(name)
        else:
            used_from_pantry.append(name)
        ingredients.append(
            {
                "name": name,
                "qty": "1 portion" if name in _PANTRY_PROTEINS else "1 unit",
                "optional": False,
                "from_pantry": from_pantry,
            }
        )

    for name in optionals:
        from_pantry = name in pantry_set
        if from_pantry:
            used_from_pantry.append(name)
            ingredients.append(
                {
                    "name": name,
                    "qty": "to taste",
                    "optional": True,
                    "from_pantry": True,
                }
            )

    return ingredients, sorted(set(used_from_pantry)), sorted(set(missing))


def _ingredient_names(ingredients: list[dict]) -> list[str]:
    return [str(item["name"]) for item in ingredients]


def _build_steps(archetype: str, ingredients: list[dict], time_minutes: int) -> list[str]:
    names = _ingredient_names(ingredients)
    protein = next((name for name in names if name in _PANTRY_PROTEINS), names[0] if names else "ingredient")
    base = next((name for name in names if name not in _PANTRY_PROTEINS), names[-1] if names else "base")
    seasoning = "salt"
    if "pepper" in names:
        seasoning = "salt and pepper"

    if archetype == "pasta_base":
        steps = [
            f"Boil pasta in salted water for 8-10 minutes while prepping {protein}.",
            f"Heat oil in a pan and cook {protein} until fully done.",
            f"Add {base} and stir for 2-3 minutes with {seasoning}.",
            "Drain pasta and combine with the skillet mixture.",
            f"Adjust seasoning with {seasoning} and serve warm in about {time_minutes} minutes total.",
        ]
    elif archetype == "bowl":
        steps = [
            f"Cook {base} first so the bowl base is ready.",
            f"Cook {protein} in a pan with oil until done.",
            f"Season {protein} with {seasoning} while warm.",
            f"Assemble bowls with {base} and top with {protein}.",
            "Finish with any pantry optional items and serve.",
        ]
    elif archetype == "wrap":
        wrap_item = "tortilla" if "tortilla" in names else base
        steps = [
            f"Warm {wrap_item} in a dry pan for 30 seconds each side.",
            f"Cook {protein} with oil until done and season with {seasoning}.",
            f"Layer {protein} and {base} onto each {wrap_item}.",
            f"Fold each {wrap_item} tightly and heat seam-side down briefly.",
            "Slice and serve immediately.",
        ]
    else:
        steps = [
            f"Heat oil in a skillet and cook {protein} until mostly done.",
            f"Add {base} and cook together for 3-4 minutes.",
            f"Season with {seasoning} and stir until everything is hot.",
            f"Reduce heat and let {protein} finish cooking through.",
            f"Serve directly from the skillet in about {time_minutes} minutes.",
        ]

    return steps[:8]


def _validate_recipe(payload, ingredients: list[dict], steps: list[str], used_from_pantry: list[str], missing: list[str]) -> dict:
    issues: list[str] = []
    pantry_set = {
        normalized for normalized in (normalize_item(item) for item in payload.pantry_items) if normalized
    }

    if len(missing) > payload.allow_missing:
        issues.append("Missing ingredient count exceeded allow_missing.")

    for item in used_from_pantry:
        if normalize_item(item) not in pantry_set:
            issues.append(f"Used pantry ingredient not in pantry_items: {item}")

    ingredient_names = [str(item["name"]).lower() for item in ingredients]
    for step in steps:
        lowered = step.lower()
        if not any(name in lowered for name in ingredient_names):
            issues.append("Step does not reference any listed ingredient.")
            break

    return {
        "passed": len(issues) == 0,
        "issues": issues,
    }


def generate_recipe(payload) -> dict:
    raw_prompt = payload.raw_prompt.strip()
    archetype = _infer_archetype(raw_prompt)
    pantry_set = {
        normalized for normalized in (normalize_item(item) for item in payload.pantry_items) if normalized
    }
    protein, _ = _pick_protein(raw_prompt, pantry_set, payload.allow_missing)
    ingredients, used_from_pantry, missing = _build_ingredient_rows(
        archetype=archetype,
        protein=protein,
        pantry_set=pantry_set,
        allow_missing=payload.allow_missing,
    )

    time_minutes = _TIME_MINUTES[payload.time_band]
    steps = _build_steps(archetype, ingredients, time_minutes)
    if len(steps) < 4:
        steps.append(f"Serve with any remaining {ingredients[0]['name'] if ingredients else 'ingredients'}.")

    validation = _validate_recipe(payload, ingredients, steps, used_from_pantry, missing)
    title_prefix = {
        "pasta_base": "Pantry Pasta",
        "skillet": "Pantry Skillet",
        "bowl": "Pantry Bowl",
        "wrap": "Pantry Wrap",
    }[archetype]
    title = f"{title_prefix} with {protein or 'house staples'}"

    why_this_works = [
        f"Built for the {payload.time_band} time band with a {time_minutes}-minute target.",
        f"Uses {len(used_from_pantry)} pantry item(s) before adding new purchases.",
        f"Aligned to {payload.budget_band} budget band by limiting missing items to {len(missing)}.",
    ]

    safety_notes = [
        "Cook proteins to a safe internal temperature before serving.",
        "Refrigerate leftovers within 2 hours.",
    ]
    if payload.household_band == "5_plus":
        safety_notes.append("Batch-cook in two pans if needed to avoid overcrowding.")

    return {
        "title": title,
        "archetype": archetype,
        "time_minutes": time_minutes,
        "servings_band": _SERVINGS_BAND[payload.household_band],
        "ingredients": ingredients,
        "steps": steps,
        "pantry_alignment": {
            "used_from_pantry": used_from_pantry,
            "missing": missing,
        },
        "why_this_works": why_this_works,
        "safety_notes": safety_notes,
        "validation": validation,
    }
