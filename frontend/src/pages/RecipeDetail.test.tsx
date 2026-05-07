// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RecipeDetailPage from "./RecipeDetail";

const {
  cookRecipeMock,
  fetchRecipeDetailMock,
} = vi.hoisted(() => ({
  cookRecipeMock: vi.fn(),
  fetchRecipeDetailMock: vi.fn(),
}));

const {
  trackCookClickedMock,
  trackIngredientsRequestedMock,
  trackRecipeCookedConfirmedMock,
  trackRecipeLikedMock,
  trackRecipeSkippedMock,
} = vi.hoisted(() => ({
  trackCookClickedMock: vi.fn(),
  trackIngredientsRequestedMock: vi.fn(),
  trackRecipeCookedConfirmedMock: vi.fn(),
  trackRecipeLikedMock: vi.fn(),
  trackRecipeSkippedMock: vi.fn(),
}));

vi.mock("../lib/mvpApi", () => ({
  cookRecipe: cookRecipeMock,
  fetchRecipeDetail: fetchRecipeDetailMock,
}));

vi.mock("../lib/shoppingLinks", () => ({
  buildShoppingSearchUrl: vi.fn((items: string[]) => (items.length ? "https://example.com/shop" : "")),
}));

vi.mock("../lib/tracking", () => ({
  trackCookClicked: trackCookClickedMock,
  trackIngredientsRequested: trackIngredientsRequestedMock,
  trackRecipeCookedConfirmed: trackRecipeCookedConfirmedMock,
  trackRecipeLiked: trackRecipeLikedMock,
  trackRecipeSkipped: trackRecipeSkippedMock,
}));

vi.mock("../lib/providerApi", () => ({
  mapPantryToSupplyItems: (items: Array<{ ingredient: string }>) => items.map((item) => item.ingredient.trim().toLowerCase()),
}));

const baseRecipe = {
  id: 42,
  name: "Weeknight Rice Bowl",
  short_description: "Fast, pantry-aware dinner.",
  total_time_minutes: 25,
  prep_time_minutes: 10,
  cook_time_minutes: 15,
  servings: 2,
  ingredients: [
    {
      ingredient_id: 1,
      ingredient_name: "rice",
      display_name: "Rice",
      pantry_name: "rice",
      is_required: true,
      required_quantity: 1,
      unit: "cup",
      measurement_is_estimated: false,
      pantry_status: "ready",
      pantry_quantity: 1,
      pantry_unit: "cup",
      pantry_quantity_is_known: true,
      pantry_has_enough: true,
    },
    {
      ingredient_id: 2,
      ingredient_name: "scallion",
      display_name: "Scallion",
      pantry_name: "scallion",
      is_required: false,
      required_quantity: 1,
      unit: "ea",
      measurement_is_estimated: false,
      pantry_status: "missing",
      pantry_quantity: null,
      pantry_unit: null,
      pantry_quantity_is_known: null,
      pantry_has_enough: false,
    },
  ],
  readiness: {
    can_cook_now: true,
    required_ready_count: 1,
    required_count: 1,
    missing_required_ingredients: [],
    missing_optional_ingredients: ["Scallion"],
    required_quantity_confirmation_ingredients: [],
    optional_quantity_confirmation_ingredients: [],
  },
  steps: [{ step_number: 1, instruction_text: "Cook the rice." }],
  equipment: [],
  tips: [],
  substitutions: [],
  warnings: [],
  storage: [],
  tags: [],
};

