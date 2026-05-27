// @vitest-environment jsdom

import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./Home";
import type { PantryItem, RecommendationsResponse } from "../lib/mvpApi";

const {
  fetchPantryMock,
  fetchDinnerTonightCandidatesMock,
  fetchRecommendationsMock,
  addPantryPresenceMock,
  clearPantryMock,
  mutatePantryMock,
  subscribeToPantryChangedMock,
  publishPantryChangedMock,
  trackEventMock,
} = vi.hoisted(() => ({
  fetchPantryMock: vi.fn(),
  fetchDinnerTonightCandidatesMock: vi.fn(),
  fetchRecommendationsMock: vi.fn(),
  addPantryPresenceMock: vi.fn(),
  clearPantryMock: vi.fn(),
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
    fetchDinnerTonightCandidates: fetchDinnerTonightCandidatesMock,
    fetchRecommendations: fetchRecommendationsMock,
    addPantryPresence: addPantryPresenceMock,
    clearPantry: clearPantryMock,
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

function makeDinnerCandidatesResponse(overrides: Record<string, unknown> = {}) {
  return {
    provider: "disabled",
    provider_status: "disabled",
    best: null,
    alternatives: [],
    candidates: [],
    filter_counts: null,
    error_message: null,
    ...overrides,
  };
}

async function flushAsyncWork() {
  for (let index = 0; index < 10; index += 1) {
    await flushEffects();
  }
}

function LocationProbe({ onChange }: { onChange: (location: ReturnType<typeof useLocation>) => void }) {
  const location = useLocation();
  useEffect(() => {
    onChange(location);
  }, [location, onChange]);
  return null;
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
    fetchDinnerTonightCandidatesMock.mockReset();
    fetchRecommendationsMock.mockReset();
    addPantryPresenceMock.mockReset();
    clearPantryMock.mockReset();
    mutatePantryMock.mockReset();
    subscribeToPantryChangedMock.mockReset();
    publishPantryChangedMock.mockReset();
    trackEventMock.mockReset();

    fetchPantryMock.mockImplementation(async () => ({ items: pantryState }));
    fetchDinnerTonightCandidatesMock.mockResolvedValue(makeDinnerCandidatesResponse());
    fetchRecommendationsMock.mockImplementation(async (pantry: string[]) => makeRecommendations(pantry));
    clearPantryMock.mockImplementation(async () => {
      const clearedCount = pantryState.length;
      pantryState = [];
      return { cleared_count: clearedCount };
    });
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
    expect(fetchDinnerTonightCandidatesMock).not.toHaveBeenCalled();
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

  it("shows a controlled provider-disabled message without blocking internal recommendations", async () => {
    pantryState = [
      { ingredient: "rice", quantity: 1, unit: "ea" },
      { ingredient: "eggs", quantity: 1, unit: "ea" },
      { ingredient: "oil", quantity: 1, unit: "ea" },
    ];
    fetchDinnerTonightCandidatesMock.mockResolvedValueOnce(makeDinnerCandidatesResponse());

    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushAsyncWork();

    expect(fetchDinnerTonightCandidatesMock).toHaveBeenCalledWith({
      ingredients: ["rice", "eggs", "oil"],
      limit: 6,
      filter_mode: "cookable_tonight",
    });
    expect(container.textContent).toContain("External recipe search is not configured yet.");
    expect(container.textContent).toContain("Best Tonight");
    expect(container.textContent).toContain("Egg Fried Rice");
  });

  it("shows a controlled missing provider key message without exposing secret names", async () => {
    pantryState = [
      { ingredient: "rice", quantity: 1, unit: "ea" },
      { ingredient: "eggs", quantity: 1, unit: "ea" },
      { ingredient: "oil", quantity: 1, unit: "ea" },
    ];
    fetchDinnerTonightCandidatesMock.mockResolvedValueOnce(
      makeDinnerCandidatesResponse({
        provider: "spoonacular",
        provider_status: "missing_api_key",
      }),
    );

    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushAsyncWork();

    expect(container.textContent).toContain("External recipe search needs a provider key before live recipes can appear.");
    expect(container.textContent).not.toContain("SPOONACULAR_API_KEY");
    expect(container.textContent).not.toContain("sk-");
    expect(container.textContent).toContain("Egg Fried Rice");
  });

  it("renders the best pantry-aware external candidate with feasibility metadata", async () => {
    pantryState = [
      { ingredient: "chicken", quantity: 1, unit: "ea" },
      { ingredient: "rice", quantity: 1, unit: "ea" },
      { ingredient: "onion", quantity: 1, unit: "ea" },
    ];
    fetchDinnerTonightCandidatesMock.mockResolvedValueOnce(
      makeDinnerCandidatesResponse({
        provider: "spoonacular",
        provider_status: "configured",
        best: {
          source: "spoonacular",
          source_id: "external-1",
          source_url: "https://example.com/chicken-rice",
          title: "Chicken Rice Skillet",
          image_url: null,
          ready_minutes: 30,
          servings: 4,
          ingredients: ["chicken", "rice", "onion", "stock", "parsley"],
          used_ingredients: ["chicken", "rice", "onion"],
          missed_ingredients: ["stock", "parsley"],
          unused_ingredients: [],
          instructions: ["Cook it."],
          cuisine_tags: [],
          dish_type_tags: [],
          flavor_tags: [],
          sauce_tags: [],
          method_tags: [],
          raw_score_fields: {},
          score: 0.88,
          feasibility_bucket: "almost_there",
          feasibility_reasons: ["Core pantry items are present.", "Only stock is a meaningful gap."],
          critical_missing_ingredients: ["stock"],
          moderate_missing_ingredients: ["butter"],
          minor_missing_ingredients: ["parsley"],
        },
        alternatives: [
          {
            source: "spoonacular",
            source_id: "external-2",
            title: "Chicken Soup",
            source_url: null,
            image_url: null,
            ready_minutes: null,
            servings: null,
            ingredients: [],
            used_ingredients: [],
            missed_ingredients: [],
            unused_ingredients: [],
            instructions: [],
            cuisine_tags: [],
            dish_type_tags: [],
            flavor_tags: [],
            sauce_tags: [],
            method_tags: [],
            raw_score_fields: {},
            score: 0.6,
            feasibility_bucket: "inspiration",
            feasibility_reasons: [],
            critical_missing_ingredients: [],
            moderate_missing_ingredients: [],
            minor_missing_ingredients: [],
          },
        ],
        candidates: [],
        filter_counts: { mode: "cookable_tonight" },
      }),
    );

    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushAsyncWork();

    expect(container.textContent).toContain("Pantry-Aware External Candidate");
    expect(container.textContent).toContain("Chicken Rice Skillet");
    expect(container.textContent).toContain("Almost there");
    expect(container.textContent).toContain("Core pantry items are present.");
    expect(container.textContent).toContain("Uses from pantry");
    expect(container.textContent).toContain("chicken");
    expect(container.textContent).toContain("Critical gaps");
    expect(container.textContent).toContain("stock");
    expect(container.textContent).toContain("Moderate gaps");
    expect(container.textContent).toContain("butter");
    expect(container.textContent).toContain("Minor gaps");
    expect(container.textContent).toContain("parsley");
    expect(container.textContent).toContain("1 more external option available behind this pick.");
    expect(container.textContent).toContain("Egg Fried Rice");
  });

  it("shows a controlled external candidate error state without crashing", async () => {
    pantryState = [
      { ingredient: "rice", quantity: 1, unit: "ea" },
      { ingredient: "eggs", quantity: 1, unit: "ea" },
      { ingredient: "oil", quantity: 1, unit: "ea" },
    ];
    fetchDinnerTonightCandidatesMock.mockRejectedValueOnce(new Error("provider timeout"));

    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushAsyncWork();

    expect(container.textContent).toContain("External recipe search is unavailable right now.");
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

  it("loads a sample pantry and refreshes dinner recommendations", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushEffects();

    const sampleButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Try a Sample Pantry");
    expect(sampleButton).toBeTruthy();

    await act(async () => {
      sampleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushAsyncWork();

    expect(addPantryPresenceMock).toHaveBeenNthCalledWith(1, { name: "chicken" });
    expect(addPantryPresenceMock).toHaveBeenNthCalledWith(2, { name: "rice" });
    expect(addPantryPresenceMock).toHaveBeenNthCalledWith(3, { name: "onion" });
    expect(addPantryPresenceMock).toHaveBeenNthCalledWith(4, { name: "cheese" });
    expect(addPantryPresenceMock).toHaveBeenNthCalledWith(5, { name: "egg" });
    expect(addPantryPresenceMock).toHaveBeenNthCalledWith(6, { name: "salt" });
    expect(addPantryPresenceMock).toHaveBeenNthCalledWith(7, { name: "pepper" });
    expect(addPantryPresenceMock).toHaveBeenNthCalledWith(8, { name: "oil" });
    expect(fetchRecommendationsMock).toHaveBeenLastCalledWith(["chicken", "rice", "onion", "cheese", "egg", "salt", "pepper", "oil"], "balanced");
    expect(container.textContent).toContain("Sample pantry mode");
    expect(container.textContent).toContain("We loaded a demo pantry for this browser session");
    expect(container.textContent).toContain("Replace it with your own ingredients");
    expect(container.textContent).toContain("Best Tonight");
    expect(container.textContent).toContain("Egg Fried Rice");
  });

  it("starts a fresh demo session from a saved pantry", async () => {
    localStorage.setItem("pantry_session_id", "returning-demo-browser");
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
    await flushAsyncWork();

    const freshDemoButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Start Fresh Demo");
    expect(freshDemoButton).toBeTruthy();

    await act(async () => {
      freshDemoButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushAsyncWork();

    expect(clearPantryMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("pantry_session_id")).toBeTruthy();
    expect(localStorage.getItem("pantry_session_id")).not.toBe("returning-demo-browser");
    expect(publishPantryChangedMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Fresh demo session ready.");
    expect(container.textContent).toContain("Build My Pantry");
    expect(container.textContent).toContain("Try a Sample Pantry");
    expect(container.textContent).not.toContain("Egg Fried Rice");
  });

  it("starts a fresh demo session from the demo query param and cleans the URL", async () => {
    localStorage.setItem("pantry_session_id", "query-demo-browser");
    pantryState = [
      { ingredient: "rice", quantity: 1, unit: "ea" },
      { ingredient: "eggs", quantity: 1, unit: "ea" },
      { ingredient: "oil", quantity: 1, unit: "ea" },
    ];
    let latestSearch = "";

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/?demo=fresh&source=private-demo"]}>
          <LocationProbe
            onChange={(location) => {
              latestSearch = location.search;
            }}
          />
          <HomePage />
        </MemoryRouter>,
      );
    });
    await flushAsyncWork();

    expect(clearPantryMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("pantry_session_id")).toBeTruthy();
    expect(localStorage.getItem("pantry_session_id")).not.toBe("query-demo-browser");
    expect(publishPantryChangedMock).toHaveBeenCalledTimes(1);
    expect(latestSearch).toBe("?source=private-demo");
    expect(container.textContent).toContain("Fresh demo session ready.");
    expect(container.textContent).toContain("Build My Pantry");
    expect(container.textContent).toContain("Try a Sample Pantry");
    expect(container.textContent).not.toContain("Egg Fried Rice");
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

    const startButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Build My Pantry");
    expect(startButton).toBeTruthy();

    await act(async () => {
      startButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
