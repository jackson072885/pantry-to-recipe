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
      ingredients: ["chicken_breast", "chicken", "shrimp", "eggs"],
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

  it("keeps sauce-specific leaves strict instead of widening them to nearby tomato or salsa tokens", () => {
    expect(
      deriveRecipeBrowserEligibleMetadata(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("marinara", { ingredient_id: 201 }),
            makeIngredient("pasta", { ingredient_id: 202 }),
          ],
        }),
      ).ingredients,
    ).toContain("marinara");

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("tomato sauce", { ingredient_id: 203 }),
            makeIngredient("pasta", { ingredient_id: 204 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["marinara"],
        },
      ),
    ).toBe(false);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("salsa", { ingredient_id: 205 }),
            makeIngredient("corn tortillas", { ingredient_id: 206 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["enchilada_sauce"],
        },
      ),
    ).toBe(false);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("enchilada sauce", { ingredient_id: 207 }),
            makeIngredient("corn tortillas", { ingredient_id: 208 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["enchilada_sauce"],
        },
      ),
    ).toBe(true);
  });

  it("keeps cheese and dairy leaves specific while still letting specific cheeses satisfy the broad cheese leaf", () => {
    expect(
      deriveRecipeBrowserEligibleMetadata(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("sour cream", { ingredient_id: 209 }),
            makeIngredient("cheddar cheese", { ingredient_id: 210 }),
          ],
        }),
      ).ingredients,
    ).toEqual(["sour_cream", "cheddar", "cheese"]);

    expect(
      deriveRecipeBrowserEligibleMetadata(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("heavy cream", { ingredient_id: 211 }),
            makeIngredient("parmesan cheese", { ingredient_id: 212 }),
          ],
        }),
      ).ingredients,
    ).toEqual(["cream", "parmesan", "cheese"]);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("sour cream", { ingredient_id: 213 }),
            makeIngredient("cheddar cheese", { ingredient_id: 214 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["cream"],
        },
      ),
    ).toBe(false);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("heavy cream", { ingredient_id: 215 }),
            makeIngredient("parmesan cheese", { ingredient_id: 216 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["sour_cream"],
        },
      ),
    ).toBe(false);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("feta cheese", { ingredient_id: 217 }),
            makeIngredient("orzo", { ingredient_id: 218 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["cheese"],
        },
      ),
    ).toBe(true);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("cream cheese", { ingredient_id: 219 }),
            makeIngredient("bagel", { ingredient_id: 220 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["cheese"],
        },
      ),
    ).toBe(false);
  });

  it("lets cod and other white-fish species satisfy the broader white fish leaf", () => {
    expect(
      deriveRecipeBrowserEligibleMetadata(
        makeRecipe({
          primary_protein: "cod",
          ingredients: [makeIngredient("cod", { ingredient_id: 23 }), makeIngredient("lime", { ingredient_id: 24 })],
        }),
      ).ingredients,
    ).toEqual(["seafood", "cod", "white_fish", "limes"]);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: "cod",
          ingredients: [makeIngredient("cod", { ingredient_id: 25 }), makeIngredient("lime", { ingredient_id: 26 })],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["white_fish"],
        },
      ),
    ).toBe(true);
  });

  it("lets specific bean and noodle leaves satisfy the broader browser leaf without widening the reverse match", () => {
    expect(
      deriveRecipeBrowserEligibleMetadata(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("black beans", { ingredient_id: 221 }),
            makeIngredient("rice", { ingredient_id: 222 }),
          ],
        }),
      ).ingredients,
    ).toEqual(["black_beans", "beans", "rice"]);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("chickpeas", { ingredient_id: 223 }),
            makeIngredient("spinach", { ingredient_id: 224 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["beans"],
        },
      ),
    ).toBe(true);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("beans", { ingredient_id: 225 }),
            makeIngredient("rice", { ingredient_id: 226 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["black_beans"],
        },
      ),
    ).toBe(false);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("ravioli", { ingredient_id: 227 }),
            makeIngredient("marinara", { ingredient_id: 228 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["pasta"],
        },
      ),
    ).toBe(true);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("ramen", { ingredient_id: 229 }),
            makeIngredient("soy sauce", { ingredient_id: 230 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["noodles"],
        },
      ),
    ).toBe(true);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("pasta", { ingredient_id: 231 }),
            makeIngredient("tomato sauce", { ingredient_id: 232 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["ravioli"],
        },
      ),
    ).toBe(false);
  });

  it("lets specific broth and oil leaves satisfy the broader leaf without widening specific filters", () => {
    expect(
      deriveRecipeBrowserEligibleMetadata(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("olive oil", { ingredient_id: 233 }),
            makeIngredient("chicken broth", { ingredient_id: 234 }),
            makeIngredient("rice", { ingredient_id: 235 }),
          ],
        }),
      ).ingredients,
    ).toEqual(["olive_oil", "oil", "chicken_broth", "broth", "rice"]);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("sesame oil", { ingredient_id: 236 }),
            makeIngredient("stock", { ingredient_id: 237 }),
            makeIngredient("noodles", { ingredient_id: 238 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["oil", "broth"],
        },
      ),
    ).toBe(true);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("broth", { ingredient_id: 239 }),
            makeIngredient("rice", { ingredient_id: 240 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["chicken_broth"],
        },
      ),
    ).toBe(false);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("oil", { ingredient_id: 241 }),
            makeIngredient("rice", { ingredient_id: 242 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["sesame_oil"],
        },
      ),
    ).toBe(false);
  });

  it("lets specific poultry, beef, and pork leaves satisfy the broader leaf without widening the reverse match", () => {
    expect(
      deriveRecipeBrowserEligibleMetadata(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("chicken breast", { ingredient_id: 243 }),
            makeIngredient("ground beef", { ingredient_id: 244 }),
            makeIngredient("ham", { ingredient_id: 245 }),
          ],
        }),
      ).ingredients,
    ).toEqual(["chicken_breast", "chicken", "ground_beef", "beef", "ham", "pork"]);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("chicken thighs", { ingredient_id: 246 }),
            makeIngredient("garlic", { ingredient_id: 247 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["chicken"],
        },
      ),
    ).toBe(true);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("steak", { ingredient_id: 248 }),
            makeIngredient("butter", { ingredient_id: 249 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["beef"],
        },
      ),
    ).toBe(true);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("bacon", { ingredient_id: 250 }),
            makeIngredient("potatoes", { ingredient_id: 251 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["pork"],
        },
      ),
    ).toBe(true);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("chicken", { ingredient_id: 252 }),
            makeIngredient("rice", { ingredient_id: 253 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["chicken_breast"],
        },
      ),
    ).toBe(false);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("beef", { ingredient_id: 254 }),
            makeIngredient("rice", { ingredient_id: 255 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["steak"],
        },
      ),
    ).toBe(false);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("pork", { ingredient_id: 256 }),
            makeIngredient("beans", { ingredient_id: 257 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["bacon"],
        },
      ),
    ).toBe(false);

    expect(
      deriveRecipeBrowserEligibleMetadata(
        makeRecipe({
          primary_protein: "steak",
          ingredients: [
            makeIngredient("beef strips", { ingredient_id: 258 }),
            makeIngredient("broccoli", { ingredient_id: 259 }),
          ],
        }),
      ).ingredients,
    ).toEqual(["steak", "beef", "broccoli"]);
  });

  it("lets white-fish leaves roll up through white fish into seafood without widening specific species filters", () => {
    expect(
      deriveRecipeBrowserEligibleMetadata(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("cod", { ingredient_id: 258 }),
            makeIngredient("rice", { ingredient_id: 259 }),
          ],
        }),
      ).ingredients,
    ).toEqual(["cod", "white_fish", "seafood", "rice"]);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("tilapia", { ingredient_id: 260 }),
            makeIngredient("lime", { ingredient_id: 261 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["white_fish", "seafood"],
        },
      ),
    ).toBe(true);

    expect(
      isRecipeBrowserRecipeEligible(
        makeRecipe({
          primary_protein: null,
          ingredients: [
            makeIngredient("white fish", { ingredient_id: 262 }),
            makeIngredient("lime", { ingredient_id: 263 }),
          ],
        }),
        {
          ...EMPTY_SELECTED_FILTERS,
          ingredients: ["cod"],
        },
      ),
    ).toBe(false);
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
