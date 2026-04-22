import { describe, expect, it } from "vitest";

import type { RecommendationEntry, RecommendationsResponse, RecipeDetail } from "./mvpApi";
import { rankRecipeBrowserRecipes } from "./recipeBrowserRanking";

function makeRecipe(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: 1,
    name: "Test Recipe",
    short_description: "A browser test recipe.",
    cuisine: "italian",
    primary_protein: "chicken",
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
    tags: [],
    readiness: {
      can_cook_now: false,
      required_ready_count: 0,
      required_count: 3,
      missing_required_ingredients: [],
      missing_optional_ingredients: [],
      required_quantity_confirmation_ingredients: [],
      optional_quantity_confirmation_ingredients: [],
    },
    ingredients: [],
    steps: [],
    ...overrides,
  };
}

function makeRecommendationEntry(
  recipeId: number,
  recipeName: string,
  recommendationType: "cook_now" | "almost_there" | "not_worth_it",
  missingCount: number,
  pantryCoveragePct: number,
): RecommendationEntry {
  return {
    recipe: {
      recipe_id: recipeId,
      recipe_name: recipeName,
      short_description: null,
      difficulty: "easy",
      pantry_coverage_pct: pantryCoveragePct,
      missing_count: missingCount,
      missing_ingredients: missingCount === 0 ? [] : ["salt"],
      estimated_time_minutes: 25,
      servings: 4,
      required_count: 4,
      present_required_count: 4 - missingCount,
      recommendation_type: recommendationType,
    },
    explanation: "Pantry truth explanation.",
    recommendation_type: recommendationType,
    missing: {
      count: missingCount,
      ingredients: missingCount === 0 ? [] : ["salt"],
      summary: missingCount === 0 ? "No missing ingredients." : `Missing ${missingCount} ingredient${missingCount === 1 ? "" : "s"}.`,
    },
    cta: {
      type: missingCount === 0 ? "cook_recipe" : "shop_missing_ingredients",
      label: "Open recipe",
      pantry_ready: missingCount === 0,
      internal_path: `/recipes/${recipeId}`,
      affiliate_query: "",
      missing_count: missingCount,
      missing_ingredients: missingCount === 0 ? [] : ["salt"],
    },
    tonight_score: 0.8,
  };
}

function makeRecommendationsResponse(entries: {
  best_tonight?: RecommendationEntry | null;
  alternatives?: RecommendationEntry[];
  closest_options?: RecommendationEntry[];
  cook_now?: RecommendationEntry[];
  almost_there?: RecommendationEntry[];
  not_worth_it?: RecommendationEntry[];
}): RecommendationsResponse {
  return {
    best_tonight: entries.best_tonight ?? entries.cook_now?.[0] ?? null,
    alternatives: entries.alternatives ?? [],
    closest_options: entries.closest_options ?? [],
    cook_now: entries.cook_now ?? [],
    almost_there: entries.almost_there ?? [],
    not_worth_it: entries.not_worth_it ?? [],
  };
}

