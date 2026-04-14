// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { RECIPE_BROWSER_MVP_FILTERS } from "../lib/recipeBrowserMvp";
import type { PantryItem, RecommendationEntry, RecommendationsResponse, RecipeBrowserCatalog, RecipeDetail } from "../lib/mvpApi";
import { RECIPE_BROWSER_FILTER_FAMILY_REGISTRY, RECIPE_BROWSER_SCOPE_OPTIONS } from "../lib/recipeTaxonomy";

const { fetchPantryMock, fetchRecipeBrowserCatalogMock, fetchRecommendationsMock } = vi.hoisted(() => ({
  fetchPantryMock: vi.fn<() => Promise<{ items: PantryItem[] }>>(),
  fetchRecipeBrowserCatalogMock: vi.fn<() => Promise<RecipeBrowserCatalog>>(),
  fetchRecommendationsMock: vi.fn<() => Promise<RecommendationsResponse>>(),
}));

vi.mock("../lib/mvpApi", async () => {
  const actual = await vi.importActual<typeof import("../lib/mvpApi")>("../lib/mvpApi");
  return {
    ...actual,
    fetchPantry: fetchPantryMock,
    fetchRecipeBrowserCatalog: fetchRecipeBrowserCatalogMock,
    fetchRecommendations: fetchRecommendationsMock,
  };
});

function makeRecipe(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: 1,
    name: "Italian Chicken Skillet",
    short_description: "A fast skillet dinner.",
    cuisine: "italian",
    primary_protein: "chicken",
    difficulty: "easy",
    meal_type: "dinner",
    cook_method: "skillet",
    prep_time_minutes: 10,
    cook_time_minutes: 15,
    total_time_minutes: 25,
    oven_temp_f: null,
    air_fryer_temp_f: null,
    servings: 4,
    instructions: "Cook and serve.",
    quality_score: 90,
    quality_bucket: "KEEP_AS_IS",
    review_status: "approved",
    is_weeknight_friendly: true,
    is_beginner_friendly: true,
    equipment: [],
    tips: [],
    substitutions: [],
    warnings: [],
    storage: [],
    tags: [],
    readiness: {
      can_cook_now: false,
      required_ready_count: 0,
      required_count: 3,
      missing_required_ingredients: [],
      missing_optional_ingredients: [],
      required_quantity_confirmation_ingredients: [],
      optional_quantity_confirmation_ingredients: [],
    },
    ingredients: [
      {
        ingredient_id: 1,
        ingredient_name: "chicken",
        is_required: true,
        measurement_is_estimated: false,
      },
      {
        ingredient_id: 2,
        ingredient_name: "garlic",
        is_required: true,
        measurement_is_estimated: false,
      },
      {
        ingredient_id: 3,
        ingredient_name: "pasta",
        is_required: true,
        measurement_is_estimated: false,
      },
    ],
    steps: [],
    ...overrides,
  };
}

function makeRecommendationEntry(
  recipeId: number,
  recipeName: string,
  recommendationType: "cook_now" | "almost_there" | "not_worth_it",
  missingCount: number,
  pantryCoveragePct: number,
): RecommendationEntry {
  return {
    recipe: {
      recipe_id: recipeId,
      recipe_name: recipeName,
      short_description: null,
      difficulty: "easy",
      pantry_coverage_pct: pantryCoveragePct,
      missing_count: missingCount,
      missing_ingredients: missingCount === 0 ? [] : ["salt"],
      estimated_time_minutes: 25,
      servings: 4,
      required_count: 4,
      present_required_count: 4 - missingCount,
      recommendation_type: recommendationType,
    },
    explanation: "Pantry truth explanation.",
    recommendation_type: recommendationType,
    missing: {
      count: missingCount,
      ingredients: missingCount === 0 ? [] : ["salt"],
      summary: missingCount === 0 ? "No missing ingredients." : `Missing ${missingCount} ingredient${missingCount === 1 ? "" : "s"}.`,
    },
    cta: {
      type: missingCount === 0 ? "cook_recipe" : "shop_missing_ingredients",
      label: "Open recipe",
      pantry_ready: missingCount === 0,
      internal_path: `/recipes/${recipeId}`,
      affiliate_query: "",
      missing_count: missingCount,
      missing_ingredients: missingCount === 0 ? [] : ["salt"],
    },
    tonight_score: 0.8,
  };
}

