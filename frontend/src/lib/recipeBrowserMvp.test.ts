import { describe, expect, it } from "vitest";

import {
  RECIPE_BROWSER_MVP_DEFERRED,
  RECIPE_BROWSER_MVP_FILTER_ORDER,
  RECIPE_BROWSER_MVP_FILTERS,
  deriveRecipeBrowserTimeBucket,
  normalizeRecipeBrowserProteinFamily,
} from "./recipeBrowserMvp";

describe("recipeBrowserMvp contract", () => {
  it("keeps the Phase 1 filter family order explicit", () => {
    expect(RECIPE_BROWSER_MVP_FILTER_ORDER.map((family) => family.id)).toEqual([
      "protein",
      "cuisine",
      "time",
      "difficulty",
      "method",
    ]);
  });

  it("locks the supported Phase 1 option ids", () => {
    expect(RECIPE_BROWSER_MVP_FILTERS.protein.options.map((option) => option.id)).toEqual([
      "chicken",
      "beef",
      "pork",
      "turkey",
      "seafood",
      "tofu",
    ]);
    expect(RECIPE_BROWSER_MVP_FILTERS.cuisine.options.map((option) => option.id)).toEqual([
      "american",
      "asian",
      "bbq",
      "indian",
      "italian",
      "mediterranean",
      "mexican",
      "southern",
      "tex_mex",
    ]);
    expect(RECIPE_BROWSER_MVP_FILTERS.difficulty.options.map((option) => option.id)).toEqual([
      "easy",
      "medium",
    ]);
    expect(RECIPE_BROWSER_MVP_FILTERS.method.options.map((option) => option.id)).toEqual([
      "skillet",
      "stovetop",
      "oven",
    ]);
  });

  it("derives time buckets from total_time_minutes with stable boundaries", () => {
    expect(deriveRecipeBrowserTimeBucket(undefined)).toBeNull();
    expect(deriveRecipeBrowserTimeBucket(null)).toBeNull();
    expect(deriveRecipeBrowserTimeBucket(0)).toBeNull();
    expect(deriveRecipeBrowserTimeBucket(15)).toBe("15_min");
    expect(deriveRecipeBrowserTimeBucket(16)).toBe("30_min");
    expect(deriveRecipeBrowserTimeBucket(30)).toBe("30_min");
    expect(deriveRecipeBrowserTimeBucket(31)).toBe("45_min");
    expect(deriveRecipeBrowserTimeBucket(45)).toBe("45_min");
    expect(deriveRecipeBrowserTimeBucket(46)).toBe("45_plus_min");
  });

  it("normalizes live primary_protein values into narrow Browser families", () => {
    expect(normalizeRecipeBrowserProteinFamily("chicken")).toBe("chicken");
    expect(normalizeRecipeBrowserProteinFamily("ground beef")).toBe("beef");
    expect(normalizeRecipeBrowserProteinFamily("sausage")).toBe("pork");
    expect(normalizeRecipeBrowserProteinFamily("ground turkey")).toBe("turkey");
    expect(normalizeRecipeBrowserProteinFamily("salmon")).toBe("seafood");
    expect(normalizeRecipeBrowserProteinFamily("tofu")).toBe("tofu");
    expect(normalizeRecipeBrowserProteinFamily("egg")).toBeNull();
    expect(normalizeRecipeBrowserProteinFamily("")).toBeNull();
    expect(normalizeRecipeBrowserProteinFamily(null)).toBeNull();
  });

  it("keeps explicitly deferred Browser ideas out of the MVP contract", () => {
    expect(RECIPE_BROWSER_MVP_DEFERRED.proteinFamilies).toContain("vegetarian");
    expect(RECIPE_BROWSER_MVP_DEFERRED.proteinFamilies).toContain("beans");
    expect(RECIPE_BROWSER_MVP_DEFERRED.methods).toContain("air_fryer");
    expect(RECIPE_BROWSER_MVP_DEFERRED.methods).toContain("sheet_pan");
    expect(RECIPE_BROWSER_MVP_DEFERRED.difficulties).toContain("advanced");
    expect(RECIPE_BROWSER_MVP_DEFERRED.timeBuckets).toContain("1_hour_plus");
  });
});
