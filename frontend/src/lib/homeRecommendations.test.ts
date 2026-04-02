import { describe, expect, it } from "vitest";
import { buildHeroTrustExplanation, getHeroPrimaryActionLabel, selectBestDinnerOption } from "./homeRecommendations";
import type { RecommendationEntry, RecommendationsResponse } from "./mvpApi";

function makeEntry(overrides: Partial<RecommendationEntry> = {}): RecommendationEntry {
  return {
    recipe: {
      recipe_id: 1,
      recipe_name: "Skillet Rice",
      pantry_coverage_pct: 100,
      missing_count: 0,
      missing_ingredients: [],
      estimated_time_minutes: 20,
    },
    explanation: "Base explanation",
    why_best: "Base reason",
    recommendation_type: "cook_now",
    confidence_label: "high",
    missing: {
      count: 0,
      ingredients: [],
      summary: "No missing ingredients.",
    },
    cta: {
      type: "cook_recipe",
      label: "Cook This Tonight",
      pantry_ready: true,
      internal_path: "/recipes/1",
      affiliate_query: "",
      missing_count: 0,
      missing_ingredients: [],
    },
    ...overrides,
  };
}

function makeRecommendations(overrides: Partial<RecommendationsResponse> = {}): RecommendationsResponse {
  return {
    best_tonight: null,
    alternatives: [],
    cook_now: [],
    almost_there: [],
    not_worth_it: [],
    ...overrides,
  };
}

describe("homeRecommendations", () => {
  it("prefers best_tonight before grouped fallback options", () => {
    const bestTonight = makeEntry({
      recipe: { ...makeEntry().recipe, recipe_id: 9, recipe_name: "Best Tonight Chili" },
      recommendation_type: "almost_there",
    });
    const cookNow = makeEntry({ recipe: { ...makeEntry().recipe, recipe_id: 10, recipe_name: "Cook Now Pasta" } });
    const almostThere = makeEntry({
      recipe: { ...makeEntry().recipe, recipe_id: 11, recipe_name: "Almost There Soup", missing_count: 1, pantry_coverage_pct: 80 },
      missing: { count: 1, ingredients: ["parsley"], summary: "Missing parsley." },
      cta: {
        type: "shop_missing_ingredients",
        label: "Get 1 Missing Ingredient",
        pantry_ready: false,
        internal_path: "/recipes/11",
        affiliate_query: "parsley",
        missing_count: 1,
        missing_ingredients: ["parsley"],
      },
    });

    const selected = selectBestDinnerOption(
      makeRecommendations({
        best_tonight: bestTonight,
        cook_now: [cookNow],
        almost_there: [almostThere],
      }),
    );

    expect(selected?.recipe.recipe_name).toBe("Best Tonight Chili");
  });

  it("falls back from cook_now to almost_there in order", () => {
    const selected = selectBestDinnerOption(
      makeRecommendations({
        almost_there: [
          makeEntry({
            recipe: { ...makeEntry().recipe, recipe_id: 20, recipe_name: "One-Missing Stir Fry", missing_count: 1, pantry_coverage_pct: 88 },
            missing: { count: 1, ingredients: ["lime"], summary: "Missing lime." },
          }),
        ],
      }),
    );

    expect(selected?.recipe.recipe_name).toBe("One-Missing Stir Fry");
  });

  it("falls back to the first not-worth-it option when earlier groups are empty", () => {
    const selected = selectBestDinnerOption(
      makeRecommendations({
        not_worth_it: [
          makeEntry({
            recipe: { ...makeEntry().recipe, recipe_id: 30, recipe_name: "Weekend Project", missing_count: 4, pantry_coverage_pct: 40 },
            missing: { count: 4, ingredients: ["cream", "garlic", "wine", "thyme"], summary: "Missing 4 ingredients." },
          }),
        ],
      }),
    );

    expect(selected?.recipe.recipe_name).toBe("Weekend Project");
  });

  it("returns null when every recommendation bucket is empty", () => {
    const selected = selectBestDinnerOption(makeRecommendations());

    expect(selected).toBeNull();
  });

  it("uses direct hero CTA copy for ready and near-ready meals", () => {
    expect(getHeroPrimaryActionLabel(makeEntry())).toBe("Cook This Tonight");

    expect(
      getHeroPrimaryActionLabel(
        makeEntry({
          recipe: { ...makeEntry().recipe, missing_count: 1 },
          missing: { count: 1, ingredients: ["onion"], summary: "Missing onion." },
        }),
      ),
    ).toBe("View Recipe");
  });

  it("builds concise trust copy from missing count, confidence, and time", () => {
    expect(buildHeroTrustExplanation(makeEntry())).toContain("fastest high-confidence meals");

    expect(
      buildHeroTrustExplanation(
        makeEntry({
          recipe: { ...makeEntry().recipe, pantry_coverage_pct: 88, missing_count: 1, estimated_time_minutes: 25 },
          missing: { count: 1, ingredients: ["onion"], summary: "Missing onion." },
          confidence_label: "medium",
        }),
      ),
    ).toContain("only missing one ingredient");
  });
});
