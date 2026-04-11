import type { PantryItem, RecipeIngredient } from "./mvpApi";

type UnitSpec = {
  canonical: string;
  multiplier: number;
};

const UNIT_MAP: Record<string, UnitSpec> = {
  ea: { canonical: "ea", multiplier: 1 },
  each: { canonical: "ea", multiplier: 1 },
  piece: { canonical: "ea", multiplier: 1 },
  pieces: { canonical: "ea", multiplier: 1 },
  pcs: { canonical: "ea", multiplier: 1 },
  g: { canonical: "g", multiplier: 1 },
  gram: { canonical: "g", multiplier: 1 },
  grams: { canonical: "g", multiplier: 1 },
  kg: { canonical: "g", multiplier: 1000 },
  kilogram: { canonical: "g", multiplier: 1000 },
  kilograms: { canonical: "g", multiplier: 1000 },
  oz: { canonical: "g", multiplier: 28.3495 },
  ounce: { canonical: "g", multiplier: 28.3495 },
  ounces: { canonical: "g", multiplier: 28.3495 },
  lb: { canonical: "g", multiplier: 453.592 },
  pound: { canonical: "g", multiplier: 453.592 },
  pounds: { canonical: "g", multiplier: 453.592 },
  ml: { canonical: "ml", multiplier: 1 },
  milliliter: { canonical: "ml", multiplier: 1 },
  milliliters: { canonical: "ml", multiplier: 1 },
  l: { canonical: "ml", multiplier: 1000 },
  liter: { canonical: "ml", multiplier: 1000 },
  liters: { canonical: "ml", multiplier: 1000 },
  tsp: { canonical: "ml", multiplier: 5 },
  teaspoon: { canonical: "ml", multiplier: 5 },
  teaspoons: { canonical: "ml", multiplier: 5 },
  tbsp: { canonical: "ml", multiplier: 15 },
  tablespoon: { canonical: "ml", multiplier: 15 },
  tablespoons: { canonical: "ml", multiplier: 15 },
  cup: { canonical: "ml", multiplier: 240 },
  cups: { canonical: "ml", multiplier: 240 },
};

function normalizeUnit(raw?: string | null): UnitSpec {
  if (!raw) {
    return UNIT_MAP.ea;
  }

  const value = raw.trim().toLowerCase();
  if (value in UNIT_MAP) {
    return UNIT_MAP[value];
  }

  if (value.endsWith("s") && value.slice(0, -1) in UNIT_MAP) {
    return UNIT_MAP[value.slice(0, -1)];
  }

  throw new Error(`Unsupported unit: ${raw}`);
}

function toCanonical(quantity: number, unit?: string | null): { quantity: number; unit: string } {
  const spec = normalizeUnit(unit);
  return {
    quantity: quantity * spec.multiplier,
    unit: spec.canonical,
  };
}

export function pantryHasEnough(pantryItem: PantryItem | null, ingredient: RecipeIngredient): boolean {
  if (!pantryItem) return false;
  if (pantryItem.quantity_is_known === false) return false;

  const pantryQuantity = typeof pantryItem.quantity === "number" ? pantryItem.quantity : Number(pantryItem.quantity);
  if (!Number.isFinite(pantryQuantity)) return false;

  try {
    const requiredQuantity = ingredient.required_quantity ?? 1;
    const required = toCanonical(requiredQuantity, ingredient.unit);
    const available = toCanonical(pantryQuantity, pantryItem.unit);

    return required.unit === available.unit && available.quantity >= required.quantity;
  } catch {
    return false;
  }
}
