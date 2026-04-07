// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RecipeDetailPage from "./RecipeDetail";

const {
  cookRecipeMock,
  fetchPantryMock,
  fetchRecipeDetailMock,
} = vi.hoisted(() => ({
  cookRecipeMock: vi.fn(),
  fetchPantryMock: vi.fn(),
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
  fetchPantry: fetchPantryMock,
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
    },
  ],
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
    fetchPantryMock.mockReset();
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
    fetchPantryMock.mockResolvedValue({
      items: [{ ingredient: "rice", quantity: 1, unit: "cup" }],
    });

    await renderPage();

    expect(container.textContent).toContain("Tonight's readiness");
    expect(container.textContent).toContain("Required ready: 1/1");
    expect(container.textContent).toContain("Status: ready to cook.");
    expect(container.textContent).toContain("READY");
    expect(container.textContent).toContain("enough in pantry");
  });

  it("shows the blocked action path when required ingredients are missing", async () => {
    fetchRecipeDetailMock.mockResolvedValue(baseRecipe);
    fetchPantryMock.mockResolvedValue({
      items: [],
    });

    await renderPage();

    expect(container.textContent).toContain("You still need 1 required item");
    expect(container.textContent).toContain("Status: blocked until pantry is ready.");
    expect(container.textContent).toContain("Search Walmart for Missing Items");
    expect(container.textContent).toContain("Copy Missing List");
    expect(container.textContent).toContain("NEED MORE");
  });

  it("sends positive and negative preference signals from recipe detail", async () => {
    fetchRecipeDetailMock.mockResolvedValue(baseRecipe);
    fetchPantryMock.mockResolvedValue({
      items: [{ ingredient: "rice", quantity: 1, unit: "cup" }],
    });
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
    expect(container.textContent).toContain("small positive tie-break signal");

    await act(async () => {
      skipButton.click();
    });

    expect(trackRecipeSkippedMock).toHaveBeenCalledWith("42", {
      source: "recipe_detail:preference_feedback",
      recipe_name: "Weeknight Rice Bowl",
    });
    expect(container.textContent).toContain("small negative signal for this recipe");
  });
});
