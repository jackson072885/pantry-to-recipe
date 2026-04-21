import { describe, expect, it } from "vitest";

import {
  RECIPE_BROWSER_MVP_DEFERRED,
  RECIPE_BROWSER_MVP_FILTER_ORDER,
  RECIPE_BROWSER_MVP_FILTERS,
  RECIPE_BROWSER_MVP_INGREDIENT_GROUPS,
  deriveRecipeBrowserCuisinePath,
  getRecipeBrowserIngredientOptionsForBrowseNode,
  deriveRecipeBrowserTimeBucket,
  normalizeRecipeBrowserCleanupId,
  normalizeRecipeBrowserCostId,
  normalizeRecipeBrowserDietIds,
  normalizeRecipeBrowserHouseholdIds,
  normalizeRecipeBrowserIngredientToken,
  normalizeRecipeBrowserPrimaryProteinIngredient,
} from "./recipeBrowserMvp";
import { CANONICAL_INGREDIENTS, PROTEIN_BROWSE_NODES } from "./recipeTaxonomy";

describe("recipeBrowserMvp contract", () => {
  it("keeps the Phase 7 filter family order explicit", () => {
    expect(RECIPE_BROWSER_MVP_FILTER_ORDER.map((family) => family.id)).toEqual([
      "ingredients",
      "cuisine",
      "time",
      "difficulty",
      "method",
      "cleanup",
      "diet",
      "protein",
      "household",
      "cost",
    ]);
  });

  it("locks the shared family kinds and selection semantics", () => {
    expect(RECIPE_BROWSER_MVP_FILTERS.ingredients.label).toBe("Ingredients");
    expect(RECIPE_BROWSER_MVP_FILTERS.ingredients.kind).toBe("ingredient");
    expect(RECIPE_BROWSER_MVP_FILTERS.ingredients.selectionMode).toBe("and");
    expect(RECIPE_BROWSER_MVP_FILTERS.protein.kind).toBe("flat");
    expect(RECIPE_BROWSER_MVP_FILTERS.protein.selectionMode).toBe("or");
    expect(RECIPE_BROWSER_MVP_FILTERS.cuisine.kind).toBe("taxonomy");
    expect(RECIPE_BROWSER_MVP_FILTERS.cuisine.selectionMode).toBe("or");
    expect(RECIPE_BROWSER_MVP_FILTERS.cuisine.supportsHierarchy).toBe(true);
    expect(RECIPE_BROWSER_MVP_FILTERS.time.kind).toBe("flat");
    expect(RECIPE_BROWSER_MVP_FILTERS.method.selectionMode).toBe("or");
    expect(RECIPE_BROWSER_MVP_FILTERS.cleanup.kind).toBe("flat");
    expect(RECIPE_BROWSER_MVP_FILTERS.cleanup.selectionMode).toBe("or");
    expect(RECIPE_BROWSER_MVP_FILTERS.diet.kind).toBe("flat");
    expect(RECIPE_BROWSER_MVP_FILTERS.diet.selectionMode).toBe("or");
    expect(RECIPE_BROWSER_MVP_FILTERS.household.kind).toBe("flat");
    expect(RECIPE_BROWSER_MVP_FILTERS.household.selectionMode).toBe("or");
    expect(RECIPE_BROWSER_MVP_FILTERS.cost.kind).toBe("flat");
    expect(RECIPE_BROWSER_MVP_FILTERS.cost.selectionMode).toBe("or");
  });

  it("builds selectable ingredient options from canonical leaves while keeping browse groups separate", () => {
    expect(RECIPE_BROWSER_MVP_FILTERS.ingredients.options.map((option) => option.id)).toEqual(
      CANONICAL_INGREDIENTS.map((ingredient) => ingredient.id),
    );
    expect(RECIPE_BROWSER_MVP_FILTERS.protein.options.map((option) => option.id)).toEqual(
      PROTEIN_BROWSE_NODES.map((node) => node.id),
    );
    expect(RECIPE_BROWSER_MVP_INGREDIENT_GROUPS.map((group) => group.label)).toContain("Beans & legumes");
    expect(RECIPE_BROWSER_MVP_FILTERS.ingredients.options.map((option) => option.label)).toContain("garlic");
    expect(RECIPE_BROWSER_MVP_FILTERS.protein.options.map((option) => option.label)).toEqual([
      "Chicken & poultry",
      "Beef",
      "Pork",
      "Seafood",
      "Beans & legumes",
      "Tofu & plant protein",
      "Eggs",
    ]);
    expect(RECIPE_BROWSER_MVP_INGREDIENT_GROUPS.map((group) => group.label)).toContain("Aromatics");
    expect(getRecipeBrowserIngredientOptionsForBrowseNode("chicken").map((option) => option.label)).toEqual([
      "chicken",
      "chicken breast",
      "chicken thighs",
      "ground chicken",
      "turkey",
      "ground turkey",
    ]);
    expect(getRecipeBrowserIngredientOptionsForBrowseNode("seafood").map((option) => option.label)).toEqual([
      "seafood",
      "shrimp",
      "salmon",
      "tuna",
      "cod",
      "tilapia",
      "white fish",
    ]);
    expect(getRecipeBrowserIngredientOptionsForBrowseNode("dry_spices").map((option) => option.label)).toEqual([
      "salt",
      "black pepper",
      "garlic powder",
      "onion powder",
      "paprika",
      "smoked paprika",
      "chili powder",
      "cumin",
      "oregano",
      "curry powder",
      "red pepper flakes",
    ]);
    expect(getRecipeBrowserIngredientOptionsForBrowseNode("regional_sauces_pastes").map((option) => option.label)).toEqual([
      "salsa",
      "pesto",
      "marinara",
      "enchilada sauce",
      "miso",
      "salsa verde",
    ]);
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
    expect(RECIPE_BROWSER_MVP_FILTERS.cleanup.options.map((option) => option.id)).toEqual([
      "one_pan",
      "one_pot",
      "sheet_pan",
      "multi_pan",
    ]);
    expect(RECIPE_BROWSER_MVP_FILTERS.diet.options.map((option) => option.id)).toEqual(["vegetarian"]);
    expect(RECIPE_BROWSER_MVP_FILTERS.household.options.map((option) => option.id)).toEqual([
      "weeknight",
      "meal_prep",
      "kid_friendly",
    ]);
    expect(RECIPE_BROWSER_MVP_FILTERS.cost.options.map((option) => option.id)).toEqual(["budget", "moderate"]);
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
    expect(normalizeRecipeBrowserPrimaryProteinIngredient("tofu")).toBe("tofu");
    expect(normalizeRecipeBrowserPrimaryProteinIngredient("egg")).toBe("eggs");
  });

  it("normalizes supported ingredient and cuisine taxonomy tokens", () => {
    expect(normalizeRecipeBrowserIngredientToken("chicken breast")).toBe("chicken_breast");
    expect(normalizeRecipeBrowserIngredientToken("ground beef")).toBe("ground_beef");
    expect(normalizeRecipeBrowserIngredientToken("shrimp")).toBe("shrimp");
    expect(normalizeRecipeBrowserIngredientToken("lentils")).toBe("lentils");
    expect(normalizeRecipeBrowserIngredientToken("garbanzo beans")).toBe("chickpeas");
    expect(normalizeRecipeBrowserIngredientToken("mozzarella cheese")).toBe("mozzarella");
    expect(normalizeRecipeBrowserIngredientToken("plain yoghurt")).toBe("yogurt");
    expect(normalizeRecipeBrowserIngredientToken("heavy cream")).toBe("cream");
    expect(normalizeRecipeBrowserIngredientToken("half & half")).toBe("cream");
    expect(normalizeRecipeBrowserIngredientToken("canned tuna")).toBe("tuna");
    expect(normalizeRecipeBrowserIngredientToken("capsicum")).toBe("bell_peppers");
    expect(normalizeRecipeBrowserIngredientToken("coriander")).toBe("cilantro");
    expect(normalizeRecipeBrowserIngredientToken("marinara sauce")).toBe("marinara");
    expect(normalizeRecipeBrowserIngredientToken("red enchilada sauce")).toBe("enchilada_sauce");
    expect(normalizeRecipeBrowserIngredientToken("brown rice")).toBe("rice");
    expect(normalizeRecipeBrowserIngredientToken("white rice")).toBe("rice");
    expect(normalizeRecipeBrowserIngredientToken("spaghetti")).toBe("spaghetti");
    expect(normalizeRecipeBrowserIngredientToken("orzo")).toBe("pasta");
    expect(normalizeRecipeBrowserIngredientToken("tortellini")).toBe("pasta");
    expect(normalizeRecipeBrowserIngredientToken("udon")).toBe("noodles");
    expect(normalizeRecipeBrowserIngredientToken("rice noodles")).toBe("noodles");
    expect(normalizeRecipeBrowserIngredientToken("panko")).toBe("breadcrumbs");
    expect(normalizeRecipeBrowserIngredientToken("egg")).toBe("eggs");
    expect(deriveRecipeBrowserCuisinePath("latin")).toEqual(["latin"]);
    expect(deriveRecipeBrowserCuisinePath("cuban")).toEqual(["latin", "cuban"]);
    expect(deriveRecipeBrowserCuisinePath("tex_mex")).toEqual(["latin", "tex_mex"]);
    expect(deriveRecipeBrowserCuisinePath("tex mex")).toEqual(["latin", "tex_mex"]);
    expect(deriveRecipeBrowserCuisinePath("Tex-Mex")).toEqual(["latin", "tex_mex"]);
    expect(deriveRecipeBrowserCuisinePath("french")).toBeNull();
  });

  it("normalizes supported coarse cost tags", () => {
    expect(normalizeRecipeBrowserCostId(["budget"])).toBe("budget");
    expect(normalizeRecipeBrowserCostId(["budget-friendly"])).toBe("budget");
    expect(normalizeRecipeBrowserCostId(["moderate"])).toBe("moderate");
    expect(normalizeRecipeBrowserCostId(["premium"])).toBeNull();
    expect(normalizeRecipeBrowserCostId([])).toBeNull();
  });

  it("normalizes supported coarse cleanup tags", () => {
    expect(normalizeRecipeBrowserCleanupId(["one_pan"])).toBe("one_pan");
    expect(normalizeRecipeBrowserCleanupId(["one_pot"])).toBe("one_pot");
    expect(normalizeRecipeBrowserCleanupId(["sheet_pan"])).toBe("sheet_pan");
    expect(normalizeRecipeBrowserCleanupId(["multi_pan"])).toBe("multi_pan");
    expect(normalizeRecipeBrowserCleanupId(["low-cleanup"])).toBeNull();
    expect(normalizeRecipeBrowserCleanupId([])).toBeNull();
  });

  it("normalizes only explicit dataset-backed diet tags", () => {
    expect(normalizeRecipeBrowserDietIds(["vegetarian"])).toEqual(["vegetarian"]);
    expect(normalizeRecipeBrowserDietIds(["Vegetarian"])).toEqual(["vegetarian"]);
    expect(normalizeRecipeBrowserDietIds(["high_protein"])).toEqual([]);
    expect(normalizeRecipeBrowserDietIds(["vegan"])).toEqual([]);
    expect(normalizeRecipeBrowserDietIds([])).toEqual([]);
  });

  it("normalizes only explicit supported household signals", () => {
    expect(normalizeRecipeBrowserHouseholdIds(["weeknight"])).toEqual(["weeknight"]);
    expect(normalizeRecipeBrowserHouseholdIds(["meal_prep", "kid_friendly"])).toEqual([
      "meal_prep",
      "kid_friendly",
    ]);
    expect(normalizeRecipeBrowserHouseholdIds(["comfort_food"], true)).toEqual(["weeknight"]);
    expect(normalizeRecipeBrowserHouseholdIds(["comfort_food"])).toEqual([]);
    expect(normalizeRecipeBrowserHouseholdIds([])).toEqual([]);
  });

  it("keeps explicitly deferred browser ideas out of the Phase 7 contract", () => {
    expect(RECIPE_BROWSER_MVP_DEFERRED.ingredientTokens).toContain("vegetarian");
    expect(RECIPE_BROWSER_MVP_DEFERRED.methods).toContain("air_fryer");
    expect(RECIPE_BROWSER_MVP_DEFERRED.methods).toContain("sheet_pan");
    expect(RECIPE_BROWSER_MVP_DEFERRED.difficulties).toContain("advanced");
    expect(RECIPE_BROWSER_MVP_DEFERRED.timeBuckets).toContain("1_hour_plus");
  });
});
