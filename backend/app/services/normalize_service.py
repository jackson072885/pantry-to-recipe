from __future__ import annotations

import re
from typing import Optional

# Staples are ingredients that should not count as "required"
STAPLES = {
    "salt",
    "pepper",
    "black pepper",
    "olive oil",
    "oil",
    "water",
    "butter",
    "sugar",
    "flour",
}


def _clean(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^\w\s]", "", s)
    s = re.sub(r"\s+", " ", s)

    # simple plural trim (deterministic, minimal)
    if len(s) > 3 and s.endswith("s"):
        s = s[:-1]

    return s


def normalize_item(raw: str) -> Optional[str]:
    """
    Lightweight deterministic normalization.
    Keeps matching stable and prevents import errors.
    """
    x = _clean(raw)
    return x if x else None