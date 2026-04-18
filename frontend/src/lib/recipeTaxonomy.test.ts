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
    expect(normalizeIngredientBrowseNodeId("canned tuna")).toBe("seafood");
    expect(normalizeIngredientBrowseNodeId("spring onions")).toBe("aromatics");
    expect(normalizeIngredientBrowseNodeId("garbanzo beans")).toBe("beans_legumes");
    expect(normalizeIngredientBrowseNodeId("capsicum")).toBe("peppers_chiles");
    expect(normalizeIngredientBrowseNodeId("salsa verde")).toBe("regional_sauces_pastes");
  });

  it("normalizes ingredient search terms into canonical ingredient ids", () => {
    expect(normalizeCanonicalIngredientId("garlic")).toBe("garlic");
    expect(normalizeCanonicalIngredientId("scallions")).toBe("green_onion");
    expect(normalizeCanonicalIngredientId("spring onion")).toBe("green_onion");
    expect(normalizeCanonicalIngredientId("beans")).toBe("beans");
    expect(normalizeCanonicalIngredientId("garbanzo beans")).toBe("chickpeas");
    expect(normalizeCanonicalIngredientId("coriander")).toBe("cilantro");
    expect(normalizeCanonicalIngredientId("mozzarella cheese")).toBe("mozzarella");
    expect(normalizeCanonicalIngredientId("plain yoghurt")).toBe("yogurt");
    expect(normalizeCanonicalIngredientId("white bean")).toBe("white_beans");
    expect(normalizeCanonicalIngredientId("tortilla")).toBeNull();
    expect(normalizeCanonicalIngredientId("italian seasoning")).toBe("oregano");
  });

  it("keeps normalized ingredient lookup terms unique across canonical leaves", () => {
    const ownerByNormalizedTerm = new Map<string, string>();

    for (const ingredient of CANONICAL_INGREDIENTS) {
      const lookupTerms = [ingredient.id, ingredient.label, ...ingredient.aliases]
        .map((value) => value.trim().toLowerCase().replace(/-/g, " ").replace(/_/g, " ").replace(/\s+/g, " "))
        .filter(Boolean);

      for (const lookupTerm of lookupTerms) {
        const existingOwner = ownerByNormalizedTerm.get(lookupTerm);
        expect(existingOwner ?? ingredient.id).toBe(ingredient.id);
        ownerByNormalizedTerm.set(lookupTerm, ingredient.id);
      }
    }
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
    expect(searchIngredientBrowseNodes("garbanzo")).toContainEqual(
      expect.objectContaining({ label: "chickpeas", browseNodeLabel: "Beans & legumes", matchedOn: "alias" }),
    );
    expect(searchIngredientBrowseNodes("mozzarella")).toContainEqual(
      expect.objectContaining({ label: "mozzarella", browseNodeLabel: "Cheese" }),
    );
    expect(searchIngredientBrowseNodes("sesame")).toContainEqual(
      expect.objectContaining({ label: "sesame oil", browseNodeLabel: "Oils & fats" }),
    );
    expect(searchIngredientBrowseNodes("salsa verde")).toContainEqual(
      expect.objectContaining({ label: "salsa verde", browseNodeLabel: "Regional sauces & pastes" }),
    );
    expect(searchIngredientBrowseNodes("spaghetti")).toContainEqual(
      expect.objectContaining({ label: "spaghetti", browseNodeLabel: "Pasta & noodles" }),
    );
  });

  it("keeps representative ingredients assigned to sensible browse groups", () => {
    expect(CANONICAL_INGREDIENTS.find((ingredient) => ingredient.id === "mozzarella")?.browseNodeIds).toEqual([
      "cheese",
    ]);
    expect(CANONICAL_INGREDIENTS.find((ingredient) => ingredient.id === "chickpeas")?.browseNodeIds).toEqual([
      "beans_legumes",
    ]);
    expect(CANONICAL_INGREDIENTS.find((ingredient) => ingredient.id === "salsa")?.browseNodeIds).toEqual([
      "regional_sauces_pastes",
    ]);
    expect(CANONICAL_INGREDIENTS.find((ingredient) => ingredient.id === "green_onion")?.browseNodeIds).toEqual([
      "aromatics",
    ]);
  });
});
