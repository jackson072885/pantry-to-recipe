import { describe, expect, it } from "vitest";

import type { RecipeDetail } from "./mvpApi";
import { getRecipeBrowserIngredientRecoverySuggestions } from "./recipeBrowserRecovery";

function makeRecipe(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: 1,
    name: "Base Recipe",
    short_description: null,
    cuisine: "italian",
    primary_protein: null,
    difficulty: "easy",
    meal_type: "dinner",
    cook_method: "skillet",
    prep_time_minutes: 10,
    cook_time_minutes: 15,
    total_time_minutes: 25,
    oven_temp_f: null,
    air_fryer_temp_f: null,
    servings: 4,
    instructions: "Cook and serve.",
    quality_score: 90,
    quality_bucket: "KEEP_AS_IS",
    review_status: "approved",
    is_weeknight_friendly: true,
    is_beginner_friendly: true,
    equipment: [],
    tips: [],
    substitutions: [],
    warnings: [],
    storage: [],
    tags: ["budget", "one_pan", "weeknight"],
    readiness: null,
    ingredients: [],
    steps: [],
    ...overrides,
  };
}

function makeIngredient(ingredient_id: number, ingredient_name: string) {
  return {
    ingredient_id,
    ingredient_name,
    is_required: true,
    measurement_is_estimated: false,
  };
}

describe("recipeBrowserRecovery", () => {
  it("suggests a broader parent for weak steak results", () => {
    const recipes = [
      makeRecipe({
        id: 1,
        name: "Steak Bowl",
        primary_protein: "steak",
        ingredients: [makeIngredient(1, "steak"), makeIngredient(2, "garlic")],
      }),
      makeRecipe({
        id: 2,
        name: "Ground Beef Soup",
        primary_protein: "beef",
        ingredients: [makeIngredient(3, "ground beef"), makeIngredient(4, "garlic")],
      }),
      makeRecipe({
        id: 3,
        name: "Beef Tacos",
        primary_protein: "beef",
        ingredients: [makeIngredient(5, "beef"), makeIngredient(6, "tortillas")],
      }),
    ];

    expect(
      getRecipeBrowserIngredientRecoverySuggestions(recipes, {
        ingredients: ["steak"],
        protein: [],
        cuisine: [],
        time: [],
        difficulty: [],
        method: [],
        cleanup: [],
        diet: [],
        household: [],
        cost: [],
      }),
    ).toContainEqual(
      expect.objectContaining({
        sourceIngredientId: "steak",
        targetIngredientId: "beef",
        strategy: "broader",
        resultingCount: 3,
      }),
    );
  });

  it("suggests broader recovery for search-only broth leaves", () => {
    const recipes = [
      makeRecipe({
        id: 1,
        name: "Minestrone",
        ingredients: [makeIngredient(1, "vegetable broth"), makeIngredient(2, "beans")],
      }),
      makeRecipe({
        id: 2,
        name: "Chicken Soup",
        ingredients: [makeIngredient(3, "chicken broth"), makeIngredient(4, "chicken")],
      }),
      makeRecipe({
        id: 3,
        name: "Beef Soup",
        ingredients: [makeIngredient(5, "beef broth"), makeIngredient(6, "beef")],
      }),
    ];

    expect(
      getRecipeBrowserIngredientRecoverySuggestions(recipes, {
        ingredients: ["vegetable_broth"],
        protein: [],
        cuisine: [],
        time: [],
        difficulty: [],
        method: [],
        cleanup: [],
        diet: [],
        household: [],
        cost: [],
      }),
    ).toContainEqual(
      expect.objectContaining({
        sourceIngredientId: "vegetable_broth",
        targetIngredientId: "broth",
        strategy: "broader",
        resultingCount: 3,
      }),
    );
  });

  it("keeps narrow combos honest while suggesting a nearby recovery swap", () => {
    const recipes = [
      makeRecipe({
        id: 1,
        name: "Baked Ravioli",
        ingredients: [makeIngredient(1, "ravioli"), makeIngredient(2, "marinara")],
      }),
      makeRecipe({
        id: 2,
        name: "Pesto Pasta",
        ingredients: [makeIngredient(3, "pasta"), makeIngredient(4, "pesto")],
      }),
    ];

    expect(
      getRecipeBrowserIngredientRecoverySuggestions(recipes, {
        ingredients: ["ravioli", "pesto"],
        protein: [],
        cuisine: [],
        time: [],
        difficulty: [],
        method: [],
        cleanup: [],
        diet: [],
        household: [],
        cost: [],
      }),
    ).toContainEqual(
      expect.objectContaining({
        sourceIngredientId: "ravioli",
        targetIngredientId: "pasta",
        strategy: "broader",
        resultingCount: 1,
      }),
    );
  });

  it("recovers sparse chicken-thigh combos with an explicit broader chicken swap", () => {
    const recipes = [
      makeRecipe({
        id: 1,
        name: "Salsa Verde Chicken Bowl",
        primary_protein: "chicken",
        ingredients: [makeIngredient(1, "chicken"), makeIngredient(2, "salsa verde")],
      }),
      makeRecipe({
        id: 2,
        name: "Sticky Soy Chicken Thigh Tray",
        primary_protein: "chicken thighs",
        ingredients: [makeIngredient(3, "chicken thighs"), makeIngredient(4, "soy sauce")],
      }),
    ];

    expect(
      getRecipeBrowserIngredientRecoverySuggestions(recipes, {
        ingredients: ["chicken_thighs", "salsa_verde"],
        protein: [],
        cuisine: [],
        time: [],
        difficulty: [],
        method: [],
        cleanup: [],
        diet: [],
        household: [],
        cost: [],
      }),
    ).toContainEqual(
      expect.objectContaining({
        sourceIngredientId: "chicken_thighs",
        targetIngredientId: "chicken",
        strategy: "broader",
        resultingCount: 1,
      }),
    );
  });

  it("stays quiet when a leaf already has healthy support", () => {
    const recipes = [
      makeRecipe({ id: 1, ingredients: [makeIngredient(1, "white beans")] }),
      makeRecipe({ id: 2, ingredients: [makeIngredient(2, "white beans"), makeIngredient(3, "garlic")] }),
      makeRecipe({ id: 3, ingredients: [makeIngredient(4, "white beans"), makeIngredient(5, "tomato")] }),
    ];

    expect(
      getRecipeBrowserIngredientRecoverySuggestions(recipes, {
        ingredients: ["white_beans"],
        protein: [],
        cuisine: [],
        time: [],
        difficulty: [],
        method: [],
        cleanup: [],
        diet: [],
        household: [],
        cost: [],
      }),
    ).toEqual([]);
  });
});
