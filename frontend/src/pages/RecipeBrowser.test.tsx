// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { RECIPE_BROWSER_MVP_FILTER_ORDER, RECIPE_BROWSER_MVP_FILTERS } from "../lib/recipeBrowserMvp";
import type { PantryItem, RecommendationEntry, RecommendationsResponse, RecipeBrowserCatalog, RecipeDetail } from "../lib/mvpApi";

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
      makeRecipe(),
      makeRecipe({
        id: 3,
        name: "Cuban Garlic Tofu Bake",
        short_description: "An oven-baked tofu dinner.",
        cuisine: "cuban",
        primary_protein: "tofu",
        difficulty: "medium",
        cook_method: "oven",
        total_time_minutes: 50,
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
      (button) => button.textContent?.trim() === label,
    );
  }

  function getChip(label: string) {
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-filter-chip")).find((button) =>
      button.textContent?.includes(label),
    );
  }

  function getActiveFilterChip(label: string) {
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-active-filter-chip")).find((button) =>
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

  it("renders tabs from the shared Phase 7 contract and defaults to the ingredients panel", async () => {
    await renderRecipeBrowser();

    expect(container.textContent).toContain("Recipe Browser");
    expect(container.textContent).toContain("Sorted by: Best Pantry Match");
    expect(container.textContent).toContain("4 eligible recipes");
    expect(container.textContent).toContain(
      "Filters decide eligibility first. Pantry-aware ranking only reorders recipes that already match the current filter stack.",
    );

    const tabButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabButtons).toHaveLength(RECIPE_BROWSER_MVP_FILTER_ORDER.length);
    expect(tabButtons.map((button) => button.textContent?.trim())).toEqual(
      RECIPE_BROWSER_MVP_FILTER_ORDER.map((family) => family.label),
    );

    expect(getTab("Ingredients")?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Now browsingIngredients");
    expect(getActiveFilterPanel().textContent).toContain(
      "Ingredient bubbles stack with AND inside Ingredients",
    );

    expect(getActiveFilterPanel().textContent).toContain(RECIPE_BROWSER_MVP_FILTERS.ingredients.options[0].label);
    expect(getActiveFilterPanel().textContent).not.toContain(RECIPE_BROWSER_MVP_FILTERS.cuisine.options[0].label);
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
    click(getChip("Garlic"));
    click(getChip("Chicken"));
    click(getTab("Method"));
    click(getChip("Skillet"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(container.textContent).not.toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).toContain("Only 1 eligible recipe remains with this filter mix.");
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

  it("shows an honest empty state instead of silently loosening ingredient filters", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getChip("Chicken"));
    click(getChip("Cumin"));

    expect(container.textContent).toContain("No eligible recipes");
    expect(container.textContent).toContain(
      "None of the live recipes match this filter stack. Remove a bubble or clear the current selections to widen the Browser back out.",
    );
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
});
