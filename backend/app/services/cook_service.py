"""
Cook engine for Pantry-to-Recipe.

This service will later:
- Evaluate whether a recipe can be cooked
- Verify pantry inventory sufficiency
- Deduct ingredients atomically
- Write audit log entries for every inventory change
- Record cook events

This file contains the core matching business logic.
Deterministic inputs -> deterministic outputs.
"""

from __future__ import annotations

import json
import math
import re
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Set


# Pantry staples are assumed available (not required in pantry input)
STAPLES: Set[str] = {"salt", "pepper", "oil", "water"}

SYNONYMS: Dict[str, str] = {
    "olive oil": "oil",
    "vegetable oil": "oil",
    "canola oil": "oil",
    "black pepper": "pepper",
    "ground pepper": "pepper",
    "sea salt": "salt",
    "kosher salt": "salt",
}

# Canonical mapping: collapse specific variants into a base ingredient
CANONICAL: Dict[str, str] = {
    # cheese variants
    "cheddar": "cheese",
    "cheddar cheese": "cheese",
    "shredded cheddar": "cheese",
    "shredded cheddar cheese": "cheese",
    "mozzarella": "cheese",
    "parmesan": "cheese",
    # chicken variants
    "chicken breast": "chicken",
    "chicken breasts": "chicken",
    "chicken thigh": "chicken",
    "chicken thighs": "chicken",
    "ground chicken": "chicken",
    # onions
    "yellow onion": "onion",
    "white onion": "onion",
    "red onion": "onion",
    "sweet onion": "onion",
    # tomatoes
    "roma tomato": "tomato",
    "cherry tomatoes": "tomato",
    "grape tomatoes": "tomato",
    "diced tomatoes": "tomato",
    "crushed tomatoes": "tomato",
    # common pantry variants
    "brown sugar": "sugar",
    "white sugar": "sugar",
    "granulated sugar": "sugar",
    # butter variants
    "salted butter": "butter",
    "unsalted butter": "butter",
}


def canonicalize_item(s: str) -> str:
    # Exact match first
    if s in CANONICAL:
        return CANONICAL[s]

    # Heuristic: collapse common descriptors like "shredded cheese" -> "cheese"
    parts = s.split()
    if len(parts) >= 2:
        tail = parts[-1]
        if tail in {"cheese", "onion", "tomato", "chicken"}:
            return tail

    return s


def normalize_item(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^\w\s]", "", s)   # remove punctuation
    s = re.sub(r"\s+", " ", s)      # collapse spaces

    if s in SYNONYMS:
        s = SYNONYMS[s]

    # light singularization (safe/simple)
    if len(s) > 3 and s.endswith("s"):
        s = s[:-1]

    s = canonicalize_item(s)
    return s


def safe_ratio(matched: int, required: int) -> float:
    return round(matched / required, 3) if required else 0.0


def confidence_label(missing_count: int, match_ratio: float) -> str:
    if missing_count == 0:
        return "Perfect"
    if match_ratio >= 0.75:
        return "High"
    if match_ratio >= 0.50:
        return "Medium"
    return "Low"