describe("RecipeDetailPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchRecipeDetailMock.mockReset();
    cookRecipeMock.mockReset();
    trackCookClickedMock.mockReset();
    trackIngredientsRequestedMock.mockReset();
    trackRecipeCookedConfirmedMock.mockReset();
    trackRecipeLikedMock.mockReset();
    trackRecipeSkippedMock.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/recipes/42"]}>
          <Routes>
            <Route path="/recipes/:id" element={<RecipeDetailPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
  }

  it("shows a ready-to-cook status when required ingredients are covered", async () => {
    fetchRecipeDetailMock.mockResolvedValue(baseRecipe);

    await renderPage();

    expect(container.textContent).toContain("Can I cook this tonight?");
    expect(container.textContent).toContain("You can cook this tonight");
    expect(container.textContent).toContain("You have: 1/1 required");
    expect(container.textContent).toContain("Ready to cook.");
    expect(container.textContent).toContain("You have this");
    expect(container.textContent).toContain("ready in pantry");
  });

  it("shows the blocked action path when required ingredients are missing", async () => {
    fetchRecipeDetailMock.mockResolvedValue({
      ...baseRecipe,
      ingredients: [
        {
          ...baseRecipe.ingredients[0],
          pantry_status: "missing",
          pantry_quantity: null,
          pantry_unit: null,
          pantry_quantity_is_known: null,
          pantry_has_enough: false,
        },
        baseRecipe.ingredients[1],
      ],
      readiness: {
        ...baseRecipe.readiness,
        can_cook_now: false,
        required_ready_count: 0,
        missing_required_ingredients: ["Rice"],
        missing_optional_ingredients: ["Scallion"],
      },
    });

    await renderPage();

    expect(container.textContent).toContain("Not worth starting yet");
    expect(container.textContent).toContain("Fix pantry before cooking.");
    expect(container.textContent).toContain("Search Walmart for missing items");
    expect(container.textContent).toContain("Copy missing/check list");
    expect(Array.from(container.querySelectorAll("a")).filter((link) => link.textContent === "Fix pantry")).toHaveLength(1);
    expect(container.textContent).not.toContain("Fix pantry first");
    expect(container.textContent).toContain("Missing");
  });

  it("sends positive and negative preference signals from recipe detail", async () => {
    fetchRecipeDetailMock.mockResolvedValue(baseRecipe);
    trackRecipeLikedMock.mockResolvedValue(true);
    trackRecipeSkippedMock.mockResolvedValue(true);

    await renderPage();

    const buttons = Array.from(container.querySelectorAll("button"));
    const likeButton = buttons.find((button) => button.textContent?.includes("More Like This"));
    const skipButton = buttons.find((button) => button.textContent?.includes("Not Tonight"));

    if (!(likeButton instanceof HTMLButtonElement) || !(skipButton instanceof HTMLButtonElement)) {
      throw new Error("Expected preference feedback buttons");
    }

    await act(async () => {
      likeButton.click();
    });

    expect(trackRecipeLikedMock).toHaveBeenCalledWith("42", {
      source: "recipe_detail:preference_feedback",
      recipe_name: "Weeknight Rice Bowl",
    });
    expect(container.textContent).toContain("small positive tie-break signal in future close calls");

    await act(async () => {
      skipButton.click();
    });

    expect(trackRecipeSkippedMock).toHaveBeenCalledWith("42", {
      source: "recipe_detail:preference_feedback",
      recipe_name: "Weeknight Rice Bowl",
    });
    expect(container.textContent).toContain("small negative tie-break signal for this recipe in future close calls");
  });

  it("blocks shopping language when the only blocker is unknown pantry quantity", async () => {
    fetchRecipeDetailMock.mockResolvedValue({
      ...baseRecipe,
      ingredients: [
        {
          ...baseRecipe.ingredients[0],
          pantry_status: "needs_quantity_confirmation",
          pantry_quantity: null,
          pantry_unit: null,
          pantry_quantity_is_known: false,
          pantry_has_enough: false,
        },
        baseRecipe.ingredients[1],
      ],
      readiness: {
        ...baseRecipe.readiness,
        can_cook_now: false,
        required_ready_count: 0,
        missing_required_ingredients: [],
        required_quantity_confirmation_ingredients: ["Rice"],
      },
    });

    await renderPage();

    expect(container.textContent).toContain("Almost there");
    expect(container.textContent).toContain("Check amount: Rice");
    expect(container.textContent).toContain("Check amount");
    expect(container.textContent).not.toContain("Search Walmart for missing items");
  });

  it("explains incompatible saved pantry units without a bare quantity comparison", async () => {
    fetchRecipeDetailMock.mockResolvedValue({
      ...baseRecipe,
      ingredients: [
        {
          ...baseRecipe.ingredients[0],
          ingredient_name: "chicken breast",
          display_name: "Chicken Breast",
          required_quantity: 1.5,
          unit: "lb",
          pantry_status: "needs_quantity_confirmation",
          pantry_quantity: 3,
          pantry_unit: "ea",
          pantry_quantity_is_known: true,
          pantry_has_enough: false,
        },
        baseRecipe.ingredients[1],
      ],
      readiness: {
        ...baseRecipe.readiness,
        can_cook_now: false,
        required_ready_count: 0,
        missing_required_ingredients: [],
        required_quantity_confirmation_ingredients: ["Chicken Breast"],
      },
    });

    await renderPage();

    expect(container.textContent).toContain(
      "Pantry saved as 3 ea; recipe needs 1.5 lb, so check the amount manually",
    );
    expect(container.textContent).toContain("Check amount: Chicken Breast");
    expect(container.textContent).not.toContain("Pantry: 3 ea");
    expect(container.textContent).not.toContain("Search Walmart for missing items");
  });
});
