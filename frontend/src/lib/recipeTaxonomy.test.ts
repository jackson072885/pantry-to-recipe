import { describe, expect, it } from "vitest";

import {
  CANONICAL_INGREDIENTS,
  INGREDIENT_BROWSE_NODES,
  QUICK_START_SECTIONS_FROM_TAXONOMY,
  normalizeCanonicalIngredientId,
  normalizeIngredientBrowseNodeId,
  searchIngredientBrowseNodes,
} from "./recipeTaxonomy";

describe("recipeTaxonomy", () => {
  it("keeps browse nodes, canonical ingredients, and rollups as distinct layers", () => {
    expect(INGREDIENT_BROWSE_NODES.find((node) => node.id === "beans_legumes")?.label).toBe("Beans & legumes");
    expect(CANONICAL_INGREDIENTS.find((ingredient) => ingredient.id === "lentils")?.browseNodeIds).toEqual([
      "beans_legumes",
    ]);
    expect(CANONICAL_INGREDIENTS.find((ingredient) => ingredient.id === "lentils")?.recommendationRollupIds).toEqual([
      "plant_protein",
    ]);
  });

  it("normalizes canonical ingredients and aliases into browse-node ids", () => {
    expect(normalizeIngredientBrowseNodeId("lentils")).toBe("beans_legumes");
    expect(normalizeIngredientBrowseNodeId("garlic")).toBe("aromatics");
    expect(normalizeIngredientBrowseNodeId("spaghetti")).toBe("pasta_noodles");
    expect(normalizeIngredientBrowseNodeId("soy sauce")).toBe("sauces");
  });

  it("normalizes ingredient search terms into canonical ingredient ids", () => {
    expect(normalizeCanonicalIngredientId("garlic")).toBe("garlic");
    expect(normalizeCanonicalIngredientId("scallions")).toBe("green_onion");
    expect(normalizeCanonicalIngredientId("tortilla")).toBe("flour_tortillas");
    expect(normalizeCanonicalIngredientId("italian seasoning")).toBe("oregano");
  });

  it("builds onboarding quick-start sections from the shared taxonomy", () => {
    expect(QUICK_START_SECTIONS_FROM_TAXONOMY.map((section) => section.title)).toEqual([
      "Proteins",
      "Grains & Starches",
      "Dairy & Creamy",
      "Vegetables",
      "Herbs & Spices",
      "Sauces & Condiments",
    ]);
    expect(QUICK_START_SECTIONS_FROM_TAXONOMY.find((section) => section.title === "Proteins")?.defaultItems).toEqual([
      "chicken",
      "ground beef",
      "eggs",
    ]);
  });

  it("searches visible ingredient browse nodes by node label, canonical ingredient, and alias while returning leaf ingredients", () => {
    expect(searchIngredientBrowseNodes("garlic")).toContainEqual(
      expect.objectContaining({ label: "garlic", browseNodeLabel: "Aromatics" }),
    );
    expect(searchIngredientBrowseNodes("lentil")).toContainEqual(
      expect.objectContaining({ label: "lentils", browseNodeLabel: "Beans & legumes" }),
    );
    expect(searchIngredientBrowseNodes("spaghetti")).toContainEqual(
      expect.objectContaining({ label: "spaghetti", browseNodeLabel: "Pasta & noodles" }),
    );
  });
});
