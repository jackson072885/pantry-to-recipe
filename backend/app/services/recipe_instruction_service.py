from __future__ import annotations

import re
from dataclasses import dataclass

SUPPORTED_METHOD_PATTERNS = (
    "pan_fried_fish",
    "skillet_protein",
    "pasta",
    "omelet_frittata",
    "roasted_vegetables",
    "sandwich_grilled_cheese",
    "wraps",
    "fried_rice_skillet_mix",
)

GENERIC_PLACEHOLDER_PHRASES = {
    "ingredients",
    "cooked through and ready to serve",
    "until done",
    "as needed",
}

WEAK_SOURCE_PHRASES = {
    "cook until done",
    "cook until cooked through",
    "until cooked through",
    "until done",
    "mix together",
    "combine ingredients",
    "put everything together",
}

FISH_NAMES = {"fish", "salmon", "tilapia", "cod", "catfish", "bass", "trout", "snapper", "halibut"}
PROTEIN_NAMES = {
    "chicken",
    "ground beef",
    "ground turkey",
    "beef",
    "pork",
    "sausage",
    "tofu",
    "shrimp",
    *FISH_NAMES,
}
VEGETABLE_NAMES = {
    "broccoli",
    "carrot",
    "cauliflower",
    "green beans",
    "potato",
    "sweet potato",
    "onion",
    "bell pepper",
    "zucchini",
    "cabbage",
    "corn",
    "mushroom",
}
AROMATICS = {"garlic", "ginger", "onion", "green onion"}
SAUCE_OR_FINISH = {
    "soy sauce",
    "tomato sauce",
    "pesto",
    "cream",
    "milk",
    "butter",
    "lemon",
    "lime",
    "parsley",
    "basil",
    "parmesan",
    "cheddar",
    "mozzarella",
    "caesar dressing",
    "mayo",
    "salsa",
}


@dataclass(frozen=True)
class InstructionPlan:
    method_pattern: str | None
    confidence: str
    steps: list[str]
    used_builder: bool


def build_instruction_plan(
    *,
    recipe_name: str,
    cook_method: str | None,
    required: list[str],
    optional: list[str],
    instructions: str | None,
    prep_time_minutes: int | None,
    cook_time_minutes: int | None,
    oven_temp_f: int | None = None,
    air_fryer_temp_f: int | None = None,
) -> InstructionPlan:
    normalized_method = (cook_method or "").strip().lower()
    source_lines = split_instruction_lines(instructions or "")
    source_strength = assess_source_strength(source_lines)
    method_pattern = detect_method_pattern(recipe_name, normalized_method, required, optional, source_lines)

    if method_pattern:
        steps = build_method_steps(
            method_pattern=method_pattern,
            recipe_name=recipe_name,
            cook_method=normalized_method,
            required=required,
            optional=optional,
            prep_time_minutes=prep_time_minutes,
            cook_time_minutes=cook_time_minutes,
            oven_temp_f=oven_temp_f,
            air_fryer_temp_f=air_fryer_temp_f,
        )
        confidence = "high" if source_strength != "weak" else "medium"
        return InstructionPlan(method_pattern=method_pattern, confidence=confidence, steps=dedupe_lines(steps), used_builder=True)

    cleaned_source = clean_source_steps(source_lines)
    if cleaned_source:
        confidence = "medium" if source_strength == "strong" else "low"
        return InstructionPlan(method_pattern=None, confidence=confidence, steps=dedupe_lines(cleaned_source), used_builder=False)

    return InstructionPlan(
        method_pattern=None,
        confidence="low",
        steps=["Review the source recipe before cooking; the available instruction data is too thin to rewrite safely."],
        used_builder=False,
    )


def split_instruction_lines(instructions: str) -> list[str]:
    normalized = instructions.replace("\r", "\n")
    raw_lines = [line.strip().rstrip(".") for line in normalized.split("\n") if line.strip()]
    if len(raw_lines) >= 2:
        return raw_lines
    if not raw_lines:
        return []
    parts = re.split(r"\.\s+|,\s+then\s+|,\s+and\s+|;\s+|\s+then\s+", raw_lines[0])
    return [part.strip().rstrip(".") for part in parts if part.strip()]


def assess_source_strength(lines: list[str]) -> str:
    if len(lines) >= 3 and sum(1 for line in lines if not is_weak_source_line(line)) >= 2:
        return "strong"
    if not lines:
        return "weak"
    return "weak" if all(is_weak_source_line(line) for line in lines) else "medium"


