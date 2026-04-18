import { describe, expect, it } from "vitest";

import type { RecipeDetail, RecipeIngredient } from "./mvpApi";
import {
  deriveRecipeBrowserEligibleMetadata,
  filterRecipeBrowserRecipes,
  isRecipeBrowserRecipeEligible,
  type RecipeBrowserSelectedFilters,
} from "./recipeBrowserEligibility";

const EMPTY_SELECTED_FILTERS: RecipeBrowserSelectedFilters = {
  ingredients: [],
  protein: [],
  cuisine: [],
  time: [],
  difficulty: [],
  method: [],
  cleanup: [],
  diet: [],
  household: [],
  cost: [],
};

type TestRecipe = Pick<
  RecipeDetail,
  | "primary_protein"
  | "ingredients"
  | "cuisine"
  | "total_time_minutes"
  | "difficulty"
  | "cook_method"
  | "tags"
  | "is_weeknight_friendly"
> & {
  id: number;
  name: string;
};

function makeIngredient(
  ingredient_name: string,
  overrides: Partial<RecipeIngredient> = {},
): RecipeIngredient {
  return {
    ingredient_id: 1,
    ingredient_name,
    is_required: true,
    measurement_is_estimated: false,
    ...overrides,
  };
}

function makeRecipe(
  overrides: Partial<{
    id: number;
    name: string;
    primary_protein: string | null;
    cuisine: string | null;
    total_time_minutes: number | null;
    difficulty: string | null;
    cook_method: string | null;
    tags: string[];
    is_weeknight_friendly: boolean | null;
    ingredients: RecipeIngredient[];
  }> = {},
): TestRecipe {
  return {
    id: 1,
    name: "Test Recipe",
    primary_protein: "chicken",
    cuisine: "italian",
    total_time_minutes: 25,
    difficulty: "easy",
    cook_method: "skillet",
    tags: ["budget"],
    is_weeknight_friendly: false,
    ingredients: [
      makeIngredient("chicken", { ingredient_id: 1 }),
      makeIngredient("garlic", { ingredient_id: 2 }),
      makeIngredient("pasta", { ingredient_id: 3 }),
    ],
    ...overrides,
  };
}

