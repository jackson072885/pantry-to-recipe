import { describe, expect, it } from "vitest";

import {
  RECIPE_BROWSER_MVP_DEFERRED,
  RECIPE_BROWSER_MVP_FILTER_ORDER,
  RECIPE_BROWSER_MVP_FILTERS,
  deriveRecipeBrowserCuisinePath,
  deriveRecipeBrowserTimeBucket,
  normalizeRecipeBrowserIngredientToken,
  normalizeRecipeBrowserPrimaryProteinIngredient,
} from "./recipeBrowserMvp";
import { INGREDIENT_BROWSE_NODES } from "./recipeTaxonomy";

describe("recipeBrowserMvp contract", () => {
  it("keeps the Phase 7 filter family order explicit", () => {
    expect(RECIPE_BROWSER_MVP_FILTER_ORDER.map((family) => family.id)).toEqual([
      "ingredients",
      "cuisine",
      "time",
      "difficulty",
      "method",
    ]);
  });

  it("locks the shared family kinds and selection semantics", () => {
    expect(RECIPE_BROWSER_MVP_FILTERS.ingredients.label).toBe("Ingredients");
    expect(RECIPE_BROWSER_MVP_FILTERS.ingredients.kind).toBe("ingredient");
    expect(RECIPE_BROWSER_MVP_FILTERS.ingredients.selectionMode).toBe("and");
    expect(RECIPE_BROWSER_MVP_FILTERS.cuisine.kind).toBe("taxonomy");
    expect(RECIPE_BROWSER_MVP_FILTERS.cuisine.selectionMode).toBe("or");
    expect(RECIPE_BROWSER_MVP_FILTERS.cuisine.supportsHierarchy).toBe(true);
    expect(RECIPE_BROWSER_MVP_FILTERS.time.kind).toBe("flat");
    expect(RECIPE_BROWSER_MVP_FILTERS.method.selectionMode).toBe("or");
  });

  it("builds the visible ingredient options from the shared browse-node taxonomy", () => {
    expect(RECIPE_BROWSER_MVP_FILTERS.ingredients.options.map((option) => option.id)).toEqual(
      INGREDIENT_BROWSE_NODES.filter((node) => node.visibleInBrowser).map((node) => node.id),
    );
    expect(RECIPE_BROWSER_MVP_FILTERS.ingredients.options.map((option) => option.label)).toContain("Beans & legumes");
    expect(RECIPE_BROWSER_MVP_FILTERS.ingredients.options.map((option) => option.label)).toContain("Aromatics");
    expect(RECIPE_BROWSER_MVP_FILTERS.cuisine.options.map((option) => option.id)).toEqual([
      "american",
      "asian",
      "bbq",
      "cuban",
      "indian",
      "italian",
      "latin",
      "mediterranean",
      "mexican",
      "southern",
      "tex_mex",
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

  it("normalizes transitional primary_protein values into ingredient tokens", () => {
    expect(normalizeRecipeBrowserPrimaryProteinIngredient("chicken")).toBe("chicken");
    expect(normalizeRecipeBrowserPrimaryProteinIngredient("chicken breast")).toBe("chicken");
    expect(normalizeRecipeBrowserPrimaryProteinIngredient("ground beef")).toBe("beef");
    expect(normalizeRecipeBrowserPrimaryProteinIngredient("sausage")).toBe("pork");
    expect(normalizeRecipeBrowserPrimaryProteinIngredient("salmon")).toBe("seafood");
    expect(normalizeRecipeBrowserPrimaryProteinIngredient("tofu")).toBe("tofu_plant_protein");
    expect(normalizeRecipeBrowserPrimaryProteinIngredient("egg")).toBe("eggs");
  });

  it("normalizes supported ingredient and cuisine taxonomy tokens", () => {
    expect(normalizeRecipeBrowserIngredientToken("chicken breast")).toBe("chicken");
    expect(normalizeRecipeBrowserIngredientToken("ground beef")).toBe("beef");
    expect(normalizeRecipeBrowserIngredientToken("shrimp")).toBe("seafood");
    expect(normalizeRecipeBrowserIngredientToken("lentils")).toBe("beans_legumes");
    expect(normalizeRecipeBrowserIngredientToken("spaghetti")).toBe("pasta_noodles");
    expect(normalizeRecipeBrowserIngredientToken("egg")).toBe("eggs");
    expect(deriveRecipeBrowserCuisinePath("latin")).toEqual(["latin"]);
    expect(deriveRecipeBrowserCuisinePath("cuban")).toEqual(["latin", "cuban"]);
    expect(deriveRecipeBrowserCuisinePath("tex_mex")).toEqual(["latin", "tex_mex"]);
    expect(deriveRecipeBrowserCuisinePath("tex mex")).toEqual(["latin", "tex_mex"]);
    expect(deriveRecipeBrowserCuisinePath("Tex-Mex")).toEqual(["latin", "tex_mex"]);
    expect(deriveRecipeBrowserCuisinePath("french")).toBeNull();
  });

  it("keeps explicitly deferred browser ideas out of the Phase 7 contract", () => {
    expect(RECIPE_BROWSER_MVP_DEFERRED.ingredientTokens).toContain("vegetarian");
    expect(RECIPE_BROWSER_MVP_DEFERRED.methods).toContain("air_fryer");
    expect(RECIPE_BROWSER_MVP_DEFERRED.methods).toContain("sheet_pan");
    expect(RECIPE_BROWSER_MVP_DEFERRED.difficulties).toContain("advanced");
    expect(RECIPE_BROWSER_MVP_DEFERRED.timeBuckets).toContain("1_hour_plus");
  });
});