def detect_method_pattern(
    recipe_name: str,
    cook_method: str,
    required: list[str],
    optional: list[str],
    source_lines: list[str],
) -> str | None:
    title = normalize_text(recipe_name)
    required_set = set(required)
    optional_set = set(optional)
    combined = " ".join([title, *[normalize_text(line) for line in source_lines]])

    has_fish = bool(required_set & FISH_NAMES) or any(name in title for name in FISH_NAMES)
    if cook_method == "skillet" and has_fish and ("pan fried" in title or "pan fry" in combined or "sear" in combined or "skillet" in title):
        return "pan_fried_fish"

    if "omelet" in title or "frittata" in title or ("egg" in required_set and cook_method in {"skillet", "oven"} and required_set & {"cheddar", "ham", "spinach", "bell pepper", "onion"}):
        return "omelet_frittata"

    if "grilled cheese" in title or "sandwich" in title or "blt" in title or ("bread" in required_set and required_set & {"cheddar", "mozzarella", "bacon"}):
        return "sandwich_grilled_cheese"

    if "wrap" in title or ("tortilla" in required_set and ("wrap" in combined or cook_method == "no_cook")):
        return "wraps"

    if "fried rice" in title or ("rice" in required_set and cook_method == "skillet" and (required_set & {"egg", "soy sauce"} or optional_set & {"egg", "soy sauce"})):
        return "fried_rice_skillet_mix"

    if "pasta" in title or "noodle" in title or "ramen" in title or ("pasta" in required_set and cook_method in {"stovetop", "skillet", ""}):
        return "pasta"

    vegetable_count = len(required_set & VEGETABLE_NAMES)
    if cook_method in {"oven", "air_fryer"} and (vegetable_count >= 2 or ("roast" in title and vegetable_count >= 1)):
        return "roasted_vegetables"

    if cook_method == "skillet" and required_set & (PROTEIN_NAMES - FISH_NAMES):
        return "skillet_protein"

    return None


def build_method_steps(
    *,
    method_pattern: str,
    recipe_name: str,
    cook_method: str,
    required: list[str],
    optional: list[str],
    prep_time_minutes: int | None,
    cook_time_minutes: int | None,
    oven_temp_f: int | None,
    air_fryer_temp_f: int | None,
) -> list[str]:
    if method_pattern == "pan_fried_fish":
        return _build_pan_fried_fish_steps(required, optional, cook_time_minutes)
    if method_pattern == "skillet_protein":
        return _build_skillet_protein_steps(required, optional, cook_time_minutes)
    if method_pattern == "pasta":
        return _build_pasta_steps(required, optional, cook_time_minutes)
    if method_pattern == "omelet_frittata":
        return _build_omelet_frittata_steps(recipe_name, cook_method, required, optional, oven_temp_f)
    if method_pattern == "roasted_vegetables":
        return _build_roasted_vegetable_steps(required, optional, oven_temp_f or air_fryer_temp_f, cook_method)
    if method_pattern == "sandwich_grilled_cheese":
        return _build_sandwich_steps(recipe_name, required, optional)
    if method_pattern == "wraps":
        return _build_wrap_steps(required, optional)
    if method_pattern == "fried_rice_skillet_mix":
        return _build_fried_rice_steps(required, optional)
    return clean_source_steps(split_instruction_lines(""))


def clean_source_steps(lines: list[str]) -> list[str]:
    cleaned: list[str] = []
    for line in lines:
        text = sanitize_line(line)
        if not text:
            continue
        if contains_generic_placeholder(text):
            continue
        cleaned.append(text)
    return cleaned[:5]


def sanitize_line(line: str) -> str:
    text = line.strip().rstrip(".")
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text).strip(" ,;")
    text = re.sub(r"\b(as needed|until done)\b", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text).strip(" ,;")
    return text[:1].upper() + text[1:] if text else ""


