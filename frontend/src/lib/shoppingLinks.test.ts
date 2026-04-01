import { describe, expect, it } from "vitest";
import { buildShoppingSearchUrl, getCookTonightHref, normalizeShoppingItems } from "./shoppingLinks";
import type { RecommendationEntry } from "./mvpApi";

const cookNowEntry: RecommendationEntry = {
  recipe: {
    recipe_id: 7,
    recipe_name: "Chicken Rice Bowl",
    pantry_coverage_pct: 100,
    missing_count: 0,
    missing_ingredients: [],
  },
  explanation: "Everything is already in the pantry.",
  why_best: "Chicken Rice Bowl is ready without a store stop.",
  recommendation_type: "cook_now",
  confidence_score: 0.96,
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
    internal_path: "/recipes/7",
    affiliate_query: "",
    missing_count: 0,
    missing_ingredients: [],
  },
};

const missingEntry: RecommendationEntry = {
  recipe: {
    recipe_id: 8,
    recipe_name: "Bean Skillet",
    pantry_coverage_pct: 50,
    missing_count: 2,
    missing_ingredients: ["Onion", " onion ", "Garlic"],
  },
  explanation: "Missing a few items.",
  why_best: "Bean Skillet is one quick ingredient away.",
  recommendation_type: "almost_there",
  confidence_score: 0.72,
  confidence_label: "medium",
  missing: {
    count: 2,
    ingredients: ["Onion", " onion ", "Garlic"],
    summary: "Missing 2 ingredients: Onion, onion, Garlic.",
  },
  cta: {
    type: "shop_missing_ingredients",
    label: "Get 2 Missing Ingredients",
    pantry_ready: false,
    internal_path: "/recipes/8",
    affiliate_query: "Onion Garlic",
    missing_count: 2,
    missing_ingredients: ["Onion", " onion ", "Garlic"],
  },
};

describe("shoppingLinks", () => {
  it("normalizes and deduplicates shopping items", () => {
    expect(normalizeShoppingItems(["Onion", " onion ", "", "Garlic"])).toEqual(["Onion", "Garlic"]);
  });

  it("returns null for an empty shopping query", () => {
    expect(buildShoppingSearchUrl(["   ", ""])).toBeNull();
  });

  it("builds an external retailer search when ingredients are missing", () => {
    expect(getCookTonightHref(missingEntry)).toBe("https://www.walmart.com/search?q=Onion+Garlic");
  });

  it("supports optional affiliate parameters without hardcoding ids", () => {
    expect(
      buildShoppingSearchUrl(["Onion", "Garlic"], {
        affiliateParams: {
          ref: "partner-123",
          campaign: "dinner-decision",
        },
      }),
    ).toBe("https://www.walmart.com/search?q=Onion+Garlic&ref=partner-123&campaign=dinner-decision");
  });

  it("falls back to the internal recipe route when nothing is missing", () => {
    expect(getCookTonightHref(cookNowEntry)).toBe("/recipes/7");
  });
});