function makeCatalog(recipes: RecipeDetail[], overrides: Partial<RecipeBrowserCatalog> = {}): RecipeBrowserCatalog {
  return {
    recipes,
    failedRecipeCount: 0,
    totalRecipeCount: recipes.length,
    ...overrides,
  };
}

function click(element: Element | null | undefined) {
  if (!element) {
    throw new Error("Expected element to exist before clicking.");
  }

  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function changeInputValue(element: HTMLInputElement | null | undefined, value: string) {
  if (!element) {
    throw new Error("Expected input to exist before changing it.");
  }

  act(() => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("Recipe Browser filter UI", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchPantryMock.mockReset();
    fetchRecipeBrowserCatalogMock.mockReset();
    fetchRecommendationsMock.mockReset();
    fetchPantryMock.mockResolvedValue({
      items: [
        { ingredient: "chicken" },
        { ingredient: "garlic" },
        { ingredient: "pasta" },
      ],
    });
    fetchRecipeBrowserCatalogMock.mockResolvedValue(makeCatalog([
      makeRecipe({
        id: 2,
        name: "American Beef Soup",
        short_description: "A stovetop soup.",
        cuisine: "american",
        primary_protein: "beef",
        difficulty: "medium",
        cook_method: "stovetop",
        total_time_minutes: 40,
        tags: ["moderate"],
        ingredients: [
          {
            ingredient_id: 4,
            ingredient_name: "beef",
            is_required: true,
            measurement_is_estimated: false,
          },
          {
            ingredient_id: 5,
            ingredient_name: "garlic",
            is_required: true,
            measurement_is_estimated: false,
          },
        ],
      }),
      makeRecipe({
        tags: ["budget"],
      }),
      makeRecipe({
        id: 3,
        name: "Cuban Garlic Tofu Bake",
        short_description: "An oven-baked tofu dinner.",
        cuisine: "cuban",
        primary_protein: "tofu",
        difficulty: "medium",
        cook_method: "oven",
        total_time_minutes: 50,
        tags: ["budget"],
        ingredients: [
          {
            ingredient_id: 6,
            ingredient_name: "tofu",
            is_required: true,
            measurement_is_estimated: false,
          },
          {
            ingredient_id: 7,
            ingredient_name: "garlic",
            is_required: true,
            measurement_is_estimated: false,
          },
          {
            ingredient_id: 8,
            ingredient_name: "cumin",
            is_required: true,
            measurement_is_estimated: false,
          },
        ],
      }),
      makeRecipe({
        id: 4,
        name: "Unsupported Egg Recipe",
        short_description: "Unsupported metadata should fail closed.",
        cuisine: "french",
        primary_protein: "egg",
        difficulty: "advanced",
        cook_method: "air_fryer",
        total_time_minutes: null,
        tags: ["premium"],
        ingredients: [
          {
            ingredient_id: 9,
            ingredient_name: "egg",
            is_required: true,
            measurement_is_estimated: false,
          },
        ],
      }),
    ]));
    fetchRecommendationsMock.mockResolvedValue({
      best_tonight: makeRecommendationEntry(2, "American Beef Soup", "cook_now", 0, 100),
      alternatives: [],
      closest_options: [],
      cook_now: [makeRecommendationEntry(2, "American Beef Soup", "cook_now", 0, 100)],
      almost_there: [makeRecommendationEntry(1, "Italian Chicken Skillet", "almost_there", 1, 82)],
      not_worth_it: [
        makeRecommendationEntry(3, "Cuban Garlic Tofu Bake", "not_worth_it", 3, 44),
        makeRecommendationEntry(4, "Unsupported Egg Recipe", "not_worth_it", 4, 28),
      ],
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function renderRecipeBrowser() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/recipe-browser"]}>
          <App />
        </MemoryRouter>,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function getTab(label: string) {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (button) => button.textContent?.trim().startsWith(label),
    );
  }

  function getChip(label: string) {
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-filter-chip")).find((button) =>
      button.textContent?.includes(label),
    );
  }

  function getScopeChip(label: string) {
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-scope-chip")).find((button) =>
      button.textContent?.includes(label),
    );
  }

  function getSearchInput() {
    return container.querySelector<HTMLInputElement>('input[type="search"]');
  }

  function getSearchResult(label: string) {
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-search-result")).find((button) =>
      button.textContent?.includes(label),
    );
  }

  function getActiveFilterChip(label: string) {
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-active-filter-chip")).find((button) =>
      button.textContent?.includes(label),
    );
  }

  function getRecoveryAction(label: string) {
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-empty-state-action")).find((button) =>
      button.textContent?.includes(label),
    );
  }

  function getActiveFilterPanel() {
    const panel = container.querySelector<HTMLElement>(".browser-filter-panel");
    if (!panel) {
      throw new Error("Expected active filter panel to exist.");
    }
    return panel;
  }

  function getResultTitles() {
    return Array.from(container.querySelectorAll<HTMLElement>(".results-card h3")).map((heading) =>
      heading.textContent?.trim(),
    );
  }

  function getResultCard(title: string) {
    return Array.from(container.querySelectorAll<HTMLElement>(".results-card")).find((card) =>
      card.querySelector("h3")?.textContent?.includes(title),
    );
  }

  it("renders the rebuilt search, scope, and family structure from shared config and defaults to the ingredients panel", async () => {
    await renderRecipeBrowser();

    expect(container.textContent).toContain("Recipe Browser");
    expect(container.textContent).toContain("Sorted by: Best Pantry Match");
    expect(container.textContent).toContain("4 eligible recipes");
    expect(container.textContent).toContain(
      "Filters decide eligibility first. Pantry-aware ranking only reorders recipes that already match the current filter stack.",
    );

    expect(container.textContent).toContain("Direct ingredient search");
    expect(container.textContent).toContain(
      "Search the Ingredients filter taxonomy by browse node, ingredient, or alias.",
    );
    expect(getSearchInput()?.getAttribute("placeholder")).toBe("Search ingredient filters like garlic or spaghetti");

    const scopeButtons = Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-scope-chip"));
    expect(scopeButtons).toHaveLength(RECIPE_BROWSER_SCOPE_OPTIONS.length);
    expect(scopeButtons.map((button) => button.textContent?.trim()?.replace(/\d+|Locked/g, "").trim())).toEqual(
      RECIPE_BROWSER_SCOPE_OPTIONS.map((scope) => scope.label),
    );
    expect(getScopeChip("Explore All")?.getAttribute("aria-pressed")).toBe("true");

    const tabButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabButtons).toHaveLength(RECIPE_BROWSER_FILTER_FAMILY_REGISTRY.length);
    expect(tabButtons.map((button) => button.textContent?.trim())).toEqual(
      RECIPE_BROWSER_FILTER_FAMILY_REGISTRY.map((family) => {
        const suffix = family.enabled ? "" : "Later";
        return `${family.label}${suffix}`;
      }),
    );

    expect(getTab("Ingredients")?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Now browsingIngredients");
    expect(getActiveFilterPanel().textContent).toContain(
      "Ingredient bubbles stack with AND inside Ingredients",
    );

    expect(getActiveFilterPanel().textContent).toContain(RECIPE_BROWSER_MVP_FILTERS.ingredients.options[0].label);
    expect(getActiveFilterPanel().textContent).not.toContain(RECIPE_BROWSER_MVP_FILTERS.cuisine.options[0].label);
  });

  it("renders real Cost options from supported recipe metadata instead of a placeholder", async () => {
    await renderRecipeBrowser();

    click(getTab("Cost"));

    expect(getTab("Cost")?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Now browsingCost");
    expect(container.textContent).toContain(
      "Cost bubbles use OR inside this family and only reflect the recipe's current coarse cost tag, not precise pricing or budget math.",
    );
    expect(container.textContent).toContain("Budget");
    expect(container.textContent).toContain("Moderate");
    expect(container.textContent).toContain(
      "Cost",
    );
  });

  it("switches tabs and renders only the active family bubble set", async () => {
    await renderRecipeBrowser();

    click(getTab("Cuisine"));

    expect(getTab("Cuisine")?.getAttribute("aria-selected")).toBe("true");
    expect(getTab("Ingredients")?.getAttribute("aria-selected")).toBe("false");
    expect(container.textContent).toContain("Now browsingCuisine");
    expect(container.textContent).toContain("Cuisine bubbles use OR inside this family");
    expect(container.textContent).toContain(RECIPE_BROWSER_MVP_FILTERS.cuisine.options[0].label);
    expect(container.querySelector(".browser-filter-chip")?.textContent).not.toContain(
      RECIPE_BROWSER_MVP_FILTERS.ingredients.options[0].label,
    );
  });

  it("renders real Protein browse options from the shared taxonomy instead of a placeholder", async () => {
    await renderRecipeBrowser();

    click(getTab("Protein"));

    expect(getTab("Protein")?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Now browsingProtein");
    expect(container.textContent).toContain(
      "Protein bubbles use OR inside this family and reflect the recipe's current protein browse-node mapping, not a deeper nutrition or diet model.",
    );
    expect(container.textContent).toContain("Chicken");
    expect(container.textContent).toContain("Beans & legumes");
    expect(container.textContent).toContain("Tofu & plant protein");
    expect(container.textContent).not.toContain("Protein filters are not wired yet");
  });

  it("selects and deselects bubbles with active filters shown separately", async () => {
    await renderRecipeBrowser();

    const chickenChip = getChip("Chicken");
    click(chickenChip);

    expect(chickenChip?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Current selections");
    expect(container.textContent).toContain("IngredientsChicken");

    click(chickenChip);

    expect(chickenChip?.getAttribute("aria-pressed")).toBe("false");
    expect(container.textContent).toContain("Active Filters");
    expect(container.textContent).not.toContain("Current selections");
  });

  it("preserves selections across tab changes", async () => {
    await renderRecipeBrowser();

    click(getChip("Chicken"));
    click(getTab("Cuisine"));
    click(getChip("Italian"));
    click(getTab("Ingredients"));

    expect(getChip("Chicken")?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("IngredientsChicken");
    expect(container.textContent).toContain("CuisineItalian");
  });

  it("filters the live result set when a Protein option is selected", async () => {
    await renderRecipeBrowser();

    click(getTab("Protein"));
    click(getChip("Tofu & plant protein"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).not.toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(container.textContent).toContain("ProteinTofu & plant protein");
  });

  it("keeps Protein filters working alongside existing family filters", async () => {
    await renderRecipeBrowser();

    click(getTab("Protein"));
    click(getChip("Chicken"));
    click(getTab("Method"));
    click(getChip("Skillet"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(container.textContent).not.toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).toContain("ProteinChicken");
    expect(container.textContent).toContain("MethodSkillet");
  });

  it("updates the active filter strip cleanly when Protein filters are added and removed", async () => {
    await renderRecipeBrowser();

    click(getTab("Protein"));
    click(getChip("Seafood"));

    expect(container.textContent).toContain("ProteinSeafood");

    click(getActiveFilterChip("Seafood"));

    expect(container.textContent).not.toContain("ProteinSeafood");
    click(getTab("Protein"));
    expect(getChip("Seafood")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("filters the live result set when a Cost option is selected", async () => {
    await renderRecipeBrowser();

    click(getTab("Cost"));
    click(getChip("Moderate"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("American Beef Soup");
    expect(container.textContent).not.toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).toContain("CostModerate");
  });

  it("keeps Cost filters working alongside existing family filters", async () => {
    await renderRecipeBrowser();

    click(getTab("Cost"));
    click(getChip("Budget"));
    click(getTab("Cuisine"));
    click(getChip("Italian"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(container.textContent).not.toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).toContain("CostBudget");
    expect(container.textContent).toContain("CuisineItalian");
  });

  it("updates the active filter strip cleanly when Cost filters are added and removed", async () => {
    await renderRecipeBrowser();

    click(getTab("Cost"));
    click(getChip("Budget"));

    expect(container.textContent).toContain("CostBudget");

    click(getActiveFilterChip("Budget"));

    expect(container.textContent).not.toContain("CostBudget");
    click(getTab("Cost"));
    expect(getChip("Budget")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps the unfiltered browser results visible before any filters are selected", async () => {
    await renderRecipeBrowser();

    expect(getResultTitles()).toEqual([
      "American Beef Soup",
      "Italian Chicken Skillet",
      "Cuban Garlic Tofu Bake",
      "Unsupported Egg Recipe",
    ]);
    expect(container.textContent).toContain("4 eligible recipes");
  });

  it("applies pantry-fit scopes on top of the current live result set", async () => {
    await renderRecipeBrowser();

    click(getScopeChip("Cook Now"));

    expect(getScopeChip("Cook Now")?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("1 recipe in Cook Now");
    expect(container.textContent).toContain("American Beef Soup");
    expect(container.textContent).not.toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("Cuban Garlic Tofu Bake");
  });

  it("keeps pantry-aware ranking inside the eligible result set after taxonomy filtering", async () => {
    await renderRecipeBrowser();

    click(getTab("Cuisine"));
    click(getChip("Italian"));
    click(getChip("American"));

    expect(getResultTitles()).toEqual(["American Beef Soup", "Italian Chicken Skillet"]);
    expect(container.textContent).toContain("Cook Now");
    expect(container.textContent).toContain("Almost There");
    expect(container.textContent).toContain("100% pantry match");
    expect(container.textContent).toContain("82% pantry match");
    expect(container.textContent).toContain("2 eligible recipes");
  });

  it("renders stronger decision-support details on result cards with honest pantry-fit wording", async () => {
    await renderRecipeBrowser();

    const cookNowCard = getResultCard("American Beef Soup");
    const almostThereCard = getResultCard("Italian Chicken Skillet");

    expect(cookNowCard?.textContent).toContain("Cook now with what you have");
    expect(cookNowCard?.textContent).toContain("Coverage: Saved pantry covers 100% of required ingredients");
    expect(cookNowCard?.textContent).toContain("Missing: Nothing missing from required ingredients");
    expect(cookNowCard?.textContent).toContain(
      "Why it matches: Showing because it stays eligible in the current browser view and can still be ranked against your saved pantry.",
    );

    expect(almostThereCard?.textContent).toContain("Almost there - missing 1 ingredient");
    expect(almostThereCard?.textContent).toContain("Coverage: Saved pantry covers 82% of required ingredients");
    expect(almostThereCard?.textContent).toContain("Missing: Missing 1 required ingredient");
    expect(almostThereCard?.textContent).toContain("25 min");
    expect(almostThereCard?.textContent).toContain("Italian cuisine");
    expect(almostThereCard?.textContent).toContain("Easy effort");
  });

  it("keeps scope-based pantry-fit wording honest on result cards", async () => {
    await renderRecipeBrowser();

    click(getScopeChip("Cook Now"));

    const cookNowCard = getResultCard("American Beef Soup");

    expect(cookNowCard?.textContent).toContain("Cook now with what you have");
    expect(cookNowCard?.textContent).toContain("Why it matches: Showing because it lands in Cook Now.");
  });

  it("explains why a result matches the current supported browser filters", async () => {
    await renderRecipeBrowser();

    click(getTab("Protein"));
    click(getChip("Chicken"));
    click(getTab("Method"));
    click(getChip("Skillet"));

    const card = getResultCard("Italian Chicken Skillet");

    expect(card?.textContent).toContain("Why it matches: Matches current filters: Chicken + Skillet.");
    expect(card?.textContent).toContain("Chicken protein");
    expect(card?.textContent).toContain("Skillet method");
  });

  it("stays honest when pantry-fit data is unavailable on result cards", async () => {
    fetchPantryMock.mockResolvedValueOnce({ items: [] });
    fetchRecommendationsMock.mockResolvedValueOnce({
      best_tonight: null,
      alternatives: [],
      closest_options: [],
      cook_now: [],
      almost_there: [],
      not_worth_it: [],
    });

    await renderRecipeBrowser();

    const card = getResultCard("Italian Chicken Skillet");

    expect(card?.textContent).toContain("Pantry fit unavailable for this browser session");
    expect(card?.textContent).toContain(
      "Missing: Saved pantry ranking is unavailable right now, so missing-ingredient coverage is not shown.",
    );
    expect(card?.textContent).toContain("Why it matches: Showing because it stays eligible in the current browser view.");
  });

  it("applies OR logic within the cuisine taxonomy family and updates the result count", async () => {
    await renderRecipeBrowser();

    click(getTab("Cuisine"));
    click(getChip("Italian"));
    click(getChip("American"));

    expect(container.textContent).toContain("2 eligible recipes");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).toContain("American Beef Soup");
    expect(container.textContent).not.toContain("Cuban Garlic Tofu Bake");
  });

  it("applies AND logic inside ingredients and AND across families", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getChip("Aromatics"));
    click(getChip("Chicken"));
    click(getTab("Method"));
    click(getChip("Skillet"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(container.textContent).not.toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).toContain("Only 1 recipe remains in this browser view.");
  });

  it("includes descendant cuisines when a parent taxonomy filter is selected", async () => {
    await renderRecipeBrowser();

    click(getTab("Cuisine"));
    click(getChip("Latin"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).not.toContain("Italian Chicken Skillet");
  });

  it("narrows to the selected taxonomy branch when a child cuisine filter is selected", async () => {
    await renderRecipeBrowser();

    click(getTab("Cuisine"));
    click(getChip("Cuban"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).not.toContain("American Beef Soup");
  });

  it("fails closed for unsupported metadata when a family is selected", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getChip("Chicken"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("Unsupported Egg Recipe");
  });

  it("shows recovery actions for filter-driven empty states instead of dead-ending", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getChip("Chicken"));
    click(getChip("Citrus"));

    expect(container.textContent).toContain("No recipes match this browser state");
    expect(container.textContent).toContain(
      "No live recipes match the current filter stack. Try a small recovery step to reopen the live Browser result set without guessing.",
    );
    expect(getRecoveryAction("Remove latest filter: Citrus")).toBeTruthy();
    expect(getRecoveryAction("Clear Ingredients filters")).toBeTruthy();
    expect(getRecoveryAction("Show closest eligible matches in Explore All")).toBeFalsy();
  });

  it("removes the latest active filter from the empty-state recovery actions", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getChip("Chicken"));
    click(getChip("Citrus"));
    click(getRecoveryAction("Remove latest filter: Citrus"));

    expect(container.textContent).not.toContain("No recipes match this browser state");
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("IngredientsCitrus");
  });

  it("clears the latest active family from the empty-state recovery actions", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getChip("Chicken"));
    click(getTab("Cuisine"));
    click(getChip("Mexican"));

    expect(container.textContent).toContain("No recipes match this browser state");
    click(getRecoveryAction("Clear Cuisine filter"));

    expect(container.textContent).not.toContain("No recipes match this browser state");
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("CuisineMexican");
    expect(getTab("Cuisine")?.getAttribute("aria-selected")).toBe("true");
  });

  it("keeps recovery-style empty states working after Protein filtering", async () => {
    await renderRecipeBrowser();

    click(getTab("Protein"));
    click(getChip("Chicken"));
    click(getTab("Method"));
    click(getChip("Oven"));

    expect(container.textContent).toContain("No recipes match this browser state");
    expect(getRecoveryAction("Remove latest filter: Oven")).toBeTruthy();
    expect(getRecoveryAction("Clear Method filter")).toBeTruthy();

    click(getRecoveryAction("Remove latest filter: Oven"));

    expect(container.textContent).not.toContain("No recipes match this browser state");
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
  });

  it("keeps recovery-style empty states working after Cost filtering", async () => {
    await renderRecipeBrowser();

    click(getTab("Cost"));
    click(getChip("Moderate"));
    click(getTab("Method"));
    click(getChip("Oven"));

    expect(container.textContent).toContain("No recipes match this browser state");
    expect(getRecoveryAction("Remove latest filter: Oven")).toBeTruthy();
    expect(getRecoveryAction("Clear Method filter")).toBeTruthy();

    click(getRecoveryAction("Remove latest filter: Oven"));

    expect(container.textContent).not.toContain("No recipes match this browser state");
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("American Beef Soup");
  });

  it("removes a single active filter without clearing the rest", async () => {
    await renderRecipeBrowser();

    click(getChip("Chicken"));
    click(getTab("Cuisine"));
    click(getChip("Italian"));
    click(getActiveFilterChip("Chicken"));

    expect(container.textContent).not.toContain("IngredientsChicken");
    expect(container.textContent).toContain("CuisineItalian");
    click(getTab("Ingredients"));
    expect(getChip("Chicken")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("clears all selected filters at once", async () => {
    await renderRecipeBrowser();

    click(getChip("Chicken"));
    click(getTab("Cuisine"));
    click(getChip("Italian"));
    click(container.querySelector(".browser-active-filters-clear"));

    expect(container.textContent).not.toContain("Current selections");
    expect(container.textContent).toContain("Active Filters");
    click(getTab("Ingredients"));
    expect(getChip("Chicken")?.getAttribute("aria-pressed")).toBe("false");
    click(getTab("Cuisine"));
    expect(getChip("Italian")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("stays honest when no saved pantry is available for ranking", async () => {
    fetchPantryMock.mockResolvedValueOnce({ items: [] });
    fetchRecommendationsMock.mockResolvedValueOnce({
      best_tonight: null,
      alternatives: [],
      closest_options: [],
      cook_now: [],
      almost_there: [],
      not_worth_it: [],
    });

    await renderRecipeBrowser();

    expect(container.textContent).toContain("Sorted by: Add pantry items to rank");
    expect(container.textContent).toContain(
      "Add pantry items to unlock Best Pantry Match sorting and result badges grounded in what you can actually cook.",
    );
    expect(getScopeChip("Cook Now")?.hasAttribute("disabled")).toBe(true);
    expect(getScopeChip("Almost There")?.hasAttribute("disabled")).toBe(true);
    expect(getScopeChip("Pantry Stretch")?.hasAttribute("disabled")).toBe(true);
    expect(fetchRecommendationsMock).not.toHaveBeenCalled();
  });

  it("keeps successfully loaded recipes visible when part of the catalog fails to hydrate", async () => {
    fetchRecipeBrowserCatalogMock.mockResolvedValueOnce(
      makeCatalog(
        [
          makeRecipe({
            id: 2,
            name: "American Beef Soup",
            short_description: "A stovetop soup.",
            cuisine: "american",
            primary_protein: "ground beef",
            difficulty: "medium",
            cook_method: "stovetop",
            total_time_minutes: 40,
            ingredients: [
              {
                ingredient_id: 4,
                ingredient_name: "ground beef",
                is_required: true,
                measurement_is_estimated: false,
              },
            ],
          }),
          makeRecipe({
            id: 5,
            name: "Shrimp Garlic Pasta",
            primary_protein: null,
            ingredients: [
              {
                ingredient_id: 10,
                ingredient_name: "shrimp",
                is_required: true,
                measurement_is_estimated: false,
              },
              {
                ingredient_id: 11,
                ingredient_name: "garlic",
                is_required: true,
                measurement_is_estimated: false,
              },
              {
                ingredient_id: 12,
                ingredient_name: "pasta",
                is_required: true,
                measurement_is_estimated: false,
              },
            ],
          }),
        ],
        {
          failedRecipeCount: 2,
          totalRecipeCount: 4,
        },
      ),
    );

    await renderRecipeBrowser();

    expect(container.textContent).toContain(
      "2 of 4 Browser recipes could not be loaded, so this result set is grounded in the successfully hydrated catalog only.",
    );
    click(getTab("Ingredients"));
    click(getChip("Seafood"));
    expect(container.textContent).toContain("Shrimp Garlic Pasta");
    expect(container.textContent).not.toContain("Browser recipes are unavailable");
  });

  it("renders broadened ingredient browse nodes from the shared taxonomy instead of the old narrow ingredient list", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));

    expect(container.textContent).toContain("Beans & legumes");
    expect(container.textContent).toContain("Aromatics");
    expect(container.textContent).toContain("Dry spices");
    expect(container.textContent).toContain("Regional sauces & pastes");
  });

  it("returns taxonomy-backed ingredient search matches for canonical ingredients and aliases", async () => {
    await renderRecipeBrowser();

    changeInputValue(getSearchInput(), "lentil");
    expect(getSearchResult("Beans & legumes")?.textContent).toContain("Matches lentils");

    changeInputValue(getSearchInput(), "spaghetti");
    expect(getSearchResult("Pasta & noodles")?.textContent).toContain("Matches spaghetti");
  });

  it("applies the correct ingredient filter when a search result is selected and keeps ingredient chips working", async () => {
    await renderRecipeBrowser();

    changeInputValue(getSearchInput(), "spaghetti");
    click(getSearchResult("Pasta & noodles"));

    expect(container.textContent).toContain("Current selections");
    expect(container.textContent).toContain("IngredientsPasta & noodles");
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(getTab("Ingredients")?.getAttribute("aria-selected")).toBe("true");

    click(getChip("Aromatics"));

    expect(container.textContent).toContain("IngredientsAromatics");
    expect(container.textContent).toContain("IngredientsPasta & noodles");
    expect(container.textContent).toContain("1 eligible recipe");
  });

  it("keeps scope behavior intact after ingredient search interaction", async () => {
    await renderRecipeBrowser();

    changeInputValue(getSearchInput(), "spaghetti");
    click(getSearchResult("Pasta & noodles"));
    click(getScopeChip("Almost There"));

    expect(getScopeChip("Almost There")?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("1 recipe in Almost There");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
  });

  it("offers scope recovery only when broader eligible results still exist", async () => {
    fetchRecommendationsMock.mockResolvedValueOnce({
      best_tonight: makeRecommendationEntry(1, "Italian Chicken Skillet", "almost_there", 1, 82),
      alternatives: [],
      closest_options: [],
      cook_now: [],
      almost_there: [makeRecommendationEntry(1, "Italian Chicken Skillet", "almost_there", 1, 82)],
      not_worth_it: [
        makeRecommendationEntry(2, "American Beef Soup", "not_worth_it", 3, 44),
        makeRecommendationEntry(3, "Cuban Garlic Tofu Bake", "not_worth_it", 4, 28),
      ],
    });

    await renderRecipeBrowser();

    click(getScopeChip("Cook Now"));

    expect(container.textContent).toContain("No recipes match this browser state");
    expect(getRecoveryAction("Remove latest filter")).toBeFalsy();
    expect(getRecoveryAction("Clear")).toBeFalsy();
    expect(getRecoveryAction("Show closest eligible matches in Explore All")).toBeTruthy();
    expect(container.textContent).toContain(
      "Closest eligible matches means recipes that still match the current filters once this scope is widened back to Explore All.",
    );

    click(getRecoveryAction("Show closest eligible matches in Explore All"));

    expect(getScopeChip("Explore All")?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("4 eligible recipes");
    expect(container.textContent).not.toContain("No recipes match this browser state");
  });
});