def dedupe_lines(lines: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for line in lines:
        key = normalize_text(line)
        key = re.sub(r"\b(first|next|finally|then)\b", " ", key)
        key = re.sub(r"\b(minutes?|min|side|sides)\b", " ", key)
        key = re.sub(r"\s+", " ", key).strip()
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(line)
    return deduped[:5]


def contains_generic_placeholder(text: str) -> bool:
    lowered = text.lower()
    return any(phrase in lowered for phrase in GENERIC_PLACEHOLDER_PHRASES)


def is_weak_source_line(line: str) -> bool:
    lowered = line.lower()
    words = re.findall(r"[a-zA-Z]+", lowered)
    if len(words) <= 4:
        return True
    if any(phrase in lowered for phrase in WEAK_SOURCE_PHRASES):
        return True
    if contains_generic_placeholder(lowered):
        return True
    has_signal = any(
        token in lowered
        for token in ("minute", "medium", "high heat", "golden", "brown", "opaque", "flakes", "set", "melt", "boil", "toss", "fold", "flip", "roast")
    )
    return not has_signal


def normalize_text(value: str) -> str:
    lowered = value.strip().lower().replace("&", "and")
    lowered = re.sub(r"[^a-z0-9\s]", " ", lowered)
    return re.sub(r"\s+", " ", lowered).strip()


def _focus_name(names: list[str], candidates: set[str]) -> str | None:
    return next((name for name in names if name in candidates), None)


def _display_name(name: str | None) -> str:
    if not name:
        return "item"
    special = {"blt": "BLT", "bbq": "BBQ"}
    return " ".join(special.get(part.lower(), part.capitalize()) for part in name.split())


def _join_items(items: list[str]) -> str:
    display = [_display_name(item).lower() for item in items if item]
    if not display:
        return ""
    if len(display) == 1:
        return display[0]
    if len(display) == 2:
        return f"{display[0]} and {display[1]}"
    return f"{', '.join(display[:-1])}, and {display[-1]}"


def _build_pan_fried_fish_steps(required: list[str], optional: list[str], cook_time_minutes: int | None) -> list[str]:
    fish = _focus_name(required, FISH_NAMES) or "fish fillets"
    seasonings = [item for item in [("garlic" if "garlic" in optional or "garlic" in required else None), ("lemon" if "lemon" in optional or "lemon" in required else None), ("pepper" if "pepper" in optional or "pepper" in required else None)] if item]
    first_side = "3 to 4 minutes" if not cook_time_minutes or cook_time_minutes >= 7 else "2 to 3 minutes"
    second_side = "2 to 4 minutes" if not cook_time_minutes or cook_time_minutes >= 7 else "1 to 2 minutes"

    steps = [
        f"Pat the {_display_name(fish).lower()} dry and season it with salt{' and ' + _join_items(seasonings[:1]) if seasonings[:1] else ''}.",
        f"Heat a lightly oiled skillet over medium-high heat until the oil shimmers.",
        f"Lay in the {_display_name(fish).lower()} and cook the first side for {first_side}, until browned and crisp at the edges.",
        f"Flip and cook the second side for {second_side}, until the fish is opaque and flakes easily with a fork.",
    ]
    if "lemon" in optional or "lemon" in required or "garlic" in optional or "garlic" in required:
        finish_bits = [item for item in ("garlic", "lemon", "parsley") if item in required or item in optional]
        steps.append(f"Finish the pan with {_join_items(finish_bits)} and spoon it over the fish before serving.")
    return steps


def _build_skillet_protein_steps(required: list[str], optional: list[str], cook_time_minutes: int | None) -> list[str]:
    protein = _focus_name(required, PROTEIN_NAMES - FISH_NAMES) or "protein"
    aromatics = [name for name in required if name in AROMATICS and name != protein]
    vegetables = [name for name in required if name in VEGETABLE_NAMES and name not in aromatics and name != protein]
    finishers = [name for name in [*aromatics[:1], *vegetables[:2], *[name for name in optional if name in SAUCE_OR_FINISH][:1]] if name]

    steps = []
    if aromatics:
        steps.append(f"Prep the {_display_name(protein).lower()} and get the {_join_items(aromatics[:2])} ready before heating the pan.")
    else:
        steps.append(f"Season the {_display_name(protein).lower()} and have the remaining add-ins ready.")
    steps.append("Heat a lightly oiled skillet over medium-high heat.")
    steps.append(f"Add the {_display_name(protein).lower()} and cook until browned and nearly cooked through, stirring or turning for even color.")
    if finishers:
        steps.append(f"Add the {_join_items(finishers)} and cook until the vegetables soften and the protein is fully cooked.")
    else:
        steps.append(f"Lower the heat slightly and cook until the {_display_name(protein).lower()} is fully cooked and nicely browned.")
    steps.append("Taste, adjust seasoning, and serve while hot.")
    return steps


def _build_pasta_steps(required: list[str], optional: list[str], cook_time_minutes: int | None) -> list[str]:
    protein = _focus_name(required, PROTEIN_NAMES - FISH_NAMES)
    aromatics = [name for name in required if name in AROMATICS]
    sauce = _focus_name(required + optional, {"tomato sauce", "pesto", "cream", "milk", "butter"})
    finishers = [name for name in [*aromatics[:1], *[name for name in optional if name in {"parmesan", "basil", "lemon", "parsley"}][:2]] if name]

    steps = [
        "Bring a pot of well-salted water to a boil and cook the pasta until just tender; reserve a splash of pasta water before draining.",
    ]
    if protein:
        steps.append(f"While the pasta cooks, heat a skillet and cook the {_display_name(protein).lower()} until browned and cooked through.")
    elif aromatics:
        steps.append(f"While the pasta cooks, warm a little oil or butter and saute the {_join_items(aromatics[:2])} until fragrant.")
    else:
        steps.append("While the pasta cooks, warm the sauce base in a skillet or saucepan.")
    if sauce:
        steps.append(f"Add the {_display_name(sauce).lower()} and simmer briefly so the sauce is hot and cohesive.")
    steps.append(f"Toss the drained pasta with the sauce{' and ' + _join_items(finishers) if finishers else ''}, adding a splash of pasta water if it needs loosening.")
    steps.append("Serve once the pasta is evenly coated and glossy.")
    return steps


def _build_omelet_frittata_steps(recipe_name: str, cook_method: str, required: list[str], optional: list[str], oven_temp_f: int | None) -> list[str]:
    title = normalize_text(recipe_name)
    fillings = [name for name in required if name != "egg" and name in VEGETABLE_NAMES | {"ham", "cheddar", "mozzarella", "spinach"}]
    if "frittata" in title or cook_method == "oven":
        temp = oven_temp_f or 375
        return [
            f"Heat the oven to {temp}F and beat the eggs with salt and pepper.",
            f"Cook the {_join_items(fillings[:3])} in an oven-safe skillet until softened.",
            "Pour in the eggs and cook just until the edges begin to set.",
            "Transfer the skillet to the oven and bake until the center is set and the top is lightly golden.",
        ]
    return [
        f"Beat the eggs and get the {_join_items(fillings[:3]) if fillings else 'fillings'} ready.",
        f"Cook the {_join_items(fillings[:3]) if fillings else 'fillings'} in a lightly oiled skillet over medium heat until just tender.",
        "Pour in the eggs and gently lift the edges as they set so the uncooked egg can flow underneath.",
        "When the omelet is mostly set, add any cheese, fold it over, and cook until the center is softly set and the cheese melts.",
    ]


def _build_roasted_vegetable_steps(required: list[str], optional: list[str], temp_f: int | None, cook_method: str) -> list[str]:
    vegetables = [name for name in required if name in VEGETABLE_NAMES]
    temp = temp_f or (425 if cook_method == "oven" else 400)
    equipment = "sheet pan" if cook_method == "oven" else "air fryer basket"
    return [
        f"Heat the {cook_method.replace('_', ' ')} to {temp}F.",
        f"Cut the {_join_items(vegetables[:3])} into similar-size pieces and toss with oil, salt, and pepper.",
        f"Spread the vegetables in a single layer on the {equipment}.",
        "Roast until browned at the edges and tender all the way through, turning once halfway through cooking.",
    ]


def _build_sandwich_steps(recipe_name: str, required: list[str], optional: list[str]) -> list[str]:
    title = normalize_text(recipe_name)
    if "blt" in title or "bacon" in required:
        return [
            "Cook the bacon in a skillet until crisp, then transfer it to a paper towel-lined plate.",
            "Toast the bread in the bacon fat or butter until lightly golden.",
            "Layer the bread with bacon, lettuce, tomato, and any spread you are using.",
            "Press the sandwich together, slice, and serve right away.",
        ]
    cheese = _focus_name(required + optional, {"cheddar", "mozzarella", "parmesan"}) or "cheese"
    return [
        f"Butter the outside of the bread and place the {_display_name(cheese).lower()} between the slices.",
        "Heat a skillet over medium heat.",
        "Cook the sandwich on the first side until golden brown and crisp.",
        "Flip and cook the second side until golden brown and the cheese is fully melted.",
    ]


def _build_wrap_steps(required: list[str], optional: list[str]) -> list[str]:
    fillings = [name for name in [*required, *optional] if name not in {"tortilla"}][:3]
    return [
        "Warm the tortillas briefly so they roll without tearing.",
        f"Arrange the {_join_items(fillings) if fillings else 'filling'} across the center of each tortilla.",
        "Fold in the sides and roll tightly from the bottom up.",
        "Slice in half and serve right away, or toast the seam side down in a dry skillet for extra structure.",
    ]


def _build_fried_rice_steps(required: list[str], optional: list[str]) -> list[str]:
    protein = _focus_name(required, PROTEIN_NAMES - FISH_NAMES)
    vegetables = [name for name in [*required, *optional] if name in VEGETABLE_NAMES and name != "rice"]
    has_egg = "egg" in required or "egg" in optional
    return [
        "Break up the rice so it is loose before it goes into the pan.",
        "Heat a lightly oiled skillet or wok over high heat.",
        f"Cook the {_display_name(protein).lower()} first until browned, then add the {_join_items(vegetables[:2]) if vegetables else 'vegetables'} and stir-fry until crisp-tender." if protein else f"Stir-fry the {_join_items(vegetables[:2]) if vegetables else 'vegetables'} until crisp-tender.",
        "Add the rice and soy sauce, then stir-fry until the grains are hot and lightly toasted.",
        "Push the rice to one side, scramble the egg in the open space, and fold everything together before serving." if has_egg else "Finish with green onion or another quick garnish and serve right away.",
    ]