describe("recipeBrowserEligibility", () => {
  it("keeps the unfiltered result set when no filters are selected", () => {
    const recipes = [
      makeRecipe({ id: 1, name: "Chicken Pasta" }),
      makeRecipe({
        id: 2,
        name: "Beef Soup",
        primary_protein: "beef",
        cuisine: "american",
        cook_method: "stovetop",
        tags: ["moderate"],
        ingredients: [makeIngredient("beef", { ingredient_id: 4 }), makeIngredient("garlic", { ingredient_id: 5 })],
      }),
    ];

    expect(filterRecipeBrowserRecipes(recipes, EMPTY_SELECTED_FILTERS)).toEqual(recipes);
  });

  it("uses OR logic within the cuisine taxonomy family", () => {
    const recipes = [
      makeRecipe({ id: 1, name: "Italian Chicken", cuisine: "italian" }),
      makeRecipe({
        id: 2,
        name: "Mexican Beef",
        cuisine: "mexican",
        primary_protein: "beef",
        ingredients: [makeIngredient("beef", { ingredient_id: 6 }), makeIngredient("cumin", { ingredient_id: 7 })],
        tags: ["moderate"],
      }),
      makeRecipe({
        id: 3,
        name: "Indian Tofu",
        cuisine: "indian",
        primary_protein: "tofu",
        ingredients: [makeIngredient("tofu", { ingredient_id: 8 })],
        tags: ["budget"],
      }),
    ];

    const filtered = filterRecipeBrowserRecipes(recipes, {
      ...EMPTY_SELECTED_FILTERS,
      cuisine: ["italian", "mexican"],
    });

    expect(filtered.map((recipe) => recipe.name)).toEqual(["Italian Chicken", "Mexican Beef"]);
  });

  it("uses AND logic inside the ingredients family by default", () => {
    const recipes = [
      makeRecipe({ id: 1, name: "Chicken Garlic Pasta" }),
      makeRecipe({
        id: 2,
        name: "Chicken Only",
        ingredients: [makeIngredient("chicken", { ingredient_id: 9 })],
      }),
      makeRecipe({
        id: 3,
        name: "Garlic Pasta",
        primary_protein: null,
        ingredients: [makeIngredient("garlic", { ingredient_id: 10 }), makeIngredient("pasta", { ingredient_id: 11 })],
      }),
    ];

    const filtered = filterRecipeBrowserRecipes(recipes, {
      ...EMPTY_SELECTED_FILTERS,
      ingredients: ["chicken", "garlic"],
    });

    expect(filtered.map((recipe) => recipe.name)).toEqual(["Chicken Garlic Pasta"]);
  });

  it("uses AND logic across different filter families", () => {
    const matchingRecipe = makeRecipe({
      id: 1,
      name: "Italian Chicken Skillet",
      primary_protein: "chicken",
      cuisine: "italian",
      total_time_minutes: 25,
      difficulty: "easy",
      cook_method: "skillet",
      tags: ["budget"],
      ingredients: [makeIngredient("chicken", { ingredient_id: 12 }), makeIngredient("garlic", { ingredient_id: 13 })],
    });

    expect(
      isRecipeBrowserRecipeEligible(matchingRecipe, {
        ...EMPTY_SELECTED_FILTERS,
        ingredients: ["chicken", "garlic"],
        cuisine: ["italian"],
        time: ["30_min"],
        difficulty: ["easy"],
        method: ["skillet"],
        cost: ["budget"],
      }),
    ).toBe(true);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          ...matchingRecipe,
          name: "Wrong Method",
          cook_method: "oven",
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["chicken", "garlic"],
          cuisine: ["italian"],
          time: ["30_min"],
          difficulty: ["easy"],
          method: ["skillet"],
          cost: ["budget"],
        },
      ),
    ).toBe(false);
  });

  it("includes descendant cuisines when a parent taxonomy is selected", () => {
    const recipes = [
      makeRecipe({ id: 1, name: "Latin Root Dish", cuisine: "latin" }),
      makeRecipe({ id: 2, name: "Cuban Chicken", cuisine: "cuban" }),
      makeRecipe({ id: 3, name: "Italian Chicken", cuisine: "italian" }),
    ];

    const filtered = filterRecipeBrowserRecipes(recipes, {
      ...EMPTY_SELECTED_FILTERS,
      cuisine: ["latin"],
    });

    expect(filtered.map((recipe) => recipe.name)).toEqual(["Latin Root Dish", "Cuban Chicken"]);
  });

  it("narrows to the selected taxonomy subtree when a child cuisine is selected", () => {
    const recipes = [
      makeRecipe({ id: 1, name: "Latin Root Dish", cuisine: "latin" }),
      makeRecipe({ id: 2, name: "Cuban Chicken", cuisine: "cuban" }),
      makeRecipe({ id: 3, name: "Mexican Chicken", cuisine: "mexican" }),
    ];

    const filtered = filterRecipeBrowserRecipes(recipes, {
      ...EMPTY_SELECTED_FILTERS,
      cuisine: ["cuban"],
    });

    expect(filtered.map((recipe) => recipe.name)).toEqual(["Cuban Chicken"]);
  });

  it("derives explicit browser-safe metadata without guessing unsupported values", () => {
    expect(
      deriveRecipeBrowserEligibleMetadata(
        makeRecipe({
          primary_protein: "egg",
          cuisine: "french",
          total_time_minutes: null,
          difficulty: "advanced",
          cook_method: "air_fryer",
          tags: ["premium"],
          ingredients: [makeIngredient("egg", { ingredient_id: 14 })],
        }),
      ),
    ).toEqual({
      ingredients: ["eggs"],
      protein: ["eggs"],
      cuisinePath: null,
      time: null,
      difficulty: null,
      method: null,
      cleanup: null,
      diet: [],
      household: [],
      cost: null,
    });
  });

  it("normalizes common supported ingredient aliases without loosening unsupported tokens", () => {
    expect(
      deriveRecipeBrowserEligibleMetadata(
        makeRecipe({
          primary_protein: null,
          is_weeknight_friendly: true,
          ingredients: [
            makeIngredient("chicken breast", { ingredient_id: 20 }),
            makeIngredient("shrimp", { ingredient_id: 21 }),
            makeIngredient("egg", { ingredient_id: 22 }),
          ],
        }),
      ),
    ).toEqual({
      ingredients: ["chicken_breast", "shrimp", "eggs"],
      protein: ["chicken", "seafood", "eggs"],
      cuisinePath: ["italian"],
      time: "30_min",
      difficulty: "easy",
      method: "skillet",
      cleanup: null,
      diet: [],
      household: ["weeknight"],
      cost: "budget",
    });
  });

  it("filters by explicit vegetarian tags and fails closed for unsupported diet labels", () => {
    const recipes = [
      makeRecipe({ id: 1, name: "Vegetarian Pasta", primary_protein: null, tags: ["budget", "vegetarian"] }),
      makeRecipe({ id: 2, name: "High Protein Chicken", tags: ["budget", "high_protein"] }),
      makeRecipe({ id: 3, name: "No Diet Tag", tags: ["budget"] }),
    ];

    expect(
      filterRecipeBrowserRecipes(recipes, {
        ...EMPTY_SELECTED_FILTERS,
        diet: ["vegetarian"],
      }).map((recipe) => recipe.name),
    ).toEqual(["Vegetarian Pasta"]);
  });

  it("filters by explicit supported household signals and fails closed for unsupported intent tags", () => {
    const recipes = [
      makeRecipe({ id: 1, name: "Weeknight Chicken", tags: ["budget", "weeknight"], is_weeknight_friendly: true }),
      makeRecipe({ id: 2, name: "Meal Prep Beans", primary_protein: "beans", tags: ["budget", "meal_prep"] }),
      makeRecipe({ id: 3, name: "Comfort Food Pasta", tags: ["budget", "comfort_food"], is_weeknight_friendly: false }),
    ];

    expect(
      filterRecipeBrowserRecipes(recipes, {
        ...EMPTY_SELECTED_FILTERS,
        household: ["weeknight"],
      }).map((recipe) => recipe.name),
    ).toEqual(["Weeknight Chicken"]);

    expect(
      filterRecipeBrowserRecipes(recipes, {
        ...EMPTY_SELECTED_FILTERS,
        household: ["meal_prep", "kid_friendly"],
      }).map((recipe) => recipe.name),
    ).toEqual(["Meal Prep Beans"]);
  });

  it("matches protein browse filters with OR semantics inside the family", () => {
    const recipes = [
      makeRecipe({ id: 1, name: "Chicken Pasta", primary_protein: "chicken" }),
      makeRecipe({
        id: 2,
        name: "Tofu Bowl",
        primary_protein: "tofu",
        ingredients: [makeIngredient("tofu", { ingredient_id: 30 })],
      }),
      makeRecipe({
        id: 3,
        name: "Beef Soup",
        primary_protein: "beef",
        ingredients: [makeIngredient("beef", { ingredient_id: 31 })],
      }),
    ];

    const filtered = filterRecipeBrowserRecipes(recipes, {
      ...EMPTY_SELECTED_FILTERS,
      protein: ["chicken", "tofu_plant_protein"],
    });

    expect(filtered.map((recipe) => recipe.name)).toEqual(["Chicken Pasta", "Tofu Bowl"]);
  });

  it("filters by supported coarse cost tags with OR semantics inside the cost family", () => {
    const recipes = [
      makeRecipe({ id: 1, name: "Budget Chicken", tags: ["budget"] }),
      makeRecipe({ id: 2, name: "Moderate Beef", primary_protein: "beef", tags: ["moderate"] }),
      makeRecipe({ id: 3, name: "Unsupported Cost", tags: ["premium"] }),
    ];

    expect(
      filterRecipeBrowserRecipes(recipes, {
        ...EMPTY_SELECTED_FILTERS,
        cost: ["budget"],
      }).map((recipe) => recipe.name),
    ).toEqual(["Budget Chicken"]);

    expect(
      filterRecipeBrowserRecipes(recipes, {
        ...EMPTY_SELECTED_FILTERS,
        cost: ["budget", "moderate"],
      }).map((recipe) => recipe.name),
    ).toEqual(["Budget Chicken", "Moderate Beef"]);
  });

  it("filters by supported coarse cleanup tags with OR semantics inside the cleanup family", () => {
    const recipes = [
      makeRecipe({ id: 1, name: "One Pan Chicken", tags: ["budget", "one_pan"] }),
      makeRecipe({ id: 2, name: "Sheet Pan Tofu", primary_protein: "tofu", tags: ["budget", "sheet_pan"] }),
      makeRecipe({ id: 3, name: "No Cleanup Tag", tags: ["budget"] }),
    ];

    expect(
      filterRecipeBrowserRecipes(recipes, {
        ...EMPTY_SELECTED_FILTERS,
        cleanup: ["one_pan"],
      }).map((recipe) => recipe.name),
    ).toEqual(["One Pan Chicken"]);

    expect(
      filterRecipeBrowserRecipes(recipes, {
        ...EMPTY_SELECTED_FILTERS,
        cleanup: ["one_pan", "sheet_pan"],
      }).map((recipe) => recipe.name),
    ).toEqual(["One Pan Chicken", "Sheet Pan Tofu"]);
  });

  it("keeps honest empty results instead of loosening the ingredient query", () => {
    const filtered = filterRecipeBrowserRecipes(
      [
        makeRecipe({
          id: 1,
          name: "Chicken Garlic Pasta",
          ingredients: [makeIngredient("chicken", { ingredient_id: 15 }), makeIngredient("garlic", { ingredient_id: 16 })],
        }),
      ],
      {
        ...EMPTY_SELECTED_FILTERS,
        ingredients: ["chicken", "limes"],
      },
    );

    expect(filtered).toEqual([]);
  });
});
