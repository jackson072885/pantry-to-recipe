import { describe, expect, it } from "vitest";

import {
  deriveRecipeBrowserEligibleMetadata,
  filterRecipeBrowserRecipes,
  isRecipeBrowserRecipeEligible,
  type RecipeBrowserSelectedFilters,
} from "./recipeBrowserEligibility";

const EMPTY_SELECTED_FILTERS: RecipeBrowserSelectedFilters = {
  protein: [],
  cuisine: [],
  time: [],
  difficulty: [],
  method: [],
};

function makeRecipe(
  overrides: Partial<{
    id: number;
    name: string;
    primary_protein: string | null;
    cuisine: string | null;
    total_time_minutes: number | null;
    difficulty: string | null;
    cook_method: string | null;
  }> = {},
) {
  return {
    id: 1,
    name: "Test Recipe",
    primary_protein: "chicken",
    cuisine: "italian",
    total_time_minutes: 25,
    difficulty: "easy",
    cook_method: "skillet",
    ...overrides,
  };
}

describe("recipeBrowserEligibility", () => {
  it("keeps the unfiltered result set when no filters are selected", () => {
    const recipes = [
      makeRecipe({ id: 1, name: "Chicken Pasta" }),
      makeRecipe({ id: 2, name: "Beef Soup", primary_protein: "beef", cuisine: "american", cook_method: "stovetop" }),
    ];

    expect(filterRecipeBrowserRecipes(recipes, EMPTY_SELECTED_FILTERS)).toEqual(recipes);
  });

  it("uses OR logic within a single family", () => {
    const recipes = [
      makeRecipe({ id: 1, name: "Italian Chicken", cuisine: "italian" }),
      makeRecipe({ id: 2, name: "American Beef", cuisine: "american", primary_protein: "beef" }),
      makeRecipe({ id: 3, name: "Indian Tofu", cuisine: "indian", primary_protein: "tofu" }),
    ];

    const filtered = filterRecipeBrowserRecipes(recipes, {
      ...EMPTY_SELECTED_FILTERS,
      cuisine: ["italian", "american"],
    });

    expect(filtered.map((recipe) => recipe.name)).toEqual(["Italian Chicken", "American Beef"]);
  });

  it("uses AND logic across filter families", () => {
    const matchingRecipe = makeRecipe({
      id: 1,
      name: "Italian Chicken Skillet",
      primary_protein: "chicken",
      cuisine: "italian",
      total_time_minutes: 25,
      difficulty: "easy",
      cook_method: "skillet",
    });

    expect(
      isRecipeBrowserRecipeEligible(matchingRecipe, {
        ...EMPTY_SELECTED_FILTERS,
        protein: ["chicken"],
        cuisine: ["italian"],
        time: ["30_min"],
        difficulty: ["easy"],
        method: ["skillet"],
      }),
    ).toBe(true);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({ ...matchingRecipe, name: "Wrong Method", cook_method: "oven" }),
        {
          ...EMPTY_SELECTED_FILTERS,
          protein: ["chicken"],
          cuisine: ["italian"],
          time: ["30_min"],
          difficulty: ["easy"],
          method: ["skillet"],
        },
      ),
    ).toBe(false);
  });

  it("handles mixed same-family and cross-family selections together", () => {
    const recipes = [
      makeRecipe({ id: 1, name: "Italian Chicken", cuisine: "italian", primary_protein: "chicken" }),
      makeRecipe({ id: 2, name: "American Chicken", cuisine: "american", primary_protein: "chicken" }),
      makeRecipe({ id: 3, name: "American Beef", cuisine: "american", primary_protein: "beef" }),
      makeRecipe({ id: 4, name: "Indian Chicken", cuisine: "indian", primary_protein: "chicken" }),
    ];

    const filtered = filterRecipeBrowserRecipes(recipes, {
      ...EMPTY_SELECTED_FILTERS,
      cuisine: ["italian", "american"],
      protein: ["chicken"],
    });

    expect(filtered.map((recipe) => recipe.name)).toEqual(["Italian Chicken", "American Chicken"]);
  });

  it("fails closed for unsupported or null metadata instead of guessing", () => {
    expect(
      deriveRecipeBrowserEligibleMetadata(
        makeRecipe({
          primary_protein: "egg",
          cuisine: "french",
          total_time_minutes: null,
          difficulty: "advanced",
          cook_method: "air_fryer",
        }),
      ),
    ).toEqual({
      protein: null,
      cuisine: null,
      time: null,
      difficulty: null,
      method: null,
    });

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: "egg",
          cuisine: "french",
          total_time_minutes: null,
          difficulty: "advanced",
          cook_method: "air_fryer",
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          protein: ["chicken"],
          cuisine: ["italian"],
          time: ["30_min"],
          difficulty: ["easy"],
          method: ["skillet"],
        },
      ),
    ).toBe(false);
  });
});
