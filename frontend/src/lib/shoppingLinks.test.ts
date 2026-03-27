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
