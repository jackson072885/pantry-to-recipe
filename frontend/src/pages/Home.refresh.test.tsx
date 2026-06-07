// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./Home";
import type { PantryListResponse, RecommendationsResponse } from "../lib/mvpApi";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

const {
  fetchPantryMock,
  fetchRecommendationsMock,
  subscribeToPantryChangedMock,
} = vi.hoisted(() => ({
  fetchPantryMock: vi.fn(),
  fetchRecommendationsMock: vi.fn(),
  subscribeToPantryChangedMock: vi.fn(),
}));

vi.mock("../lib/mvpApi", async () => {
  const actual = await vi.importActual<typeof import("../lib/mvpApi")>("../lib/mvpApi");
  return {
    ...actual,
    fetchPantry: fetchPantryMock,
    fetchRecommendations: fetchRecommendationsMock,
  };
});

vi.mock("../lib/pantryEvents", () => ({
  subscribeToPantryChanged: subscribeToPantryChangedMock,
}));

function makeRecommendations(recipeName: string, pantryItems: string[]): RecommendationsResponse {
  return {
    recommendation_status: "strong_match",
    generated_from: {
      pantry_items: pantryItems,
      pantry_count: pantryItems.length,
    },
    best_tonight: {
      recipe: {
        recipe_id: pantryItems.length,
        recipe_name: recipeName,
        pantry_coverage_pct: 100,
        missing_count: 0,
        missing_ingredients: [],
        estimated_time_minutes: 15,
      },
      explanation: `${recipeName} explanation`,
      why_best: `${recipeName} why best`,
      recommendation_type: "cook_now",
      confidence_score: 0.9,
      confidence_label: "high",
      missing: {
        count: 0,
        ingredients: [],
        summary: "No missing ingredients.",
      },
      behavior: {
        has_signal: false,
        points: 0,
        direct_recipe_points: 0,
        direct_recipe_event_count: 0,
        ingredient_affinity_points: 0,
        ingredient_matches: [],
      },
      score_breakdown: {
        base_tonight_score: 0.9,
        behavior_points: 0,
        behavior_applied: false,
      },
      cta: {
        type: "cook_recipe",
        label: "Cook This Tonight",
        pantry_ready: true,
        internal_path: "/recipes/1",
        affiliate_query: "",
        missing_count: 0,
        missing_ingredients: [],
      },
      tonight_score: 0.9,
    },
    alternatives: [],
    closest_options: [],
    cook_now: [],
    almost_there: [],
    not_worth_it: [],
  };
}

