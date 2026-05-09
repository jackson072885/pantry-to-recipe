import { describe, expect, it } from "vitest";

import {
  CANONICAL_INGREDIENTS,
  INGREDIENT_BROWSE_FAMILY_GROUPS,
  INGREDIENT_BROWSE_NODES,
  QUICK_START_ITEMS_FROM_TAXONOMY,
  QUICK_START_SECTIONS_FROM_TAXONOMY,
  RECIPE_BROWSER_FILTER_FAMILY_REGISTRY,
  normalizeCanonicalIngredientId,
  normalizeIngredientBrowseNodeId,
  searchIngredientBrowseNodes,
} from "./recipeTaxonomy";
import {
  GENERATED_CANONICAL_INGREDIENTS,
  GENERATED_INGREDIENT_BROWSE_FAMILY_GROUPS,
  GENERATED_INGREDIENT_BROWSE_NODES,
} from "./generatedIngredientTaxonomy";

describe("recipeTaxonomy", () => {
  it("uses the generated catalog adapter as the ingredient taxonomy source", () => {
    expect(INGREDIENT_BROWSE_NODES).toBe(GENERATED_INGREDIENT_BROWSE_NODES);
    expect(INGREDIENT_BROWSE_FAMILY_GROUPS).toBe(GENERATED_INGREDIENT_BROWSE_FAMILY_GROUPS);
    expect(CANONICAL_INGREDIENTS).toBe(GENERATED_CANONICAL_INGREDIENTS);
  });

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
    expect(normalizeIngredientBrowseNodeId("chicken stock")).toBe("sauces");
    expect(normalizeIngredientBrowseNodeId("marinara sauce")).toBe("regional_sauces_pastes");
    expect(normalizeIngredientBrowseNodeId("red enchilada sauce")).toBe("regional_sauces_pastes");
    expect(normalizeIngredientBrowseNodeId("canned tuna")).toBe("seafood");
    expect(normalizeIngredientBrowseNodeId("beef strips")).toBe("beef");
    expect(normalizeIngredientBrowseNodeId("steak strip")).toBe("beef");
    expect(normalizeIngredientBrowseNodeId("spring onions")).toBe("aromatics");
    expect(normalizeIngredientBrowseNodeId("garbanzo beans")).toBe("beans_legumes");
    expect(normalizeIngredientBrowseNodeId("capsicum")).toBe("peppers_chiles");
    expect(normalizeIngredientBrowseNodeId("veggie broth")).toBe("sauces");
    expect(normalizeIngredientBrowseNodeId("catfish")).toBe("seafood");
    expect(normalizeIngredientBrowseNodeId("salsa verde")).toBe("regional_sauces_pastes");
  });

  it("normalizes ingredient search terms into canonical ingredient ids", () => {
    expect(normalizeCanonicalIngredientId("garlic")).toBe("garlic");
    expect(normalizeCanonicalIngredientId("scallions")).toBe("green_onion");
    expect(normalizeCanonicalIngredientId("spring onion")).toBe("green_onion");
    expect(normalizeCanonicalIngredientId("beans")).toBe("beans");
    expect(normalizeCanonicalIngredientId("garbanzo beans")).toBe("chickpeas");
    expect(normalizeCanonicalIngredientId("coriander")).toBe("coriander");
    expect(normalizeCanonicalIngredientId("mozzarella cheese")).toBe("mozzarella");
    expect(normalizeCanonicalIngredientId("plain yoghurt")).toBe("yogurt");
    expect(normalizeCanonicalIngredientId("white bean")).toBe("white_beans");
    expect(normalizeCanonicalIngredientId("brown rice")).toBe("brown_rice");
    expect(normalizeCanonicalIngredientId("white rice")).toBe("rice");
    expect(normalizeCanonicalIngredientId("rice noodle")).toBe("rice_noodles");
    expect(normalizeCanonicalIngredientId("rice noodles")).toBe("rice_noodles");
    expect(normalizeCanonicalIngredientId("udon noodles")).toBe("udon_noodles");
    expect(normalizeCanonicalIngredientId("veggie broth")).toBe("vegetable_broth");
    expect(normalizeCanonicalIngredientId("catfish")).toBe("catfish");
    expect(normalizeCanonicalIngredientId("bass")).toBe("white_fish");
    expect(normalizeCanonicalIngredientId("panko")).toBe("breadcrumbs");
    expect(normalizeCanonicalIngredientId("marinara sauce")).toBe("marinara");
    expect(normalizeCanonicalIngredientId("red enchilada sauce")).toBe("enchilada_sauce");
    expect(normalizeCanonicalIngredientId("chicken stock")).toBe("chicken_broth");
    expect(normalizeCanonicalIngredientId("thinly sliced steak")).toBe("steak");
    expect(normalizeCanonicalIngredientId("worcestershire")).toBe("worcestershire_sauce");
    expect(normalizeCanonicalIngredientId("bell pepper")).toBe("bell_peppers");
    expect(normalizeCanonicalIngredientId("capsicum")).toBe("bell_peppers");
    expect(normalizeCanonicalIngredientId("tortilla")).toBeNull();
    expect(normalizeCanonicalIngredientId("italian seasoning")).toBe("italian_seasoning");
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
    expect(Object.fromEntries(QUICK_START_SECTIONS_FROM_TAXONOMY.map((section) => [section.title, section.defaultItems]))).toEqual({
      Proteins: ["chicken", "ground beef", "eggs"],
      "Grains & Starches": ["rice", "pasta", "bread"],
      "Dairy & Creamy": ["milk", "butter", "cheese"],
      Vegetables: ["onion", "tomato", "spinach"],
      "Herbs & Spices": ["salt", "black pepper", "garlic powder"],
      "Sauces & Condiments": ["oil", "soy sauce", "tomato sauce"],
    });
    for (const section of QUICK_START_SECTIONS_FROM_TAXONOMY) {
      expect(section.defaultItems.every((item) => section.allItems.includes(item))).toBe(true);
    }
    expect(QUICK_START_ITEMS_FROM_TAXONOMY).toEqual(
      Array.from(new Set(QUICK_START_SECTIONS_FROM_TAXONOMY.flatMap((section) => section.allItems))),
    );
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
    expect(searchIngredientBrowseNodes("chicken broth")).toContainEqual(
      expect.objectContaining({ label: "chicken broth", browseNodeLabel: "Sauces" }),
    );
    expect(searchIngredientBrowseNodes("worcestershire")).toContainEqual(
      expect.objectContaining({ label: "worcestershire sauce", browseNodeLabel: "Sauces" }),
    );
    expect(searchIngredientBrowseNodes("marinara")).toContainEqual(
      expect.objectContaining({ label: "marinara", browseNodeLabel: "Regional sauces & pastes" }),
    );
    expect(searchIngredientBrowseNodes("salsa verde")).toContainEqual(
      expect.objectContaining({ label: "salsa verde", browseNodeLabel: "Regional sauces & pastes" }),
    );
    expect(searchIngredientBrowseNodes("spaghetti")).toContainEqual(
      expect.objectContaining({ label: "spaghetti", browseNodeLabel: "Pasta & noodles" }),
    );
    expect(searchIngredientBrowseNodes("orzo")).toContainEqual(
      expect.objectContaining({ label: "orzo", browseNodeLabel: "Pasta & noodles", matchedOn: "canonical" }),
    );
    expect(searchIngredientBrowseNodes("brown rice")).toContainEqual(
      expect.objectContaining({ label: "brown rice", browseNodeLabel: "Rice & grains", matchedOn: "canonical" }),
    );
    expect(searchIngredientBrowseNodes("veggie broth")).toContainEqual(
      expect.objectContaining({ label: "vegetable broth", browseNodeLabel: "Sauces", matchedOn: "alias" }),
    );
    expect(searchIngredientBrowseNodes("rice noodles")).toContainEqual(
      expect.objectContaining({ label: "rice noodles", browseNodeLabel: "Pasta & noodles", matchedOn: "canonical" }),
    );
    expect(searchIngredientBrowseNodes("rice noodle")).toContainEqual(
      expect.objectContaining({ label: "rice noodles", browseNodeLabel: "Pasta & noodles", matchedOn: "alias" }),
    );
    expect(searchIngredientBrowseNodes("udon noodles")).toContainEqual(
      expect.objectContaining({ label: "udon noodles", browseNodeLabel: "Pasta & noodles", matchedOn: "canonical" }),
    );
    expect(searchIngredientBrowseNodes("panko")).toContainEqual(
      expect.objectContaining({ label: "breadcrumbs", browseNodeLabel: "Bread & wraps", matchedOn: "alias" }),
    );
    expect(searchIngredientBrowseNodes("catfish")).toContainEqual(
      expect.objectContaining({ label: "catfish", browseNodeLabel: "Seafood", matchedOn: "canonical" }),
    );
    expect(searchIngredientBrowseNodes("bass")).toContainEqual(
      expect.objectContaining({ label: "white fish", browseNodeLabel: "Seafood", matchedOn: "alias" }),
    );
    expect(searchIngredientBrowseNodes("spring onion")).toContainEqual(
      expect.objectContaining({ label: "green onion", browseNodeLabel: "Aromatics", matchedOn: "alias" }),
    );
    expect(searchIngredientBrowseNodes("plain yoghurt")).toContainEqual(
      expect.objectContaining({ label: "yogurt", browseNodeLabel: "Milk / cream", matchedOn: "alias" }),
    );
  });

  it("keeps proteins inside the Ingredients hierarchy instead of a top-level Browser tab", () => {
    expect(RECIPE_BROWSER_FILTER_FAMILY_REGISTRY.map((family) => family.id)).not.toContain("protein");
    expect(INGREDIENT_BROWSE_FAMILY_GROUPS.find((family) => family.id === "proteins")?.nodeIds).toEqual([
      "chicken",
      "beef",
      "pork",
      "seafood",
      "eggs",
    ]);
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
    expect(CANONICAL_INGREDIENTS.find((ingredient) => ingredient.id === "vinegar")?.visibility).toBe("search_only");
    expect(CANONICAL_INGREDIENTS.find((ingredient) => ingredient.id === "chicken_broth")?.visibility).toBe("search_only");
    expect(CANONICAL_INGREDIENTS.find((ingredient) => ingredient.id === "peanut_butter")?.visibility).toBe("search_only");
    expect(CANONICAL_INGREDIENTS.find((ingredient) => ingredient.id === "bell_peppers")).toEqual(
      expect.objectContaining({ catalogId: "bell_pepper", label: "bell peppers" }),
    );
    expect(CANONICAL_INGREDIENTS.find((ingredient) => ingredient.id === "marinara")?.browseNodeIds).toEqual([
      "regional_sauces_pastes",
    ]);
    expect(CANONICAL_INGREDIENTS.find((ingredient) => ingredient.id === "green_onion")?.browseNodeIds).toEqual([
      "aromatics",
    ]);
  });
});