describe("recipeBrowserRanking", () => {
  it("reorders only the eligible set using the live recommendation order", () => {
    const recipes = [
      makeRecipe({ id: 11, name: "Stretch Soup" }),
      makeRecipe({ id: 12, name: "Cook Now Pasta" }),
      makeRecipe({ id: 13, name: "Almost There Tacos" }),
    ];

    const ranked = rankRecipeBrowserRecipes(
      recipes,
      makeRecommendationsResponse({
        cook_now: [makeRecommendationEntry(12, "Cook Now Pasta", "cook_now", 0, 100)],
        almost_there: [makeRecommendationEntry(13, "Almost There Tacos", "almost_there", 1, 82)],
        not_worth_it: [makeRecommendationEntry(11, "Stretch Soup", "not_worth_it", 3, 41)],
      }),
    );

    expect(ranked.map((item) => item.recipe.name)).toEqual([
      "Cook Now Pasta",
      "Almost There Tacos",
      "Stretch Soup",
    ]);
  });

  it("keeps the original eligible order when pantry-aware recommendations are unavailable", () => {
    const recipes = [
      makeRecipe({ id: 1, name: "First" }),
      makeRecipe({ id: 2, name: "Second" }),
    ];

    expect(rankRecipeBrowserRecipes(recipes, null).map((item) => item.recipe.name)).toEqual([
      "First",
      "Second",
    ]);
  });

  it("maps recommendation groups into honest browser badge states", () => {
    const ranked = rankRecipeBrowserRecipes(
      [
        makeRecipe({ id: 1, name: "Cook Now Pasta" }),
        makeRecipe({ id: 2, name: "Almost There Tacos" }),
        makeRecipe({ id: 3, name: "Stretch Soup" }),
      ],
      makeRecommendationsResponse({
        cook_now: [makeRecommendationEntry(1, "Cook Now Pasta", "cook_now", 0, 100)],
        almost_there: [makeRecommendationEntry(2, "Almost There Tacos", "almost_there", 1, 84)],
        not_worth_it: [makeRecommendationEntry(3, "Stretch Soup", "not_worth_it", 3, 47)],
      }),
    );

    expect(ranked[0].pantryFit).toMatchObject({
      state: "cook_now",
      badgeLabel: "Cook Now",
      missingCount: 0,
      pantryCoveragePct: 100,
    });
    expect(ranked[1].pantryFit).toMatchObject({
      state: "almost_there",
      badgeLabel: "Almost There",
      missingCount: 1,
      pantryCoveragePct: 84,
    });
    expect(ranked[2].pantryFit).toMatchObject({
      state: "pantry_stretch",
      badgeLabel: "Pantry Stretch",
      missingCount: 3,
      pantryCoveragePct: 47,
    });
  });

  it("keeps unranked eligible recipes in their original relative order", () => {
    const ranked = rankRecipeBrowserRecipes(
      [
        makeRecipe({ id: 3, name: "Unranked First" }),
        makeRecipe({ id: 1, name: "Cook Now Pasta" }),
        makeRecipe({ id: 4, name: "Unranked Second" }),
        makeRecipe({ id: 2, name: "Almost There Tacos" }),
      ],
      makeRecommendationsResponse({
        cook_now: [makeRecommendationEntry(1, "Cook Now Pasta", "cook_now", 0, 100)],
        almost_there: [makeRecommendationEntry(2, "Almost There Tacos", "almost_there", 1, 84)],
      }),
    );

    expect(ranked.map((item) => item.recipe.name)).toEqual([
      "Cook Now Pasta",
      "Almost There Tacos",
      "Unranked First",
      "Unranked Second",
    ]);
    expect(ranked[2].pantryFit).toBeNull();
    expect(ranked[3].pantryFit).toBeNull();
  });

  it("uses closest surfaced recommendation entries to lift near-ready browser results", () => {
    const enchiladaSkillet = makeRecommendationEntry(21, "Chicken Enchilada Rice Skillet", "almost_there", 1, 100);
    enchiladaSkillet.missing = Object.assign({}, enchiladaSkillet.missing, {
      count: 1,
      ingredients: ["chicken breast"],
      summary: "Need quantity confirmation for 1 ingredient: chicken breast.",
      quantity_confirmation_count: 1,
      quantity_confirmation_ingredients: ["chicken breast"],
    });
    enchiladaSkillet.cta = {
      ...enchiladaSkillet.cta,
      type: "cook_recipe",
      pantry_ready: false,
      missing_count: 0,
      missing_ingredients: [],
    };

    const ranked = rankRecipeBrowserRecipes(
      [
        makeRecipe({ id: 30, name: "Catalog First" }),
        makeRecipe({ id: 21, name: "Chicken Enchilada Rice Skillet" }),
        makeRecipe({ id: 31, name: "Catalog Third" }),
      ],
      makeRecommendationsResponse({
        closest_options: [enchiladaSkillet],
      }),
    );

    expect(ranked.map((item) => item.recipe.name)).toEqual([
      "Chicken Enchilada Rice Skillet",
      "Catalog First",
      "Catalog Third",
    ]);
    expect(ranked[0].pantryFit).toMatchObject({
      state: "almost_there",
      pantryCoveragePct: 100,
      missingCount: 1,
      summary: "Need quantity confirmation for 1 ingredient: chicken breast.",
    });
  });
});