def load_recipes() -> List[Dict[str, Any]]:
    """Loads recipes from backend/app/data/recipes.json."""
    data_path = Path(__file__).parent / "data" / "recipes.json"
    with data_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def build_ingredient_weights(recipes: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    IDF-like weights so rare ingredients count more than common ones.
    weight = log((N + 1) / (df + 1)) + 1
    """
    df = Counter()
    for r in recipes:
        needed = {normalize_item(ing) for ing in r.get("ingredients", [])}
        needed -= STAPLES
        for ing in needed:
            df[ing] += 1

    N = len(recipes)
    weights: Dict[str, float] = {}
    for ing, freq in df.items():
        weights[ing] = math.log((N + 1) / (freq + 1)) + 1.0
    return weights


def score_recipe(pantry: Set[str], needed: Set[str], weights: Dict[str, float]) -> float:
    """Returns 0–100 confidence score based on weighted coverage."""
    if not needed:
        return 100.0

    matched = needed & pantry
    missing = needed - pantry

    denom = sum(weights.get(ing, 1.0) for ing in needed) or 1.0
    matched_w = sum(weights.get(ing, 1.0) for ing in matched)
    missing_w = sum(weights.get(ing, 1.0) for ing in missing)

    weighted_coverage = matched_w / denom
    weighted_missing_penalty = missing_w / denom

    base = 100.0 * (0.75 * weighted_coverage + 0.25 * (1.0 - weighted_missing_penalty))
    return max(0.0, min(100.0, base))


def adjust_for_bucket(score: float, missing_count: int) -> float:
    """
    Boost cookable so it ranks above almost;
    push not-cookable down so it doesn't pollute the top.
    """
    if missing_count == 0:
        return min(100.0, score + 10.0)
    if missing_count <= 2:
        return score
    return max(0.0, score - 25.0)


# -------- Smart explanation helpers (UI-ready) --------

Reason = Dict[str, str]


def _top_by_weight(items: List[str], weights: Dict[str, float], k: int = 2) -> List[str]:
    def w(x: str) -> float:
        return float(weights.get(x, 0.1))
    return sorted(items, key=w, reverse=True)[:k]


def build_reasons(
    *,
    bucket: str,
    matched: List[str],
    missing: List[str],
    missing_count: int,
    confidence_label: str,
    weights: Dict[str, float],
) -> List[Reason]:
    matched_top = _top_by_weight(matched, weights, k=2)
    missing_top = _top_by_weight(missing, weights, k=2)

    reasons: List[Reason] = []

    if missing_count == 0:
        detail = "You have every required ingredient."
        if matched_top:
            if len(matched_top) == 1:
                detail = f"You have every required ingredient — especially {matched_top[0]}."
            else:
                detail = f"You have every required ingredient — especially {matched_top[0]} and {matched_top[1]}."
        reasons.append({"type": "perfect_match", "title": "Ready to cook", "detail": detail, "impact": "positive"})

    elif bucket == "almost":
        if missing_top:
            miss_phrase = missing_top[0] if len(missing_top) == 1 else f"{missing_top[0]} and {missing_top[1]}"
            detail = f"Missing {missing_count} item(s). Biggest gap: {miss_phrase}."
        else:
            detail = f"Missing {missing_count} item(s)."
        reasons.append({"type": "missing_items", "title": "Almost there", "detail": detail, "impact": "negative"})

        if missing_count <= 2 and missing_top:
            reasons.append({"type": "quick_fix", "title": "Quick fix", "detail": f"Add {missing_top[0]} and you’re very close.", "impact": "neutral"})

    else:
        if missing_top:
            miss_phrase = missing_top[0] if len(missing_top) == 1 else f"{missing_top[0]} and {missing_top[1]}"
            detail = f"Missing {missing_count} key item(s), like {miss_phrase}."
        else:
            detail = f"Missing {missing_count} key item(s)."
        reasons.append({"type": "too_many_missing", "title": "Needs more ingredients", "detail": detail, "impact": "negative"})

    if confidence_label:
        label = confidence_label.lower()
        impact = "positive" if label in {"high", "perfect"} else ("neutral" if label == "medium" else "negative")
        reasons.append({"type": "confidence", "title": f"Confidence: {confidence_label}", "detail": "Based on the importance of ingredients you have vs. what’s missing.", "impact": impact})

    return reasons


def compose_explanation(bucket: str, reasons: List[Reason]) -> str:
    primary = reasons[0]["detail"] if reasons else ""
    if bucket == "cookable":
        return "You have everything needed."
    if bucket == "almost":
        return ("You’re close — " + primary.lower().rstrip(".") + ".") if primary else "You’re close, but you’re missing a couple items."
    return ("Not cookable yet — " + primary.lower().rstrip(".") + ".") if primary else "Not cookable yet — missing key ingredients."


# -------- Main match function --------

def match_recipes(pantry_items: List[str]) -> Dict[str, Any]:
    pantry: Set[str] = {normalize_item(x) for x in pantry_items if str(x).strip()}
    recipes = load_recipes()
    weights = build_ingredient_weights(recipes)

    cookable: List[Dict[str, Any]] = []
    almost: List[Dict[str, Any]] = []
    not_cookable: List[Dict[str, Any]] = []

    for r in recipes:
        needed: Set[str] = {normalize_item(ing) for ing in r.get("ingredients", [])}
        needed -= STAPLES

        matched = sorted(list(needed & pantry))
        missing = sorted(list(needed - pantry))
        missing_count = len(missing)

        if missing_count == 0:
            bucket = "cookable"
        elif missing_count <= 2:
            bucket = "almost"
        else:
            bucket = "not_cookable"

        matched_count = len(matched)
        required_count = len(needed)
        match_ratio = safe_ratio(matched_count, required_count)

        confidence = confidence_label(missing_count, match_ratio)
        base_score = score_recipe(pantry, needed, weights)
        confidence_score = adjust_for_bucket(base_score, missing_count)

        reasons = build_reasons(
            bucket=bucket,
            matched=matched,
            missing=missing,
            missing_count=missing_count,
            confidence_label=confidence,
            weights=weights,
        )
        explanation = compose_explanation(bucket, reasons)

        result = {
            "id": r.get("id"),
            "name": r.get("name"),
            "matched": matched,
            "missing": missing,
            "missing_count": missing_count,
            "matched_count": matched_count,
            "required_count": required_count,
            "match_ratio": match_ratio,
            "confidence": confidence,
            "confidence_score": round(confidence_score, 1),
            "reasons": reasons,
            "explanation": explanation,
        }

        if bucket == "cookable":
            cookable.append(result)
        elif bucket == "almost":
            almost.append(result)
        else:
            not_cookable.append(result)

    cookable.sort(key=lambda x: (-x["confidence_score"], -x["match_ratio"], x["name"] or ""))
    almost.sort(key=lambda x: (-x["confidence_score"], x["missing_count"], -x["match_ratio"], x["name"] or ""))
    not_cookable.sort(key=lambda x: (-x["confidence_score"], -x["match_ratio"], x["missing_count"], x["name"] or ""))

    return {"cookable": cookable, "almost": almost, "not_cookable": not_cookable}
