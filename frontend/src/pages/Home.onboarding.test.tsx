// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./Home";
import type { PantryItem, RecommendationsResponse } from "../lib/mvpApi";

const {
  fetchPantryMock,
  fetchRecommendationsMock,
  addPantryPresenceMock,
  mutatePantryMock,
  subscribeToPantryChangedMock,
  publishPantryChangedMock,
  trackEventMock,
} = vi.hoisted(() => ({
  fetchPantryMock: vi.fn(),
  fetchRecommendationsMock: vi.fn(),
  addPantryPresenceMock: vi.fn(),
  mutatePantryMock: vi.fn(),
  subscribeToPantryChangedMock: vi.fn(),
  publishPantryChangedMock: vi.fn(),
  trackEventMock: vi.fn(),
}));

vi.mock("../lib/mvpApi", async () => {
  const actual = await vi.importActual<typeof import("../lib/mvpApi")>("../lib/mvpApi");
  return {
    ...actual,
    fetchPantry: fetchPantryMock,
    fetchRecommendations: fetchRecommendationsMock,
    addPantryPresence: addPantryPresenceMock,
    mutatePantry: mutatePantryMock,
  };
});

vi.mock("../lib/pantryEvents", () => ({
  subscribeToPantryChanged: subscribeToPantryChangedMock,
  publishPantryChanged: publishPantryChangedMock,
}));

vi.mock("../lib/tracking", async () => {
  const actual = await vi.importActual<typeof import("../lib/tracking")>("../lib/tracking");
  return {
    ...actual,
    trackEvent: trackEventMock,
  };
});

