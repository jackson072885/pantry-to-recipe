import { describe, expect, it } from "vitest";
import {
  buildBehaviorTrustNote,
  buildBestOptionComparison,
  buildEffortSummary,
  buildHeroTrustExplanation,
  getHeroPrimaryActionLabel,
  selectBestDinnerOption,
} from "./homeRecommendations";
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
    behavior: {
      has_signal: false,
      points: 0,
      direct_recipe_points: 0,
      ingredient_affinity_points: 0,
      ingredient_matches: [],
    },
    score_breakdown: {
      base_tonight_score: 0.9,
      behavior_points: 0,
      behavior_applied: false,
    },
    ...overrides,
  } as RecommendationEntry;
}

function makeRecommendations(overrides: Partial<RecommendationsResponse> = {}): RecommendationsResponse {
  return {
    recommendation_status: "strong_match",
    best_tonight: null,
    alternatives: [],
    closest_options: [],
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
        label: "Search Walmart for 1 missing ingredient",
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

  it("promotes the top surfaced fallback when no strong match is declared", () => {
    const closestCandidate = makeEntry({
      recipe: { ...makeEntry().recipe, recipe_id: 20, recipe_name: "One-Missing Stir Fry", missing_count: 1, pantry_coverage_pct: 88 },
      recommendation_type: "almost_there",
      missing: { count: 1, ingredients: ["lime"], summary: "Missing lime." },
    });

    const selected = selectBestDinnerOption(
      makeRecommendations({
        recommendation_status: "no_strong_match",
        best_tonight: null,
        alternatives: [closestCandidate],
        closest_options: [closestCandidate],
        almost_there: [closestCandidate],
      }),
    );

    expect(selected?.recipe.recipe_name).toBe("One-Missing Stir Fry");
  });

  it("keeps legacy grouped fallback behavior when status is absent", () => {
    const selected = selectBestDinnerOption(
      makeRecommendations({
        recommendation_status: undefined,
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

  it("builds trust copy from backend-visible pantry and time signals", () => {
    expect(buildHeroTrustExplanation(makeEntry())).toContain("Ready from your pantry");

    expect(
      buildHeroTrustExplanation(
        makeEntry({
          recipe: { ...makeEntry().recipe, pantry_coverage_pct: 88, missing_count: 1, estimated_time_minutes: 25 },
          missing: { count: 1, ingredients: ["onion"], summary: "Missing onion." },
          confidence_label: "medium",
        }),
      ),
    ).toContain("Missing onion");
  });

  it("calls out when recent history broke a close call", () => {
    expect(
      buildHeroTrustExplanation(
        makeEntry({
          behavior: {
            has_signal: true,
            points: 1.2,
            direct_recipe_points: 0,
            direct_recipe_event_count: 0,
            ingredient_affinity_points: 1.2,
            ingredient_matches: [{ ingredient: "onion", points: 1.2, event_count: 2 }],
          },
          score_breakdown: {
            base_tonight_score: 0.82,
            behavior_points: 1.2,
            behavior_applied: true,
          },
        }),
      ),
    ).toContain("recent activity on onion broke a close call");
  });

  it("explains how the winner beat the next option", () => {
    expect(
      buildBestOptionComparison(
        makeEntry(),
        makeEntry({
          recipe: { ...makeEntry().recipe, recipe_id: 2, missing_count: 2, pantry_coverage_pct: 80 },
          missing: { count: 2, ingredients: ["lime", "cilantro"], summary: "Missing 2 ingredients." },
        }),
      ),
    ).toContain("fewer ingredients");
  });

  it("returns effort and behavior notes from real backend fields", () => {
    expect(
      buildEffortSummary(
        makeEntry({
          recipe: { ...makeEntry().recipe, simplicity: 1.2 },
        }),
      ),
    ).toBe("Fast and low-friction");

    expect(
      buildBehaviorTrustNote(
        makeEntry({
          behavior: {
            has_signal: true,
            points: 0.8,
            direct_recipe_points: 0,
            direct_recipe_event_count: 0,
            ingredient_affinity_points: 0.8,
            ingredient_matches: [{ ingredient: "rice", points: 0.8, event_count: 1 }],
          },
          score_breakdown: {
            base_tonight_score: 0.8,
            behavior_points: 0.8,
            behavior_applied: true,
          },
        }),
      ),
    ).toContain("similar ingredients");
  });
});
