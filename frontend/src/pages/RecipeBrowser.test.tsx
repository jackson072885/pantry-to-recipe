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
        tags: ["moderate", "multi_pan", "high_protein", "kid_friendly"],
        is_weeknight_friendly: false,
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
        tags: ["budget", "one_pan", "weeknight"],
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
        tags: ["budget", "sheet_pan", "vegetarian", "meal_prep"],
        is_weeknight_friendly: false,
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
        tags: ["premium", "comfort_food"],
        is_weeknight_friendly: false,
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

  function getNavLabels() {
    return Array.from(container.querySelectorAll<HTMLElement>(".top-nav a")).map((link) => link.textContent?.trim());
  }

  it("renders the rebuilt search, scope, and family structure from shared config and defaults to the ingredients panel", async () => {
    await renderRecipeBrowser();

    expect(getNavLabels()).toEqual(["Dinner Tonight", "Your Pantry", "Tonight’s Matches", "Recipe Browser"]);
    expect(container.textContent).toContain("Pantry to Plate");
    expect(container.textContent).toContain("Browse your options. Choose what fits. Cook with confidence.");
    expect(container.textContent).toContain("Pantry context and filter state stay visible here while the hero stays clean.");
    expect(container.textContent).toContain("Sorted by: Best Pantry Match");
    expect(container.textContent).toContain("4 eligible recipes");
    expect(container.textContent).toContain("Filters set eligibility. Pantry fit only changes order.");
    expect(container.textContent).toContain("Eligible recipes");
    expect(container.textContent).toContain("Your strongest options stay in view while the browser keeps the wider field open.");

    expect(container.textContent).toContain("Find ingredients");
    expect(container.textContent).toContain(
      "Search groups, ingredients, or aliases.",
    );
    expect(getSearchInput()?.getAttribute("placeholder")).toBe("Search ingredients like garlic or spaghetti");

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
      "Open a group, then add leaf ingredients.",
    );

    expect(getActiveFilterPanel().textContent).toContain("Ingredient leaves");
    expect(getActiveFilterPanel().textContent).toContain("Chicken & poultry");
    expect(getActiveFilterPanel().textContent).toContain(RECIPE_BROWSER_MVP_FILTERS.ingredients.options[0].label);
    expect(getActiveFilterPanel().textContent).not.toContain(RECIPE_BROWSER_MVP_FILTERS.cuisine.options[0].label);
  });

  it("renders real Cost options from supported recipe metadata instead of a placeholder", async () => {
    await renderRecipeBrowser();

    click(getTab("Cost"));

    expect(getTab("Cost")?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Now browsingCost");
    expect(container.textContent).toContain(
      "Cost uses OR within the family and reflects coarse cost tags only.",
    );
    expect(container.textContent).toContain("Budget");
    expect(container.textContent).toContain("Moderate");
    expect(container.textContent).toContain(
      "Cost",
    );
  });

  it("renders real Cleanup options from supported recipe metadata instead of a placeholder", async () => {
    await renderRecipeBrowser();

    click(getTab("Cleanup"));

    expect(getTab("Cleanup")?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Now browsingCleanup");
    expect(container.textContent).toContain(
      "Cleanup uses OR within the family and reflects coarse cleanup tags only.",
    );
    expect(container.textContent).toContain("One Pan");
    expect(container.textContent).toContain("One Pot");
    expect(container.textContent).toContain("Sheet Pan");
    expect(container.textContent).toContain("Multi Pan");
    expect(container.textContent).not.toContain("Cleanup filters are not wired yet");
  });

  it("renders only the real supported Diet options from recipe metadata instead of a placeholder", async () => {
    await renderRecipeBrowser();

    click(getTab("Diet"));

    expect(getTab("Diet")?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Now browsingDiet");
    expect(container.textContent).toContain(
      "Diet uses OR within the family and only reflects explicit dataset labels on the recipe.",
    );
    expect(container.textContent).toContain("Vegetarian");
    expect(container.textContent).not.toContain("Vegan");
    expect(container.textContent).not.toContain("Diet filters are not wired yet");
  });

  it("renders real Household options from supported recipe metadata instead of a placeholder", async () => {
    await renderRecipeBrowser();

    click(getTab("Household"));

    expect(getTab("Household")?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Now browsingHousehold");
    expect(container.textContent).toContain(
      "Household uses OR within the family and reflects explicit weeknight, meal-prep, or kid-friendly tags.",
    );
    expect(container.textContent).toContain("Weeknight");
    expect(container.textContent).toContain("Meal Prep");
    expect(container.textContent).toContain("Kid-Friendly");
    expect(container.textContent).not.toContain("Comfort Food");
    expect(container.textContent).not.toContain("Household filters are not wired yet");
  });

  it("switches tabs and renders only the active family bubble set", async () => {
    await renderRecipeBrowser();

    click(getTab("Cuisine"));

    expect(getTab("Cuisine")?.getAttribute("aria-selected")).toBe("true");
    expect(getTab("Ingredients")?.getAttribute("aria-selected")).toBe("false");
    expect(container.textContent).toContain("Now browsingCuisine");
    expect(container.textContent).toContain("Cuisine uses OR within the family");
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
      "Protein uses OR within the family and follows the current browse-node mapping.",
    );
    expect(container.textContent).toContain("Chicken & poultry");
    expect(container.textContent).toContain("Beans & legumes");
    expect(container.textContent).toContain("Tofu & plant protein");
    expect(container.textContent).not.toContain("Protein filters are not wired yet");
  });

  it("selects and deselects bubbles with active filters shown separately", async () => {
    await renderRecipeBrowser();

    const chickenChip = getChip("chicken");
    click(chickenChip);

    expect(chickenChip?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Current selections");
    expect(getActiveFilterChip("chicken")).toBeTruthy();

    click(chickenChip);

    expect(chickenChip?.getAttribute("aria-pressed")).toBe("false");
    expect(container.textContent).toContain("No filters yet");
    expect(container.textContent).not.toContain("Current selections");
  });

  it("preserves selections across tab changes", async () => {
    await renderRecipeBrowser();

    click(getChip("chicken"));
    click(getTab("Cuisine"));
    click(getChip("Italian"));
    click(getTab("Ingredients"));

    expect(getChip("chicken")?.getAttribute("aria-pressed")).toBe("true");
    expect(getActiveFilterChip("chicken")).toBeTruthy();
    expect(getActiveFilterChip("Italian")).toBeTruthy();
  });

  it("filters the live result set when a Protein option is selected", async () => {
    await renderRecipeBrowser();

    click(getTab("Protein"));
    click(getChip("Tofu & plant protein"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).not.toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(getActiveFilterChip("Tofu & plant protein")).toBeTruthy();
  });

  it("keeps Protein filters working alongside existing family filters", async () => {
    await renderRecipeBrowser();

    click(getTab("Protein"));
    click(getChip("Chicken & poultry"));
    click(getTab("Method"));
    click(getChip("Skillet"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(container.textContent).not.toContain("Cuban Garlic Tofu Bake");
    expect(getActiveFilterChip("Chicken & poultry")).toBeTruthy();
    expect(getActiveFilterChip("Skillet")).toBeTruthy();
  });

  it("updates the active filter strip cleanly when Protein filters are added and removed", async () => {
    await renderRecipeBrowser();

    click(getTab("Protein"));
    click(getChip("Seafood"));

    expect(getActiveFilterChip("Seafood")).toBeTruthy();

    click(getActiveFilterChip("Seafood"));

    expect(getActiveFilterChip("Seafood")).toBeFalsy();
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
    expect(getActiveFilterChip("Moderate")).toBeTruthy();
  });

  it("filters the live result set when the supported Diet option is selected", async () => {
    await renderRecipeBrowser();

    click(getTab("Diet"));
    click(getChip("Vegetarian"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).not.toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(container.textContent).not.toContain("Unsupported Egg Recipe");
    expect(getActiveFilterChip("Vegetarian")).toBeTruthy();
  });

  it("filters the live result set when a Household option is selected", async () => {
    await renderRecipeBrowser();

    click(getTab("Household"));
    click(getChip("Meal Prep"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).not.toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(container.textContent).not.toContain("Unsupported Egg Recipe");
    expect(getActiveFilterChip("Meal Prep")).toBeTruthy();
  });

  it("keeps Diet filters working alongside existing family filters", async () => {
    await renderRecipeBrowser();

    click(getTab("Diet"));
    click(getChip("Vegetarian"));
    click(getTab("Method"));
    click(getChip("Oven"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).not.toContain("Italian Chicken Skillet");
    expect(getActiveFilterChip("Vegetarian")).toBeTruthy();
    expect(getActiveFilterChip("Oven")).toBeTruthy();
  });

  it("keeps Household filters working alongside existing family filters", async () => {
    await renderRecipeBrowser();

    click(getTab("Household"));
    click(getChip("Weeknight"));
    click(getTab("Method"));
    click(getChip("Skillet"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(container.textContent).not.toContain("Cuban Garlic Tofu Bake");
    expect(getActiveFilterChip("Weeknight")).toBeTruthy();
    expect(getActiveFilterChip("Skillet")).toBeTruthy();
  });

  it("updates the active filter strip cleanly when Diet filters are added and removed", async () => {
    await renderRecipeBrowser();

    click(getTab("Diet"));
    click(getChip("Vegetarian"));

    expect(getActiveFilterChip("Vegetarian")).toBeTruthy();

    click(getActiveFilterChip("Vegetarian"));

    expect(getActiveFilterChip("Vegetarian")).toBeFalsy();
    click(getTab("Diet"));
    expect(getChip("Vegetarian")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("updates the active filter strip cleanly when Household filters are added and removed", async () => {
    await renderRecipeBrowser();

    click(getTab("Household"));
    click(getChip("Kid-Friendly"));

    expect(getActiveFilterChip("Kid-Friendly")).toBeTruthy();

    click(getActiveFilterChip("Kid-Friendly"));

    expect(getActiveFilterChip("Kid-Friendly")).toBeFalsy();
    click(getTab("Household"));
    expect(getChip("Kid-Friendly")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("filters the live result set when a Cleanup option is selected", async () => {
    await renderRecipeBrowser();

    click(getTab("Cleanup"));
    click(getChip("Sheet Pan"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).not.toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(getActiveFilterChip("Sheet Pan")).toBeTruthy();
  });

  it("keeps Cleanup filters working alongside existing family filters", async () => {
    await renderRecipeBrowser();

    click(getTab("Cleanup"));
    click(getChip("One Pan"));
    click(getTab("Cuisine"));
    click(getChip("Italian"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(container.textContent).not.toContain("Cuban Garlic Tofu Bake");
    expect(getActiveFilterChip("One Pan")).toBeTruthy();
    expect(getActiveFilterChip("Italian")).toBeTruthy();
  });

  it("updates the active filter strip cleanly when Cleanup filters are added and removed", async () => {
    await renderRecipeBrowser();

    click(getTab("Cleanup"));
    click(getChip("Multi Pan"));

    expect(getActiveFilterChip("Multi Pan")).toBeTruthy();

    click(getActiveFilterChip("Multi Pan"));

    expect(getActiveFilterChip("Multi Pan")).toBeFalsy();
    click(getTab("Cleanup"));
    expect(getChip("Multi Pan")?.getAttribute("aria-pressed")).toBe("false");
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
    expect(getActiveFilterChip("Budget")).toBeTruthy();
    expect(getActiveFilterChip("Italian")).toBeTruthy();
  });

  it("updates the active filter strip cleanly when Cost filters are added and removed", async () => {
    await renderRecipeBrowser();

    click(getTab("Cost"));
    click(getChip("Budget"));

    expect(getActiveFilterChip("Budget")).toBeTruthy();

    click(getActiveFilterChip("Budget"));

    expect(getActiveFilterChip("Budget")).toBeFalsy();
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
      "Eligible in this view and ranked against your saved pantry.",
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
    expect(cookNowCard?.textContent).toContain("Showing because it lands in Cook Now.");
  });

  it("explains why a result matches the current supported browser filters", async () => {
    await renderRecipeBrowser();

    click(getTab("Protein"));
    click(getChip("Chicken & poultry"));
    click(getTab("Method"));
    click(getChip("Skillet"));

    const card = getResultCard("Italian Chicken Skillet");

    expect(card?.textContent).toContain("Matches current filters: Skillet + Chicken & poultry.");
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
      "Missing: Missing-ingredient coverage is unavailable right now.",
    );
    expect(card?.textContent).toContain("Eligible in this view.");
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
    click(getChip("garlic"));
    click(getChip("Chicken & poultry"));
    click(getChip("chicken"));
    click(getTab("Method"));
    click(getChip("Skillet"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(container.textContent).not.toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).toContain("Only 1 recipe remains in this view.");
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
    click(getChip("Chicken & poultry"));
    click(getChip("chicken"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("Unsupported Egg Recipe");
  });

  it("shows recovery actions for filter-driven empty states instead of dead-ending", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getChip("Chicken & poultry"));
    click(getChip("chicken"));
    click(getChip("Beans & legumes"));
    click(getChip("black beans"));

    expect(container.textContent).toContain("No recipes match this browser state");
    expect(container.textContent).toContain(
      "No recipes match the current filter stack. Try a quick recovery step.",
    );
    expect(getRecoveryAction("Remove latest filter: black beans")).toBeTruthy();
    expect(getRecoveryAction("Clear Ingredients filters")).toBeTruthy();
    expect(getRecoveryAction("Show closest eligible matches in Explore All")).toBeFalsy();
  });

  it("offers explicit broader ingredient swaps for weak exact-match leaves", async () => {
    fetchRecipeBrowserCatalogMock.mockResolvedValueOnce(
      makeCatalog([
        makeRecipe({
          id: 11,
          name: "Steak Bowl",
          primary_protein: "steak",
          ingredients: [
            {
              ingredient_id: 11,
              ingredient_name: "steak",
              is_required: true,
              measurement_is_estimated: false,
            },
          ],
        }),
        makeRecipe({
          id: 12,
          name: "Ground Beef Tacos",
          primary_protein: "beef",
          ingredients: [
            {
              ingredient_id: 12,
              ingredient_name: "ground beef",
              is_required: true,
              measurement_is_estimated: false,
            },
          ],
        }),
        makeRecipe({
          id: 13,
          name: "Beef Rice Bowl",
          primary_protein: "beef",
          ingredients: [
            {
              ingredient_id: 13,
              ingredient_name: "beef",
              is_required: true,
              measurement_is_estimated: false,
            },
          ],
        }),
      ]),
    );

    await renderRecipeBrowser();

    changeInputValue(getSearchInput(), "steak");
    click(getSearchResult("steak"));

    expect(container.textContent).toContain("Only 1 recipe remains in this view.");
    expect(container.textContent).toContain(
      "Try an explicit ingredient swap to reopen more options without pretending this leaf matched more recipes than it really did.",
    );
    expect(getRecoveryAction("Replace steak with broader beef (3)")).toBeTruthy();

    click(getRecoveryAction("Replace steak with broader beef (3)"));

    expect(container.textContent).toContain("3 eligible recipes");
    expect(getActiveFilterChip("steak")).toBeFalsy();
    expect(getActiveFilterChip("beef")).toBeTruthy();
  });

  it("recovers empty narrow ingredient states with explicit swaps instead of silent widening", async () => {
    fetchRecipeBrowserCatalogMock.mockResolvedValueOnce(
      makeCatalog([
        makeRecipe({
          id: 21,
          name: "Lemon Rice Bowl",
          primary_protein: null,
          ingredients: [
            {
              ingredient_id: 21,
              ingredient_name: "rice",
              is_required: true,
              measurement_is_estimated: false,
            },
          ],
        }),
      ]),
    );

    await renderRecipeBrowser();

    changeInputValue(getSearchInput(), "quinoa");
    click(getSearchResult("quinoa"));

    expect(container.textContent).toContain("No recipes match this browser state");
    expect(container.textContent).toContain(
      "These swaps are explicit. The Browser is not widening your exact ingredient behind the scenes.",
    );
    expect(getRecoveryAction("Replace quinoa with broader rice (1)")).toBeTruthy();

    click(getRecoveryAction("Replace quinoa with broader rice (1)"));

    expect(container.textContent).not.toContain("No recipes match this browser state");
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Lemon Rice Bowl");
    expect(getActiveFilterChip("quinoa")).toBeFalsy();
    expect(getActiveFilterChip("rice")).toBeTruthy();
  });

  it("removes the latest active filter from the empty-state recovery actions", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getChip("Chicken & poultry"));
    click(getChip("chicken"));
    click(getChip("Beans & legumes"));
    click(getChip("black beans"));
    click(getRecoveryAction("Remove latest filter: black beans"));

    expect(container.textContent).not.toContain("No recipes match this browser state");
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("Ingredientsblack beans");
  });

  it("clears the latest active family from the empty-state recovery actions", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getChip("Chicken & poultry"));
    click(getChip("chicken"));
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
    click(getChip("Chicken & poultry"));
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

  it("keeps recovery-style empty states working after Cleanup filtering", async () => {
    await renderRecipeBrowser();

    click(getTab("Cleanup"));
    click(getChip("Sheet Pan"));
    click(getTab("Method"));
    click(getChip("Skillet"));

    expect(container.textContent).toContain("No recipes match this browser state");
    expect(getRecoveryAction("Remove latest filter: Skillet")).toBeTruthy();
    expect(getRecoveryAction("Clear Method filter")).toBeTruthy();

    click(getRecoveryAction("Remove latest filter: Skillet"));

    expect(container.textContent).not.toContain("No recipes match this browser state");
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Cuban Garlic Tofu Bake");
  });

  it("keeps recovery-style empty states working after Diet filtering", async () => {
    await renderRecipeBrowser();

    click(getTab("Diet"));
    click(getChip("Vegetarian"));
    click(getTab("Method"));
    click(getChip("Skillet"));

    expect(container.textContent).toContain("No recipes match this browser state");
    expect(getRecoveryAction("Remove latest filter: Skillet")).toBeTruthy();
    expect(getRecoveryAction("Clear Method filter")).toBeTruthy();

    click(getRecoveryAction("Remove latest filter: Skillet"));

    expect(container.textContent).not.toContain("No recipes match this browser state");
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Cuban Garlic Tofu Bake");
  });

  it("keeps recovery-style empty states working after Household filtering", async () => {
    await renderRecipeBrowser();

    click(getTab("Household"));
    click(getChip("Meal Prep"));
    click(getTab("Method"));
    click(getChip("Skillet"));

    expect(container.textContent).toContain("No recipes match this browser state");
    expect(getRecoveryAction("Remove latest filter: Skillet")).toBeTruthy();
    expect(getRecoveryAction("Clear Method filter")).toBeTruthy();

    click(getRecoveryAction("Remove latest filter: Skillet"));

    expect(container.textContent).not.toContain("No recipes match this browser state");
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Cuban Garlic Tofu Bake");
  });

  it("removes a single active filter without clearing the rest", async () => {
    await renderRecipeBrowser();

    click(getChip("chicken"));
    click(getTab("Cuisine"));
    click(getChip("Italian"));
    click(getActiveFilterChip("chicken"));

    expect(getActiveFilterChip("chicken")).toBeFalsy();
    expect(getActiveFilterChip("Italian")).toBeTruthy();
    click(getTab("Ingredients"));
    expect(getChip("chicken")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("clears all selected filters at once", async () => {
    await renderRecipeBrowser();

    click(getChip("chicken"));
    click(getTab("Cuisine"));
    click(getChip("Italian"));
    click(container.querySelector(".browser-active-filters-clear"));

    expect(container.textContent).not.toContain("Current selections");
    expect(container.textContent).toContain("No filters yet");
    click(getTab("Ingredients"));
    expect(getChip("chicken")?.getAttribute("aria-pressed")).toBe("false");
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
      "Add pantry items to unlock pantry-fit sorting and result badges.",
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
      "2 of 4 browser recipes could not be loaded, so these results reflect the recipes that did hydrate.",
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
    expect(getSearchResult("lentils")?.textContent).toContain("Beans & legumes");

    changeInputValue(getSearchInput(), "salsa verde");
    expect(getSearchResult("salsa verde")?.textContent).toContain("Regional sauces & pastes");

    changeInputValue(getSearchInput(), "spaghetti");
    expect(getSearchResult("spaghetti")?.textContent).toContain("Pasta & noodles");
  });

  it("applies the correct ingredient filter when a search result is selected and keeps ingredient chips working", async () => {
    await renderRecipeBrowser();

    changeInputValue(getSearchInput(), "pasta");
    click(getSearchResult("pasta"));

    expect(container.textContent).toContain("Current selections");
    expect(getActiveFilterChip("pasta")).toBeTruthy();
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(getTab("Ingredients")?.getAttribute("aria-selected")).toBe("true");

    click(getChip("Aromatics"));
    click(getChip("garlic"));

    expect(getActiveFilterChip("garlic")).toBeTruthy();
    expect(getActiveFilterChip("pasta")).toBeTruthy();
    expect(container.textContent).toContain("1 eligible recipe");
  });

  it("keeps ingredient search additive when the result is already selected", async () => {
    await renderRecipeBrowser();

    changeInputValue(getSearchInput(), "pasta");
    click(getSearchResult("pasta"));

    expect(getActiveFilterChip("pasta")).toBeTruthy();

    changeInputValue(getSearchInput(), "pasta");
    click(getSearchResult("pasta"));

    expect(getActiveFilterChip("pasta")).toBeTruthy();
    expect(container.textContent).toContain("1 eligible recipe");
    expect(getChip("pasta")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps scope behavior intact after ingredient search interaction", async () => {
    await renderRecipeBrowser();

    changeInputValue(getSearchInput(), "pasta");
    click(getSearchResult("pasta"));
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
      "Explore All keeps the current filters and only widens the pantry-fit scope.",
    );

    click(getRecoveryAction("Show closest eligible matches in Explore All"));

    expect(getScopeChip("Explore All")?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("4 eligible recipes");
    expect(container.textContent).not.toContain("No recipes match this browser state");
  });

  it("falls back to Explore All when pantry-fit scopes become unavailable after a reload", async () => {
    fetchPantryMock.mockReset();
    fetchRecommendationsMock.mockReset();
    fetchPantryMock
      .mockResolvedValueOnce({
        items: [
          { ingredient: "chicken" },
          { ingredient: "garlic" },
          { ingredient: "pasta" },
        ],
      })
      .mockResolvedValueOnce({
        items: [
          { ingredient: "chicken" },
          { ingredient: "garlic" },
          { ingredient: "pasta" },
        ],
      });
    fetchRecommendationsMock
      .mockResolvedValueOnce({
        best_tonight: makeRecommendationEntry(2, "American Beef Soup", "cook_now", 0, 100),
        alternatives: [],
        closest_options: [],
        cook_now: [makeRecommendationEntry(2, "American Beef Soup", "cook_now", 0, 100)],
        almost_there: [makeRecommendationEntry(1, "Italian Chicken Skillet", "almost_there", 1, 82)],
        not_worth_it: [
          makeRecommendationEntry(3, "Cuban Garlic Tofu Bake", "not_worth_it", 3, 44),
          makeRecommendationEntry(4, "Unsupported Egg Recipe", "not_worth_it", 4, 28),
        ],
      })
      .mockRejectedValueOnce(new Error("Saved pantry ranking is unavailable right now."));

    await renderRecipeBrowser();

    click(getScopeChip("Cook Now"));
    expect(getScopeChip("Cook Now")?.getAttribute("aria-pressed")).toBe("true");

    await act(async () => {
      window.dispatchEvent(new CustomEvent("pantry:changed"));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getScopeChip("Explore All")?.getAttribute("aria-pressed")).toBe("true");
    expect(getScopeChip("Cook Now")?.hasAttribute("disabled")).toBe(true);
    expect(container.textContent).toContain("Pantry ranking unavailable");
    expect(container.textContent).toContain("Explore All shows the full eligible set.");
    expect(container.textContent).toContain("4 eligible recipes");
    expect(container.textContent).not.toContain("No recipes match this browser state");
  });
});
