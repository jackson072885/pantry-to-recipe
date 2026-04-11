import { describe, expect, it } from "vitest";

import { pantryHasEnough } from "./quantityMatch";
import type { PantryItem, RecipeIngredient } from "./mvpApi";

function buildPantryItem(overrides: Partial<PantryItem> = {}): PantryItem {
  return {
    ingredient: "milk",
    quantity: 1,
    unit: "cup",
    ...overrides,
  };
}

function buildIngredient(overrides: Partial<RecipeIngredient> = {}): RecipeIngredient {
  return {
    ingredient_id: 1,
    ingredient_name: "milk",
    is_required: true,
    required_quantity: 8,
    unit: "tbsp",
    measurement_is_estimated: false,
    ...overrides,
  };
}

describe("pantryHasEnough", () => {
  it("treats convertible units as equivalent", () => {
    expect(
      pantryHasEnough(
        buildPantryItem({ quantity: 1, unit: "cup" }),
        buildIngredient({ required_quantity: 8, unit: "tbsp" }),
      ),
    ).toBe(true);
  });

  it("blocks when the converted pantry quantity is still too low", () => {
    expect(
      pantryHasEnough(
        buildPantryItem({ quantity: 0.5, unit: "cup" }),
        buildIngredient({ required_quantity: 9, unit: "tbsp" }),
      ),
    ).toBe(false);
  });

  it("keeps incompatible unit families blocked", () => {
    expect(
      pantryHasEnough(
        buildPantryItem({ quantity: 1, unit: "ea" }),
        buildIngredient({ required_quantity: 1, unit: "cup" }),
      ),
    ).toBe(false);
  });

  it("fails closed for unsupported units", () => {
    expect(
      pantryHasEnough(
        buildPantryItem({ quantity: 1, unit: "pinch" }),
        buildIngredient({ required_quantity: 1, unit: "pinch" }),
      ),
    ).toBe(false);
  });
});