describe("Home page pantry refresh", () => {
  let container: HTMLDivElement;
  let root: Root;
  let pantryChangedHandler: (() => void) | undefined;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    fetchPantryMock.mockReset();
    fetchRecommendationsMock.mockReset();
    subscribeToPantryChangedMock.mockReset();
    subscribeToPantryChangedMock.mockImplementation((handler: () => void) => {
      pantryChangedHandler = handler;
      return () => {
        pantryChangedHandler = undefined;
      };
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps the newest pantry recommendation when older requests resolve later", async () => {
    const stalePantry = deferred<PantryListResponse>();
    const freshPantry = deferred<PantryListResponse>();
    const staleRecommendations = deferred<RecommendationsResponse>();
    const freshRecommendations = deferred<RecommendationsResponse>();

    fetchPantryMock
      .mockImplementationOnce(() => stalePantry.promise)
      .mockImplementationOnce(() => freshPantry.promise);
    fetchRecommendationsMock.mockImplementation((pantry: string[]) => {
      return pantry.includes("bass") ? staleRecommendations.promise : freshRecommendations.promise;
    });

    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });

    await act(async () => {
      pantryChangedHandler?.();
    });

    await act(async () => {
      freshPantry.resolve({
        items: [
          { ingredient: "rice", quantity: 1, unit: "ea" },
          { ingredient: "salt", quantity: 1, unit: "ea" },
          { ingredient: "oil", quantity: 1, unit: "ea" },
          { ingredient: "eggs", quantity: 1, unit: "ea" },
        ],
      });
      await freshPantry.promise;
    });
    await flushEffects();
    expect(fetchRecommendationsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      freshRecommendations.resolve(makeRecommendations("Egg Fried Rice", ["rice", "salt", "oil", "eggs"]));
      await freshRecommendations.promise;
    });
    await flushEffects();

    expect(container.textContent).toContain("Egg Fried Rice");
    expect(container.textContent).not.toContain("Crispy Lemon Pan-Fried Bass");

    await act(async () => {
      stalePantry.resolve({
        items: [
          { ingredient: "bass", quantity: 1, unit: "ea" },
          { ingredient: "lemon", quantity: 1, unit: "ea" },
          { ingredient: "butter", quantity: 1, unit: "ea" },
        ],
      });
      await stalePantry.promise;
    });
    await flushEffects();
    expect(fetchRecommendationsMock).toHaveBeenCalledTimes(1);

    expect(container.textContent).toContain("Egg Fried Rice");
    expect(container.textContent).not.toContain("Crispy Lemon Pan-Fried Bass");
  });

  it("surfaces the top near-ready dinner in the hero without claiming a strong match", async () => {
    fetchPantryMock.mockResolvedValue({
      items: [
        { ingredient: "beans", quantity: 1, unit: "ea" },
        { ingredient: "rice", quantity: 1, unit: "ea" },
      ],
    });
    fetchRecommendationsMock.mockResolvedValue({
      recommendation_status: "no_strong_match",
      generated_from: {
        pantry_items: ["beans", "rice"],
        pantry_count: 2,
      },
      best_tonight: null,
      alternatives: [
        {
          recipe: {
            recipe_id: 22,
            recipe_name: "Chicken Enchilada Rice Skillet",
            pantry_coverage_pct: 100,
            missing_count: 1,
            missing_ingredients: ["chicken breast"],
            estimated_time_minutes: 30,
          },
          explanation: "You have the pantry coverage, but you still need to confirm the chicken quantity.",
          why_best: "Chicken Enchilada Rice Skillet is the closest near-ready dinner from this pantry.",
          recommendation_type: "almost_there",
          confidence_score: 0.7,
          confidence_label: "medium",
          missing: {
            count: 1,
            ingredients: ["chicken breast"],
            summary: "Need quantity confirmation for 1 ingredient: chicken breast.",
          },
          cta: {
            type: "cook_recipe",
            label: "View Recipe",
            pantry_ready: false,
            internal_path: "/recipes/22",
            affiliate_query: "",
            missing_count: 0,
            missing_ingredients: [],
          },
          tonight_score: 0.7,
        },
        {
          recipe: {
            recipe_id: 23,
            recipe_name: "Black Bean Taco Skillet",
            pantry_coverage_pct: 92,
            missing_count: 1,
            missing_ingredients: ["cheddar"],
            estimated_time_minutes: 25,
          },
          explanation: "You have most of the ingredients, but you still need cheddar.",
          why_best: "Black Bean Taco Skillet is another strong near-ready dinner.",
          recommendation_type: "almost_there",
          confidence_score: 0.68,
          confidence_label: "medium",
          missing: {
            count: 1,
            ingredients: ["cheddar"],
            summary: "Missing 1 ingredient: cheddar.",
          },
          cta: {
            type: "shop_missing_ingredients",
            label: "Search Walmart for 1 missing ingredient",
            pantry_ready: false,
            internal_path: "/recipes/23",
            affiliate_query: "cheddar",
            missing_count: 1,
            missing_ingredients: ["cheddar"],
          },
          tonight_score: 0.68,
        },
      ],
      closest_options: [
        {
          recipe: {
            recipe_id: 22,
            recipe_name: "Chicken Enchilada Rice Skillet",
            pantry_coverage_pct: 100,
            missing_count: 1,
            missing_ingredients: ["chicken breast"],
            estimated_time_minutes: 30,
          },
          explanation: "You have the pantry coverage, but you still need to confirm the chicken quantity.",
          why_best: "Chicken Enchilada Rice Skillet is the closest near-ready dinner from this pantry.",
          recommendation_type: "almost_there",
          confidence_score: 0.7,
          confidence_label: "medium",
          missing: {
            count: 1,
            ingredients: ["chicken breast"],
            summary: "Need quantity confirmation for 1 ingredient: chicken breast.",
          },
          cta: {
            type: "cook_recipe",
            label: "View Recipe",
            pantry_ready: false,
            internal_path: "/recipes/22",
            affiliate_query: "",
            missing_count: 0,
            missing_ingredients: [],
          },
          tonight_score: 0.7,
        },
        {
          recipe: {
            recipe_id: 23,
            recipe_name: "Black Bean Taco Skillet",
            pantry_coverage_pct: 92,
            missing_count: 1,
            missing_ingredients: ["cheddar"],
            estimated_time_minutes: 25,
          },
          explanation: "You have most of the ingredients, but you still need cheddar.",
          why_best: "Black Bean Taco Skillet is another strong near-ready dinner.",
          recommendation_type: "almost_there",
          confidence_score: 0.68,
          confidence_label: "medium",
          missing: {
            count: 1,
            ingredients: ["cheddar"],
            summary: "Missing 1 ingredient: cheddar.",
          },
          cta: {
            type: "shop_missing_ingredients",
            label: "Search Walmart for 1 missing ingredient",
            pantry_ready: false,
            internal_path: "/recipes/23",
            affiliate_query: "cheddar",
            missing_count: 1,
            missing_ingredients: ["cheddar"],
          },
          tonight_score: 0.68,
        },
      ],
      cook_now: [],
      almost_there: [],
      not_worth_it: [],
    });

    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    expect(container.textContent).toContain("Closest Dinner Tonight");
    expect(container.textContent).toContain("Chicken Enchilada Rice Skillet");
    expect(container.textContent).toContain("Need quantity confirmation for 1 ingredient: chicken breast.");
    expect(container.textContent).toContain("Black Bean Taco Skillet");
    expect(container.textContent).not.toContain("This is your strongest dinner match for tonight.");
  });

  it("surfaces a true best tonight dinner without hiding cook-ready truth", async () => {
    fetchPantryMock.mockResolvedValue({
      items: [
        { ingredient: "eggs", quantity: 2, unit: "ea" },
        { ingredient: "rice", quantity: 1, unit: "cup" },
      ],
    });
    fetchRecommendationsMock.mockResolvedValue(makeRecommendations("Egg Fried Rice", ["eggs", "rice"]));

    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    expect(container.textContent).toContain("Best Dinner Tonight");
    expect(container.textContent).toContain("Egg Fried Rice");
    expect(container.textContent).toContain("Ready to cook");
    expect(container.textContent).toContain("Ready from your pantry");
    expect(container.textContent).toContain("Cook This Tonight");
    expect(container.textContent).not.toContain("Closest Dinner Tonight");
    expect(container.textContent).not.toContain("No strong match tonight.");
  });

  it("does not force a 0 percent recipe into the top dinner decision", async () => {
    fetchPantryMock.mockResolvedValue({
      items: [
        { ingredient: "mustard", quantity: 1, unit: "ea" },
      ],
    });
    fetchRecommendationsMock.mockResolvedValue({
      recommendation_status: "no_strong_match",
      generated_from: {
        pantry_items: ["mustard"],
        pantry_count: 1,
      },
      best_tonight: null,
      alternatives: [],
      closest_options: [
        {
          recipe: {
            recipe_id: 45,
            recipe_name: "Chicken Rice Skillet",
            pantry_coverage_pct: 0,
            missing_count: 3,
            missing_ingredients: ["chicken", "rice", "onion"],
            estimated_time_minutes: 35,
          },
          explanation: "This still needs the actual dinner base.",
          why_best: "This is only a distant fallback, not a dinner-ready match.",
          recommendation_type: "not_worth_it",
          confidence_score: 0.2,
          confidence_label: "low",
          missing: {
            count: 3,
            ingredients: ["chicken", "rice", "onion"],
            summary: "Missing 3 ingredients: chicken, rice, onion.",
          },
          cta: {
            type: "shop_missing_ingredients",
            label: "View Recipe",
            pantry_ready: false,
            internal_path: "/recipes/45",
            affiliate_query: "",
            missing_count: 3,
            missing_ingredients: ["chicken", "rice", "onion"],
          },
          tonight_score: 0.2,
        },
      ],
      cook_now: [],
      almost_there: [],
      not_worth_it: [],
    });

    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    expect(container.textContent).toContain("Closest Dinner Tonight");
    expect(container.textContent).toContain("Chicken Rice Skillet");
    expect(container.textContent).toContain("Missing 3 ingredients: chicken, rice, onion.");
    expect(container.textContent).toContain("without overstating readiness");
    expect(container.textContent).not.toContain("Best Dinner Tonight");
    expect(container.textContent).not.toContain("This is your strongest dinner match for tonight.");
  });

  it("renders a clear Walmart search handoff for best-option gaps", async () => {
    fetchPantryMock.mockResolvedValue({
      items: [
        { ingredient: "beans", quantity: 1, unit: "ea" },
        { ingredient: "rice", quantity: 1, unit: "ea" },
      ],
    });
    fetchRecommendationsMock.mockResolvedValue({
      recommendation_status: "strong_match",
      generated_from: {
        pantry_items: ["beans", "rice"],
        pantry_count: 2,
      },
      best_tonight: {
        recipe: {
          recipe_id: 31,
          recipe_name: "Weeknight Chili",
          pantry_coverage_pct: 72,
          missing_count: 2,
          missing_ingredients: ["yellow onion", "cheddar cheese"],
          estimated_time_minutes: 25,
        },
        explanation: "You have most of the base ingredients already.",
        why_best: "This is still the strongest dinner option with a short store stop.",
        recommendation_type: "almost_there",
        confidence_score: 0.82,
        confidence_label: "medium",
        missing: {
          count: 2,
          ingredients: ["yellow onion", "cheddar cheese"],
          summary: "Missing 2 ingredients: yellow onion, cheddar cheese.",
        },
        behavior: {
          has_signal: true,
          points: 0.8,
          direct_recipe_points: 0,
          direct_recipe_event_count: 0,
          ingredient_affinity_points: 0.8,
          ingredient_matches: [{ ingredient: "yellow onion", points: 0.8, event_count: 2 }],
        },
        score_breakdown: {
          base_tonight_score: 0.82,
          behavior_points: 0.8,
          behavior_applied: true,
        },
        cta: {
          type: "shop_missing_ingredients",
          label: "Search Walmart for 2 missing ingredients",
          pantry_ready: false,
          internal_path: "/recipes/31",
          affiliate_query: "yellow onion cheddar cheese",
          missing_count: 2,
          missing_ingredients: ["yellow onion", "cheddar cheese"],
        },
        tonight_score: 0.82,
      },
      alternatives: [],
      closest_options: [],
      cook_now: [],
      almost_there: [],
      not_worth_it: [],
    });

    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    expect(container.textContent).toContain("Search Walmart for 2 missing ingredients");
    expect(container.textContent).toContain("Opens a Walmart search in a new tab for yellow onion, cheddar cheese.");
    expect(container.textContent).toContain("History broke a close call");
    expect(container.textContent).toContain("This is still the strongest dinner option with a short store stop.");

    const outboundCta = Array.from(container.querySelectorAll("a")).find((link) =>
      link.textContent?.includes("Search Walmart for 2 missing ingredients"),
    );
    expect(outboundCta?.getAttribute("href")).toBe("https://www.walmart.com/search?q=yellow+onion+cheddar+cheese");
  });
});