function makeRecommendations(pantryItems: string[], recipeName = "Egg Fried Rice"): RecommendationsResponse {
  return {
    recommendation_status: "strong_match",
    generated_from: {
      pantry_items: pantryItems,
      pantry_count: pantryItems.length,
    },
    best_tonight: {
      recipe: {
        recipe_id: 10,
        recipe_name: recipeName,
        pantry_coverage_pct: 100,
        missing_count: 0,
        missing_ingredients: [],
        estimated_time_minutes: 25,
      },
      explanation: "Uses most of what you already have.",
      why_best: "Only one pan and a fast finish.",
      recommendation_type: "cook_now",
      confidence_score: 0.91,
      confidence_label: "high",
      missing: {
        count: 0,
        ingredients: [],
        summary: "No missing ingredients.",
      },
      cta: {
        type: "cook_recipe",
        label: "Cook This Tonight",
        pantry_ready: true,
        internal_path: "/recipes/10",
        affiliate_query: "",
        missing_count: 0,
        missing_ingredients: [],
      },
      tonight_score: 0.91,
    },
    alternatives: [
      {
        recipe: {
          recipe_id: 11,
          recipe_name: "Tomato Pasta",
          pantry_coverage_pct: 67,
          missing_count: 1,
          missing_ingredients: ["parmesan"],
          estimated_time_minutes: 20,
        },
        explanation: "One quick backup if you want pasta instead.",
        why_best: "Needs just one extra ingredient.",
        recommendation_type: "almost_there",
        confidence_score: 0.72,
        confidence_label: "medium",
        missing: {
          count: 1,
          ingredients: ["parmesan"],
          summary: "Missing 1 ingredient: parmesan.",
        },
        cta: {
          type: "shop_missing_ingredients",
          label: "Search Walmart for 1 missing ingredient",
          pantry_ready: false,
          internal_path: "/recipes/11",
          affiliate_query: "parmesan",
          missing_count: 1,
          missing_ingredients: ["parmesan"],
        },
        tonight_score: 0.72,
      },
    ],
    closest_options: [],
    cook_now: [],
    almost_there: [],
    not_worth_it: [],
  };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("Home onboarding", () => {
  let container: HTMLDivElement;
  let root: Root;
  let pantryChangedHandler: (() => void) | undefined;
  let pantryState: PantryItem[];

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    pantryState = [];
    localStorage.clear();

    fetchPantryMock.mockReset();
    fetchRecommendationsMock.mockReset();
    addPantryPresenceMock.mockReset();
    mutatePantryMock.mockReset();
    subscribeToPantryChangedMock.mockReset();
    publishPantryChangedMock.mockReset();
    trackEventMock.mockReset();

    fetchPantryMock.mockImplementation(async () => ({ items: pantryState }));
    fetchRecommendationsMock.mockImplementation(async (pantry: string[]) => makeRecommendations(pantry));
    addPantryPresenceMock.mockImplementation(async (payload: { name: string }) => {
      pantryState = [...pantryState, { ingredient: payload.name, quantity: null, unit: null, quantity_is_known: false }];
      return { items: pantryState };
    });
    mutatePantryMock.mockImplementation(async (action: "add" | "remove", payload: { name: string; amount: number; unit?: string }) => {
      if (action === "remove") {
        pantryState = pantryState.filter((item) => (item.ingredient ?? "") !== payload.name);
      }
      return { items: pantryState };
    });
    subscribeToPantryChangedMock.mockImplementation((handler: () => void) => {
      pantryChangedHandler = handler;
      return () => {
        pantryChangedHandler = undefined;
      };
    });
    publishPantryChangedMock.mockImplementation(() => {
      pantryChangedHandler?.();
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("triggers first-run onboarding when the saved pantry is empty", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    expect(container.textContent).toContain("Dinner Tonight.");
    expect(container.textContent).toContain("Build My Pantry");
    expect(container.textContent).toContain("Try a Sample Pantry");
    expect(fetchRecommendationsMock).not.toHaveBeenCalled();
  });

  it("does not show onboarding for a returning pantry and keeps recommendations visible", async () => {
    pantryState = [
      { ingredient: "rice", quantity: 1, unit: "ea" },
      { ingredient: "eggs", quantity: 1, unit: "ea" },
      { ingredient: "oil", quantity: 1, unit: "ea" },
    ];

    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    expect(container.textContent).not.toContain("Turn what you already have into dinner");
    expect(container.textContent).toContain("Best Tonight");
    expect(container.textContent).toContain("Egg Fried Rice");
  });

  it("labels 100% ingredient coverage with unknown quantities as a quantity check", async () => {
    pantryState = [
      { ingredient: "rice", quantity: null, unit: null, quantity_is_known: false },
      { ingredient: "eggs", quantity: 1, unit: "ea" },
      { ingredient: "oil", quantity: 1, unit: "ea" },
    ];
    const recommendations = makeRecommendations(["rice", "eggs", "oil"]);
    const quantityCheckEntry = {
      ...recommendations.best_tonight!,
      recommendation_type: "almost_there" as const,
      missing: {
        ...recommendations.best_tonight!.missing,
        count: 1,
        ingredients: ["rice"],
        summary: "Need quantity confirmation for 1 ingredient: rice.",
        quantity_confirmation_count: 1,
        quantity_confirmation_ingredients: ["rice"],
      },
      cta: {
        ...recommendations.best_tonight!.cta,
        type: "cook_recipe" as const,
        label: "View Recipe",
        pantry_ready: false,
        missing_count: 0,
        missing_ingredients: [],
      },
    };
    fetchRecommendationsMock.mockResolvedValueOnce({
      ...recommendations,
      recommendation_status: "no_strong_match",
      best_tonight: null,
      alternatives: [quantityCheckEntry],
      closest_options: [quantityCheckEntry],
      cook_now: [],
      almost_there: [quantityCheckEntry],
    });

    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    expect(container.textContent).toContain("Confirm amounts");
    expect(container.textContent).toContain("Ingredients found - confirm amounts");
    expect(container.textContent).not.toContain("Ready to cook now");
    expect(container.textContent).not.toContain("100% pantry match");
  });

  it("lets the user skip onboarding without breaking the empty-pantry fallback", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    const skipButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Try a Sample Pantry");
    expect(skipButton).toBeTruthy();

    await act(async () => {
      skipButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(container.textContent).toContain("Add a few ingredients and get a dinner pick in seconds.");
    expect(container.textContent).not.toContain("Turn what you already have into dinner");
  });

  it("keeps the current default chips visible and exposes see-all affordances for quick-start sections", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    const startButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Build My Pantry");
    expect(startButton).toBeTruthy();

    await act(async () => {
      startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(container.textContent).toContain("eggs");
    expect(container.textContent).toContain("rice");
    expect(container.textContent).toContain("milk");
    expect(container.textContent).toContain("onion");

    const seeAllButtons = Array.from(container.querySelectorAll("button")).filter((button) => button.textContent === "See all");
    expect(seeAllButtons.length).toBeGreaterThanOrEqual(4);
    expect(Array.from(container.textContent?.matchAll(/See all/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("lets users expand a section and add an expanded-only chip without changing the quick-start interaction", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    const startButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Build My Pantry");
    expect(startButton).toBeTruthy();

    await act(async () => {
      startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const seeAllProteins = container.querySelector('button[aria-label="See all proteins"]');
    expect(seeAllProteins).toBeTruthy();

    await act(async () => {
      seeAllProteins?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const shrimpButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "shrimp");
    expect(shrimpButton).toBeTruthy();

    await act(async () => {
      shrimpButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(addPantryPresenceMock).toHaveBeenLastCalledWith({ name: "shrimp" });
  });

  it("searches across expanded quick-start ingredients without losing chip-based selection", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    const startButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Build My Pantry");
    expect(startButton).toBeTruthy();

    await act(async () => {
      startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const searchInput = container.querySelector('input[aria-label="Search ingredients"]');
    expect(searchInput).toBeTruthy();

    await act(async () => {
      if (searchInput instanceof HTMLInputElement) {
        const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        valueSetter?.call(searchInput, "shrimp");
        searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await flushEffects();

    const shrimpButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "shrimp");
    expect(shrimpButton).toBeTruthy();

    await act(async () => {
      shrimpButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(addPantryPresenceMock).toHaveBeenLastCalledWith({ name: "shrimp" });
  });

  it("keeps quick-start active after the third ingredient and refreshes recommendations as more are added", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    const startButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Build My Pantry");
    expect(startButton).toBeTruthy();

    await act(async () => {
      startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    const clickChip = async (label: string) => {
      const button = Array.from(container.querySelectorAll("button")).find((element) => element.textContent === label);
      expect(button).toBeTruthy();
      await act(async () => {
        button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await flushEffects();
    };

    await clickChip("eggs");
    expect(container.textContent).toContain("Pick 3 ingredients to unlock your first dinner idea");
    expect(container.textContent).toContain("1/3 selected");

    await clickChip("rice");
    await clickChip("onion");

    expect(addPantryPresenceMock).toHaveBeenNthCalledWith(1, { name: "eggs" });
    expect(addPantryPresenceMock).toHaveBeenNthCalledWith(2, { name: "rice" });
    expect(addPantryPresenceMock).toHaveBeenNthCalledWith(3, { name: "onion" });
    expect(fetchRecommendationsMock).toHaveBeenLastCalledWith(["eggs", "rice", "onion"], "balanced");
    expect(container.textContent).toContain("You've unlocked your first result");
    expect(container.textContent).toContain("Keep adding ingredients to sharpen tonight's match");
    expect(container.textContent).toContain("Hide for now");
    expect(container.textContent).toContain("Best Tonight");
    expect(container.textContent).toContain("Egg Fried Rice");
    expect(container.textContent).toContain("Tomato Pasta");

    await clickChip("tomato");

    expect(addPantryPresenceMock).toHaveBeenNthCalledWith(4, { name: "tomato" });
    expect(fetchRecommendationsMock).toHaveBeenLastCalledWith(["eggs", "rice", "onion", "tomato"], "balanced");
    expect(container.textContent).toContain("tomato");
  });
});
