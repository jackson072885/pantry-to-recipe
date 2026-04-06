// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RecommendationsPage from "./Search";
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

function getByRole(container: HTMLElement, role: "link", options: { name: RegExp }): HTMLAnchorElement {
  const links = Array.from(container.querySelectorAll("a"));
  const match = links.find((link) => {
    const accessibleName = link.textContent?.trim() ?? "";
    return options.name.test(accessibleName);
  });

  if (!match) {
    throw new Error(`Unable to find element with role "${role}" and name ${options.name.toString()}.`);
  }

  return match;
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
        estimated_time_minutes: 12,
      },
      explanation: `${recipeName} explanation`,
      why_best: `${recipeName} why best`,
      recommendation_type: "cook_now",
      confidence_score: 0.92,
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
        base_tonight_score: 0.92,
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
      tonight_score: 0.92,
    },
    alternatives: [],
    closest_options: [],
    cook_now: [],
    almost_there: [],
    not_worth_it: [],
  };
}

describe("Recommendations page pantry refresh", () => {
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

  it("ignores older recommendation loads after a newer pantry change wins", async () => {
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
          <RecommendationsPage />
        </MemoryRouter>,
      );
    });

    await act(async () => {
      pantryChangedHandler?.();
    });

    await act(async () => {
      freshPantry.resolve({
        items: [
          { ingredient: "shrimp", quantity: 1, unit: "ea" },
          { ingredient: "garlic", quantity: 1, unit: "ea" },
          { ingredient: "butter", quantity: 1, unit: "ea" },
          { ingredient: "lemon", quantity: 1, unit: "ea" },
        ],
      });
      await freshPantry.promise;
    });
    await flushEffects();
    expect(fetchRecommendationsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      freshRecommendations.resolve(makeRecommendations("Garlic Butter Shrimp", ["shrimp", "garlic", "butter", "lemon"]));
      await freshRecommendations.promise;
    });
    await flushEffects();

    expect(container.textContent).toContain("Garlic Butter Shrimp");
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

    expect(container.textContent).toContain("Garlic Butter Shrimp");
    expect(container.textContent).not.toContain("Crispy Lemon Pan-Fried Bass");
  });

  it("renders the empty pantry state without crashing", async () => {
    fetchPantryMock.mockResolvedValue({ items: [] });

    await act(async () => {
      root.render(
        <MemoryRouter>
          <RecommendationsPage />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    expect(fetchRecommendationsMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Your pantry is empty.");
    expect(container.textContent).toContain("Go to Pantry");
  });

  it("renders a Walmart CTA on Search that uses the backend affiliate query", async () => {
    fetchPantryMock.mockResolvedValue({
      items: [
        { ingredient: "black beans", quantity: 1, unit: "ea" },
        { ingredient: "rice", quantity: 1, unit: "ea" },
      ],
    });
    fetchRecommendationsMock.mockResolvedValue({
      recommendation_status: "strong_match",
      generated_from: {
        pantry_items: ["black beans", "rice"],
        pantry_count: 2,
      },
      best_tonight: {
        recipe: {
          recipe_id: 44,
          recipe_name: "Weeknight Burrito Bowls",
          pantry_coverage_pct: 70,
          missing_count: 2,
          missing_ingredients: ["sour cream", "avocado"],
          estimated_time_minutes: 20,
        },
        explanation: "You already have the base ingredients covered.",
        why_best: "This is the strongest dinner option with a small store stop.",
        recommendation_type: "almost_there",
        confidence_score: 0.84,
        confidence_label: "medium",
        missing: {
          count: 2,
          ingredients: ["sour cream", "avocado"],
          summary: "Missing 2 ingredients: sour cream, avocado.",
        },
        behavior: {
          has_signal: true,
          points: 1.1,
          direct_recipe_points: 0.4,
          direct_recipe_event_count: 1,
          ingredient_affinity_points: 0.7,
          ingredient_matches: [{ ingredient: "avocado", points: 0.7, event_count: 2 }],
        },
        score_breakdown: {
          base_tonight_score: 0.84,
          behavior_points: 1.1,
          behavior_applied: true,
        },
        cta: {
          type: "shop_missing_ingredients",
          label: "Search Walmart for 2 missing ingredients",
          pantry_ready: false,
          internal_path: "/recipes/44",
          affiliate_query: "fresh avocado sour cream",
          missing_count: 2,
          missing_ingredients: ["sour cream", "avocado"],
        },
        tonight_score: 0.84,
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
          <RecommendationsPage />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    const walmartCta = getByRole(container, "link", { name: /Search Walmart/i });

    expect(container.textContent).toContain("Pantry fit leads this ranking.");
    expect(container.textContent).toContain("History broke a close call");
    expect(container.textContent).toContain("recent activity on avocado broke a close call");
    expect(container.textContent).toContain("Browse backup buckets");
    expect(container.textContent).toContain("The top card above is the primary dinner decision.");
    expect(walmartCta).toBeDefined();
    expect(walmartCta.textContent).toContain("Search Walmart for 2 missing ingredients");
    expect(walmartCta.getAttribute("href")).toContain("fresh+avocado+sour+cream");
  });
});
