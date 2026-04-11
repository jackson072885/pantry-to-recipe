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
  mutatePantryMock,
  subscribeToPantryChangedMock,
  publishPantryChangedMock,
  trackEventMock,
} = vi.hoisted(() => ({
  fetchPantryMock: vi.fn(),
  fetchRecommendationsMock: vi.fn(),
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
    mutatePantryMock.mockReset();
    subscribeToPantryChangedMock.mockReset();
    publishPantryChangedMock.mockReset();
    trackEventMock.mockReset();

    fetchPantryMock.mockImplementation(async () => ({ items: pantryState }));
    fetchRecommendationsMock.mockImplementation(async (pantry: string[]) => makeRecommendations(pantry));
    mutatePantryMock.mockImplementation(async (action: "add" | "remove", payload: { name: string; amount: number; unit?: string }) => {
      if (action === "add") {
        pantryState = [...pantryState, { ingredient: payload.name, quantity: payload.amount, unit: payload.unit ?? "ea" }];
      } else {
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

    expect(container.textContent).toContain("Turn what you already have into dinner");
    expect(container.textContent).toContain("Start");
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

  it("lets the user skip onboarding without breaking the empty-pantry fallback", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    const skipButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Skip for now");
    expect(skipButton).toBeTruthy();

    await act(async () => {
      skipButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushEffects();

    expect(container.textContent).toContain("Add a few ingredients and get a dinner pick in seconds.");
    expect(container.textContent).not.toContain("Turn what you already have into dinner");
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

    const startButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Start");
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

    expect(mutatePantryMock).toHaveBeenNthCalledWith(1, "add", { name: "eggs", amount: 1 });
    expect(mutatePantryMock).toHaveBeenNthCalledWith(2, "add", { name: "rice", amount: 1 });
    expect(mutatePantryMock).toHaveBeenNthCalledWith(3, "add", { name: "onion", amount: 1 });
    expect(fetchRecommendationsMock).toHaveBeenLastCalledWith(["eggs", "rice", "onion"], "balanced");
    expect(container.textContent).toContain("You've unlocked your first result");
    expect(container.textContent).toContain("Keep adding ingredients to sharpen tonight's match");
    expect(container.textContent).toContain("Hide for now");
    expect(container.textContent).toContain("Best Tonight");
    expect(container.textContent).toContain("Egg Fried Rice");
    expect(container.textContent).toContain("Tomato Pasta");

    await clickChip("tomato");

    expect(mutatePantryMock).toHaveBeenNthCalledWith(4, "add", { name: "tomato", amount: 1 });
    expect(fetchRecommendationsMock).toHaveBeenLastCalledWith(["eggs", "rice", "onion", "tomato"], "balanced");
    expect(container.textContent).toContain("tomato");
  });
});
