// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSavedPantryRecommendations } from "./useSavedPantryRecommendations";
import type { PantryListResponse, RecommendationMode, RecommendationsResponse } from "./mvpApi";

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

vi.mock("./mvpApi", async () => {
  const actual = await vi.importActual<typeof import("./mvpApi")>("./mvpApi");
  return {
    ...actual,
    fetchPantry: fetchPantryMock,
    fetchRecommendations: fetchRecommendationsMock,
  };
});

vi.mock("./pantryEvents", () => ({
  subscribeToPantryChanged: subscribeToPantryChangedMock,
}));

function makeRecommendations(bestName: string, alternativesName = "Backup Pasta"): RecommendationsResponse {
  return {
    recommendation_status: "strong_match",
    generated_from: {
      pantry_items: ["rice", "eggs", "oil"],
      pantry_count: 3,
    },
    best_tonight: {
      recipe: {
        recipe_id: 101,
        recipe_name: bestName,
        pantry_coverage_pct: 100,
        missing_count: 0,
        missing_ingredients: [],
        estimated_time_minutes: 15,
        recommendation_type: "cook_now",
      },
      explanation: `${bestName} explanation`,
      why_best: `${bestName} why best`,
      recommendation_type: "cook_now",
      confidence_score: 0.95,
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
        internal_path: "/recipes/101",
        affiliate_query: "",
        missing_count: 0,
        missing_ingredients: [],
      },
      tonight_score: 0.95,
    },
    alternatives: [
      {
        recipe: {
          recipe_id: 202,
          recipe_name: alternativesName,
          pantry_coverage_pct: 70,
          missing_count: 1,
          missing_ingredients: ["parmesan"],
          estimated_time_minutes: 25,
          recommendation_type: "almost_there",
        },
        explanation: `${alternativesName} explanation`,
        why_best: `${alternativesName} why best`,
        recommendation_type: "almost_there",
        confidence_score: 0.7,
        confidence_label: "medium",
        missing: {
          count: 1,
          ingredients: ["parmesan"],
          summary: "Missing 1 ingredient: parmesan.",
        },
        cta: {
          type: "shop_missing_ingredients",
          label: "Get Missing Ingredients",
          pantry_ready: false,
          internal_path: "/recipes/202",
          affiliate_query: "parmesan",
          missing_count: 1,
          missing_ingredients: ["parmesan"],
        },
        tonight_score: 0.7,
      },
    ],
    closest_options: [],
    cook_now: [],
    almost_there: [],
    not_worth_it: [],
  };
}

function Harness({ mode = "balanced" }: { mode?: RecommendationMode }) {
  const { bestEntry, error, loading, pantryNames, recommendations } = useSavedPantryRecommendations({
    genericErrorMessage: "Failed to load recommendations.",
    initialLoading: true,
    mode,
  });

  return (
    <div>
      <div data-testid="loading">{loading ? "loading" : "idle"}</div>
      <div data-testid="error">{error || "none"}</div>
      <div data-testid="pantry">{pantryNames.join(",") || "empty"}</div>
      <div data-testid="best">{bestEntry?.recipe.recipe_name ?? "none"}</div>
      <div data-testid="status">{recommendations?.recommendation_status ?? "none"}</div>
    </div>
  );
}

describe("useSavedPantryRecommendations", () => {
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
    localStorage.clear();
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
      root.render(<Harness />);
    });

    await act(async () => {
      pantryChangedHandler?.();
    });

    await act(async () => {
      freshPantry.resolve({
        items: [
          { ingredient: "rice", quantity: 1, unit: "ea" },
          { ingredient: "eggs", quantity: 1, unit: "ea" },
          { ingredient: "oil", quantity: 1, unit: "ea" },
        ],
      });
      await freshPantry.promise;
    });
    await flushEffects();

    await act(async () => {
      freshRecommendations.resolve(makeRecommendations("Egg Fried Rice"));
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

  it("skips recommendation fetches and stays safe when the pantry is empty", async () => {
    fetchPantryMock.mockResolvedValue({ items: [] });

    await act(async () => {
      root.render(<Harness />);
    });
    await flushEffects();

    expect(fetchRecommendationsMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("empty");
    expect(container.textContent).toContain("none");
    expect(container.textContent).toContain("idle");
  });

  it("surfaces the backend best_tonight choice as the stable best entry", async () => {
    fetchPantryMock.mockResolvedValue({
      items: [
        { ingredient: "rice", quantity: 1, unit: "ea" },
        { ingredient: "eggs", quantity: 1, unit: "ea" },
        { ingredient: "oil", quantity: 1, unit: "ea" },
      ],
    });
    fetchRecommendationsMock.mockResolvedValue(makeRecommendations("Egg Fried Rice", "Backup Soup"));

    await act(async () => {
      root.render(<Harness />);
    });
    await flushEffects();

    expect(container.textContent).toContain("Egg Fried Rice");
    expect(container.textContent).toContain("strong_match");
    expect(localStorage.getItem("onboarding_recommendations_viewed")).toBe("1");
    expect(fetchRecommendationsMock).toHaveBeenCalledWith(["rice", "eggs", "oil"], "balanced");
  });

  it("refetches recommendations when the decision mode changes", async () => {
    fetchPantryMock.mockResolvedValue({
      items: [
        { ingredient: "rice", quantity: 1, unit: "ea" },
        { ingredient: "eggs", quantity: 1, unit: "ea" },
      ],
    });
    fetchRecommendationsMock
      .mockResolvedValueOnce(makeRecommendations("Balanced Rice Bowl"))
      .mockResolvedValueOnce(makeRecommendations("Fast Egg Rice"));

    await act(async () => {
      root.render(<Harness mode="balanced" />);
    });
    await flushEffects();

    expect(container.textContent).toContain("Balanced Rice Bowl");
    expect(fetchRecommendationsMock).toHaveBeenLastCalledWith(["rice", "eggs"], "balanced");

    await act(async () => {
      root.render(<Harness mode="lowest_effort" />);
    });
    await flushEffects();

    expect(container.textContent).toContain("Fast Egg Rice");
    expect(fetchRecommendationsMock).toHaveBeenLastCalledWith(["rice", "eggs"], "lowest_effort");
  });
});
