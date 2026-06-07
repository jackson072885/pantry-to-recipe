// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { RECIPE_BROWSER_MVP_FILTERS } from "../lib/recipeBrowserMvp";
import type {
  DinnerTonightCandidate,
  DinnerTonightCandidatesResponse,
  ImportedRecipePromotionAuditRecord,
  ImportedRecipeRecord,
  ImportReviewRecord,
  PantryItem,
  RecommendationEntry,
  RecommendationsResponse,
  RecipeBrowserCatalog,
  RecipeDetail,
} from "../lib/mvpApi";
import { RECIPE_BROWSER_FILTER_FAMILY_REGISTRY, RECIPE_BROWSER_SCOPE_OPTIONS } from "../lib/recipeTaxonomy";

const {
  createImportReviewMock,
  fetchDinnerTonightCandidatesMock,
  fetchImportedRecipePromotionAuditMock,
  fetchImportedRecipesMock,
  fetchImportReviewsMock,
  fetchPantryMock,
  fetchRecipeBrowserCatalogMock,
  fetchRecommendationsMock,
  importApprovedReviewMock,
  inspectDinnerTonightCandidateMock,
  updateImportedRecipeCleanupMock,
  updateImportedRecipePromotionAuditMock,
  updateImportReviewMock,
} = vi.hoisted(() => ({
  createImportReviewMock: vi.fn(),
  fetchDinnerTonightCandidatesMock: vi.fn<(payload: unknown) => Promise<DinnerTonightCandidatesResponse>>(),
  fetchImportedRecipePromotionAuditMock: vi.fn(),
  fetchImportedRecipesMock: vi.fn(),
  fetchImportReviewsMock: vi.fn(),
  fetchPantryMock: vi.fn<() => Promise<{ items: PantryItem[] }>>(),
  fetchRecipeBrowserCatalogMock: vi.fn<() => Promise<RecipeBrowserCatalog>>(),
  fetchRecommendationsMock: vi.fn<() => Promise<RecommendationsResponse>>(),
  importApprovedReviewMock: vi.fn(),
  inspectDinnerTonightCandidateMock: vi.fn(),
  updateImportedRecipeCleanupMock: vi.fn(),
  updateImportedRecipePromotionAuditMock: vi.fn(),
  updateImportReviewMock: vi.fn(),
}));

vi.mock("../lib/mvpApi", async () => {
  const actual = await vi.importActual<typeof import("../lib/mvpApi")>("../lib/mvpApi");
  return {
    ...actual,
    createImportReview: createImportReviewMock,
    fetchDinnerTonightCandidates: fetchDinnerTonightCandidatesMock,
    fetchImportedRecipePromotionAudit: fetchImportedRecipePromotionAuditMock,
    fetchImportedRecipes: fetchImportedRecipesMock,
    fetchImportReviews: fetchImportReviewsMock,
    fetchPantry: fetchPantryMock,
    fetchRecipeBrowserCatalog: fetchRecipeBrowserCatalogMock,
    fetchRecommendations: fetchRecommendationsMock,
    importApprovedReview: importApprovedReviewMock,
    inspectDinnerTonightCandidate: inspectDinnerTonightCandidateMock,
    updateImportedRecipeCleanup: updateImportedRecipeCleanupMock,
    updateImportedRecipePromotionAudit: updateImportedRecipePromotionAuditMock,
    updateImportReview: updateImportReviewMock,
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

function makeDinnerTonightCandidate(overrides: Partial<DinnerTonightCandidate> = {}): DinnerTonightCandidate {
  return {
    source: "spoonacular",
    source_id: "external-1",
    source_url: null,
    title: "Fried Rice - Chinese comfort food",
    image_url: null,
    ready_minutes: 25,
    servings: 4,
    ingredients: ["rice", "egg", "soy sauce"],
    used_ingredients: ["rice", "egg"],
    missed_ingredients: ["soy sauce"],
    unused_ingredients: [],
    instructions: [],
    cuisine_tags: ["chinese"],
    dish_type_tags: ["fried rice"],
    flavor_tags: ["savory"],
    sauce_tags: ["soy sauce"],
    method_tags: ["skillet"],
    raw_score_fields: {},
    score: 0.84,
    feasibility_bucket: "almost_there",
    feasibility_reasons: [],
    critical_missing_ingredients: [],
    moderate_missing_ingredients: [],
    minor_missing_ingredients: ["soy sauce"],
    ...overrides,
  };
}

function makeDinnerTonightCandidatesResponse(
  overrides: Partial<DinnerTonightCandidatesResponse> = {},
): DinnerTonightCandidatesResponse {
  return {
    provider: "spoonacular",
    provider_status: "configured",
    best: null,
    alternatives: [],
    candidates: [],
    filter_counts: {
      mode: "all",
      selected_filters: {},
      families: {
        cuisine_tags: [
          { value: "cuban", count: 2 },
          { value: "mexican", count: 1 },
          { value: "thai", count: 0 },
        ],
        method_tags: [{ value: "skillet", count: 3 }],
        feasibility_bucket: [{ value: "almost_there", count: 2 }],
      },
    },
    ...overrides,
  };
}

function makeImportReviewRecord(overrides: Partial<ImportReviewRecord> = {}): ImportReviewRecord {
  return {
    review_id: "ir_test_review",
    status: "pending_review",
    source: "spoonacular",
    source_id: "external-1",
    source_url: "https://example.test/fried-rice",
    provider: "spoonacular",
    display_title: "Fried Rice - Chinese comfort food",
    display_image_url: null,
    display_ready_minutes: 25,
    display_servings: 4,
    display_ingredients: ["Rice", "Egg", "Soy sauce"],
    display_instructions: ["Season the rice and egg.", "Cook everything in a hot skillet."],
    candidate_provenance: {
      source: "spoonacular",
      source_id: "external-1",
    },
    readiness_bucket: "almost_there",
    readiness_score: 0.84,
    used_ingredients: ["Rice", "Egg"],
    missed_ingredients: ["Soy sauce"],
    safety_flags: [],
    reviewer_notes: null,
    edited_display_title: null,
    edited_display_ingredients: [],
    edited_display_instructions: [],
    created_at: "2026-06-03T12:00:00Z",
    updated_at: "2026-06-03T12:00:00Z",
    ...overrides,
  };
}

function makeImportedRecipeRecord(overrides: Partial<ImportedRecipeRecord> = {}): ImportedRecipeRecord {
  return {
    import_id: "imp_test_review",
    review_id: "ir_test_review",
    source: "spoonacular",
    source_id: "external-1",
    source_url: "https://example.test/fried-rice",
    provider: "spoonacular",
    title: "Reviewed Fried Rice",
    ingredients: ["Rice", "Egg", "Soy sauce"],
    instructions: ["Season the rice and egg.", "Cook everything in a hot skillet."],
    provenance: {
      review_id: "ir_test_review",
      original_provider: "spoonacular",
      original_source_id: "external-1",
      imported_from_external: true,
    },
    origin: "external_import",
    verification_status: "imported_reviewed",
    imported_from_external: true,
    imported_at: "2026-06-03T12:00:00Z",
    ...overrides,
  };
}

function makePromotionAuditRecord(
  overrides: Partial<ImportedRecipePromotionAuditRecord> = {},
): ImportedRecipePromotionAuditRecord {
  return {
    audit_id: "ipa_test_review",
    import_id: "imp_test_review",
    review_id: "ir_test_review",
    provenance_status: "not_started",
    cleanup_status: "not_started",
    safety_status: "not_started",
    feasibility_status: "not_started",
    quality_status: "not_started",
    duplicate_status: "not_started",
    reviewer_notes: null,
    promotion_readiness: "not_ready",
    origin: "external_import",
    verification_status: "imported_reviewed",
    imported_from_external: true,
    created_at: "2026-06-04T12:00:00Z",
    updated_at: "2026-06-04T12:00:00Z",
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

function changeTextareaValue(element: HTMLTextAreaElement | null | undefined, value: string) {
  if (!element) {
    throw new Error("Expected textarea to exist before changing it.");
  }

  act(() => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function changeSelectValue(element: HTMLSelectElement | null | undefined, value: string) {
  if (!element) {
    throw new Error("Expected select to exist before changing it.");
  }

  act(() => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function flushAsyncUpdates() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
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
    window.localStorage.clear();
    createImportReviewMock.mockReset();
    fetchDinnerTonightCandidatesMock.mockReset();
    fetchImportedRecipePromotionAuditMock.mockReset();
    fetchImportedRecipesMock.mockReset();
    fetchImportReviewsMock.mockReset();
    fetchPantryMock.mockReset();
    fetchRecipeBrowserCatalogMock.mockReset();
    fetchRecommendationsMock.mockReset();
    importApprovedReviewMock.mockReset();
    inspectDinnerTonightCandidateMock.mockReset();
    updateImportedRecipeCleanupMock.mockReset();
    updateImportedRecipePromotionAuditMock.mockReset();
    updateImportReviewMock.mockReset();
    createImportReviewMock.mockImplementation(async (candidate) => makeImportReviewRecord({
      display_title: candidate.display_title,
      source: candidate.source,
      source_id: candidate.source_id,
      source_url: candidate.source_url,
      provider: candidate.provider ?? candidate.source,
      display_ingredients: candidate.display_ingredients,
      display_instructions: candidate.display_instructions,
      candidate_provenance: candidate.candidate_provenance,
      readiness_bucket: candidate.readiness_bucket,
      readiness_score: candidate.readiness_score,
      used_ingredients: candidate.used_ingredients,
      missed_ingredients: candidate.missed_ingredients,
      safety_flags: candidate.display_instructions.length > 0 ? [] : ["missing_instructions", "needs_human_review"],
      status: candidate.display_instructions.length > 0 ? "pending_review" : "needs_edit",
    }));
    fetchDinnerTonightCandidatesMock.mockResolvedValue(makeDinnerTonightCandidatesResponse());
    fetchImportedRecipesMock.mockResolvedValue([]);
    fetchImportReviewsMock.mockResolvedValue([]);
    importApprovedReviewMock.mockImplementation(async (reviewId) => makeImportedRecipeRecord({
      review_id: reviewId,
    }));
    inspectDinnerTonightCandidateMock.mockResolvedValue({
      candidate: makeDinnerTonightCandidate(),
      display_title: "Fried Rice - Chinese comfort food",
      source: "spoonacular",
      source_id: "external-1",
      source_url: null,
      ingredients: [
        { raw: "rice", display: "Rice", group: "used", missing_severity: null },
        { raw: "egg", display: "Egg", group: "used", missing_severity: null },
        { raw: "soy sauce", display: "Soy sauce", group: "missed", missing_severity: "minor" },
      ],
      instructions: { has_instructions: false, steps: [], warning: "No provider instructions were included." },
      provenance: {},
      warnings: ["Instructions are unavailable; review the provider source before cooking."],
      inspection_status: "incomplete",
      import_readiness: "needs_review",
    });
    updateImportedRecipeCleanupMock.mockImplementation(async (importId, payload) => makeImportedRecipeRecord({
      import_id: importId,
      title: payload.title ?? "Reviewed Fried Rice",
      ingredients: payload.ingredients ?? ["Rice", "Egg", "Soy sauce"],
      instructions: payload.instructions ?? ["Season the rice and egg.", "Cook everything in a hot skillet."],
    }));
    fetchImportedRecipePromotionAuditMock.mockImplementation(async (importId) => makePromotionAuditRecord({
      import_id: importId,
    }));
    updateImportedRecipePromotionAuditMock.mockImplementation(async (importId, payload) => makePromotionAuditRecord({
      import_id: importId,
      ...payload,
      promotion_readiness:
        payload.provenance_status === "passed" &&
        payload.cleanup_status === "passed" &&
        payload.safety_status === "passed" &&
        payload.feasibility_status === "passed" &&
        payload.quality_status === "passed" &&
        payload.duplicate_status === "passed"
          ? "ready_for_review"
          : Object.values(payload).includes("blocked")
            ? "blocked"
            : "not_ready",
    }));
    updateImportReviewMock.mockImplementation(async (_reviewId, payload) => makeImportReviewRecord({
      status: payload.status ?? "pending_review",
    }));
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
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function getTab(label: string) {
    const normalizedLabel = (label === "Household" ? "Meal Type" : label).toLowerCase().replace(/s$/, "");
    return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (button) => button.textContent?.trim().toLowerCase().replace(/s$/, "").startsWith(normalizedLabel),
    );
  }

  function getChip(label: string) {
    const normalizedLabel = label.toLowerCase();
    const chips = Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-shell-panel .browser-filter-chip"));
    return chips.find((button) =>
      button.querySelector(".browser-filter-chip-title")?.textContent?.trim().toLowerCase() === normalizedLabel
    ) ?? chips.find((button) =>
      button.textContent?.toLowerCase().includes(normalizedLabel),
    );
  }

  function getLeafChip(label: string) {
    const normalizedLabel = label.toLowerCase();
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-filter-chip--leaf")).find((button) => {
      const title = button.querySelector(".browser-filter-chip-title")?.textContent?.trim().toLowerCase();
      return title === normalizedLabel;
    });
  }

  function getChildChip(label: string) {
    const normalizedLabel = label.toLowerCase();
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-filter-chip--child")).find((button) => {
      const title = button.querySelector(".browser-filter-chip-title")?.textContent?.trim().toLowerCase();
      return title === normalizedLabel;
    });
  }

  function getChildChipLabels() {
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-filter-chip--child")).map((button) =>
      button.querySelector(".browser-filter-chip-title")?.textContent?.trim(),
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
    const normalizedLabel = label.toLowerCase();
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-search-result")).find((button) =>
      button.textContent?.toLowerCase().includes(normalizedLabel),
    );
  }

  function getActiveFilterChip(label: string) {
    const normalizedLabel = label.toLowerCase();
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-active-filters .browser-active-filter-chip")).find((button) =>
      button.textContent?.toLowerCase().includes(normalizedLabel),
    );
  }

  function getLivingFacet(label: string) {
    const normalizedLabel = label.toLowerCase();
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-living-filter-chip")).find((button) =>
      button.querySelector(".browser-filter-chip-title")?.textContent?.trim().toLowerCase() === normalizedLabel,
    );
  }

  function getSelectedLivingFacet(label: string) {
    const normalizedLabel = label.toLowerCase();
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-living-selected .browser-active-filter-chip")).find(
      (button) => button.textContent?.toLowerCase().includes(normalizedLabel),
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

  function getIngredientFamilyButton(label: string) {
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-console-row--family .browser-console-bubble")).find(
      (button) => button.textContent?.includes(label),
    );
  }

  function getIngredientSubfamilyButton(label: string) {
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-console-row--subfamily .browser-console-bubble")).find(
      (button) => button.querySelector(".browser-filter-chip-title")?.textContent?.trim() === label,
    );
  }

  function getBrowseGroupTitlesForFamily(label: string) {
    click(getIngredientFamilyButton(label));

    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-console-row--subfamily .browser-console-bubble")).map(
      (button) => button.querySelector(".browser-filter-chip-title")?.textContent?.trim(),
    );
  }

  function getExpandedLeafTitles() {
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-ingredient-leaf-tray .browser-filter-chip--leaf")).map(
      (button) => button.querySelector(".browser-filter-chip-title")?.textContent?.trim(),
    );
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

  function getReviewedImportCard(title: string) {
    return Array.from(container.querySelectorAll<HTMLElement>(".browser-imported-recipe-card")).find((card) =>
      card.querySelector("h5")?.textContent?.includes(title),
    );
  }

  function getReviewedImportTitles() {
    return Array.from(container.querySelectorAll<HTMLElement>(".browser-imported-recipe-card h5")).map((heading) =>
      heading.textContent?.trim(),
    );
  }

  function getReviewedImportPreview() {
    return container.querySelector<HTMLElement>(".browser-imported-preview-panel");
  }

  function getButton(label: string) {
    return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === label);
  }

  function getCheckbox(label: string) {
    return Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find(
      (input) => input.closest("label")?.textContent?.includes(label),
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
    expect(container.textContent).toContain(
      "Browse recipe-backed filters. Ingredient choices filter recipes; pantry readiness stays on each card.",
    );
    expect(container.textContent).toContain("Eligible recipes");
    expect(container.textContent).toContain("Your strongest options stay in view while the browser keeps the wider field open.");

    expect(container.textContent).toContain("Find ingredients");
    expect(container.textContent).toContain(
      "Search the full pantry catalog",
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
    expect(tabButtons.map((button) => button.textContent?.trim())).toEqual([
      "Ingredient",
      "Cuisine",
      "Time",
      "Meal Type",
      "Diet",
      "Method",
      "Cleanup",
      "Cost",
      "EffortLater",
    ]);

    expect(getTab("Ingredients")?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Now browsingIngredients");
    expect(getActiveFilterPanel().textContent).toContain(
      "Start broad, then narrow to ingredients with real dinner matches.",
    );

    expect(getActiveFilterPanel().textContent).toContain("Proteins");
    expect(getActiveFilterPanel().textContent).toContain("Chicken & poultry");
    expect(container.querySelector(".browser-filter-subsection")).toBeFalsy();
    expect(container.querySelector(".browser-console-row--family")).toBeTruthy();
    expect(container.querySelector(".browser-ingredient-leaf-tray")).toBeFalsy();
    expect(getActiveFilterPanel().textContent).not.toContain(RECIPE_BROWSER_MVP_FILTERS.cuisine.options[0].label);
    expect(getTab("Protein")).toBeFalsy();
  });

  it("does not call the Dinner Tonight candidates endpoint when saved pantry is empty", async () => {
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

    expect(fetchDinnerTonightCandidatesMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Add pantry items to unlock live availability.");
    expect(container.textContent).toContain("4 eligible recipes");
  });

  it.each(["disabled", "missing_api_key", "error"] as const)(
    "keeps the static Recipe Browser usable when provider facets are %s",
    async (providerStatus) => {
      fetchDinnerTonightCandidatesMock.mockResolvedValueOnce(
        makeDinnerTonightCandidatesResponse({
          provider_status: providerStatus,
          filter_counts: null,
        }),
      );

      await renderRecipeBrowser();

      expect(fetchDinnerTonightCandidatesMock).toHaveBeenCalledWith({
        ingredients: ["chicken", "garlic", "pasta"],
        limit: 10,
        selected_filters: {},
        filter_mode: "all",
      });
      expect(container.textContent).toContain("Live facets unavailable; verified internal browser filters still work.");
      expect(container.textContent).toContain("Live provider unavailable; using verified internal browser results.");
      click(getTab("Cuisine"));
      click(getChip("Italian"));
      expect(container.textContent).toContain("Italian Chicken Skillet");
      expect(container.textContent).not.toContain("American Beef Soup");
    },
  );

  it("renders configured dynamic filter counts and hides zero-count facets", async () => {
    await renderRecipeBrowser();

    expect(container.textContent).toContain("Pantry-aware facets");
    expect(getLivingFacet("Cuban")?.textContent).toContain("2");
    expect(getLivingFacet("Mexican")?.textContent).toContain("1");
    expect(getLivingFacet("Thai")).toBeFalsy();
    expect(getLivingFacet("Skillet")?.textContent).toContain("3");
  });

  it("renders live candidate count without replacing internal Recipe Browser results", async () => {
    fetchDinnerTonightCandidatesMock.mockResolvedValueOnce(
      makeDinnerTonightCandidatesResponse({
        candidates: [
          makeDinnerTonightCandidate({ source_id: "live-1", title: "External Rice Bowl" }),
          makeDinnerTonightCandidate({ source_id: "live-2", title: "External Skillet Pasta" }),
        ],
      }),
    );

    await renderRecipeBrowser();

    expect(container.textContent).toContain("2 live candidates available.");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).toContain("External Rice Bowl");
    expect(container.textContent).not.toContain("Open External Rice Bowl");
    expect(getResultCard("External Rice Bowl")).toBeFalsy();
    expect(container.querySelectorAll(".results-card")).toHaveLength(4);
  });

  it("does not claim live facets are available when candidates return without facet chips", async () => {
    fetchDinnerTonightCandidatesMock.mockResolvedValueOnce(
      makeDinnerTonightCandidatesResponse({
        candidates: [
          makeDinnerTonightCandidate({ source_id: "live-1", title: "External Rice Bowl" }),
          makeDinnerTonightCandidate({ source_id: "live-2", title: "External Skillet Pasta" }),
        ],
        filter_counts: {
          mode: "all",
          selected_filters: {},
          families: {
            cuisine_tags: [],
            method_tags: [],
            feasibility_bucket: [],
          },
        },
      }),
    );

    await renderRecipeBrowser();

    expect(container.textContent).toContain(
      "2 live provider candidates checked. No live facets available for this pantry state yet.",
    );
    expect(container.textContent).not.toContain("Live pantry facets are available.");
    expect(getLivingFacet("Cuban")).toBeFalsy();
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.querySelectorAll(".results-card")).toHaveLength(4);
  });

  it("renders a concise best live candidate cue without creating an external result card", async () => {
    fetchDinnerTonightCandidatesMock.mockResolvedValueOnce(
      makeDinnerTonightCandidatesResponse({
        best: makeDinnerTonightCandidate({
          source_id: "best-live",
          title: "chicken weighing 2.3kg fried rice",
          display_title: "Pantry Egg Fried Rice",
        }),
        candidates: [
          makeDinnerTonightCandidate({
            source_id: "best-live",
            title: "chicken weighing 2.3kg fried rice",
            display_title: "Pantry Egg Fried Rice",
          }),
        ],
      }),
    );

    await renderRecipeBrowser();

    expect(container.textContent).toContain("Best live candidate found: Pantry Egg Fried Rice");
    expect(container.textContent).not.toContain("chicken weighing 2.3kg fried rice");
    expect(container.textContent).not.toContain("Open Pantry Egg Fried Rice");
    expect(getResultCard("Pantry Egg Fried Rice")).toBeFalsy();
    expect(container.querySelectorAll(".results-card")).toHaveLength(4);
  });

  it("inspects the best live candidate on demand without replacing verified recipe cards", async () => {
    const liveCandidate = makeDinnerTonightCandidate({
      source_id: "best-live",
      title: "chicken weighing 2.3kg fried rice",
      display_title: "Pantry Egg Fried Rice",
      display_used_ingredients: ["Rice", "Egg"],
      display_missed_ingredients: ["Soy sauce"],
    });
    fetchDinnerTonightCandidatesMock.mockResolvedValueOnce(
      makeDinnerTonightCandidatesResponse({
        best: liveCandidate,
        candidates: [liveCandidate],
      }),
    );

    await renderRecipeBrowser();

    expect(inspectDinnerTonightCandidateMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Live candidate detail");
    expect(container.textContent).toContain("Inspect the normalized provider candidate");
    click(Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Inspect candidate"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(inspectDinnerTonightCandidateMock).toHaveBeenCalledWith(liveCandidate);
    expect(container.textContent).toContain("incomplete");
    expect(container.textContent).toContain("needs review");
    expect(container.textContent).toContain("usedRice, Egg");
    expect(container.textContent).toContain("missedSoy sauce (minor)");
    click(Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Mark for review"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createImportReviewMock).toHaveBeenCalledWith({
      source: "spoonacular",
      source_id: "external-1",
      source_url: null,
      provider: "spoonacular",
      display_title: "Fried Rice - Chinese comfort food",
      display_image_url: null,
      display_ready_minutes: 25,
      display_servings: 4,
      display_ingredients: ["Rice", "Egg", "Soy sauce"],
      display_instructions: [],
      candidate_provenance: {},
      readiness_bucket: "almost_there",
      readiness_score: 0.84,
      used_ingredients: ["rice", "egg"],
      missed_ingredients: ["soy sauce"],
    });
    expect(container.textContent).toContain("Queued for review. This candidate was not imported into the verified recipe bank.");
    expect(container.textContent).toContain("Needs edit");
    expect(container.textContent).toContain("Missing Instructions");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(getResultCard("Pantry Egg Fried Rice")).toBeFalsy();
    expect(container.querySelectorAll(".results-card")).toHaveLength(4);
  });

  it("renders review queue records, safety flags, and status actions without changing recipe cards", async () => {
    fetchImportReviewsMock.mockResolvedValueOnce([
      makeImportReviewRecord({
        review_id: "ir_pending",
        status: "pending_review",
        display_title: "Queue Pantry Fried Rice",
        safety_flags: ["missing_instructions", "needs_human_review"],
      }),
    ]);
    updateImportReviewMock.mockImplementation(async (reviewId, payload) => makeImportReviewRecord({
      review_id: reviewId,
      display_title: "Queue Pantry Fried Rice",
      status: payload.status ?? "pending_review",
      safety_flags: ["missing_instructions", "needs_human_review"],
    }));

    await renderRecipeBrowser();

    expect(container.textContent).toContain("Import review queue");
    expect(container.textContent).toContain("Queue Pantry Fried Rice");
    expect(container.textContent).toContain("Pending review");
    expect(container.textContent).toContain("Missing Instructions");
    expect(container.textContent).toContain("Approval here is review readiness only; it does not add a verified recipe.");

    click(Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Reject"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(updateImportReviewMock).toHaveBeenCalledWith("ir_pending", { status: "rejected" });
    expect(container.textContent).toContain("Rejected");

    click(Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Needs edit"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(updateImportReviewMock).toHaveBeenCalledWith("ir_pending", { status: "needs_edit" });
    expect(container.textContent).toContain("Needs edit");

    click(Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Approve for import"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(updateImportReviewMock).toHaveBeenCalledWith("ir_pending", { status: "approved" });
    expect(container.textContent).toContain("Approved for import");
    expect(getResultCard("Queue Pantry Fried Rice")).toBeFalsy();
    expect(container.querySelectorAll(".results-card")).toHaveLength(4);
  });

  it("imports approved review records into a separate reviewed import panel", async () => {
    fetchImportReviewsMock.mockResolvedValueOnce([
      makeImportReviewRecord({
        review_id: "ir_approved",
        status: "approved",
        display_title: "Queue Pantry Fried Rice",
      }),
    ]);
    importApprovedReviewMock.mockResolvedValueOnce(makeImportedRecipeRecord({
      import_id: "imp_approved",
      review_id: "ir_approved",
      title: "Queue Pantry Fried Rice",
      source_id: "external-approved",
    }));

    await renderRecipeBrowser();

    expect(container.textContent).toContain("Reviewed imports");
    expect(container.textContent).toContain("No reviewed external recipes have been imported yet.");
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Import reviewed recipe")).toBeTruthy();

    click(Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Import reviewed recipe"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(importApprovedReviewMock).toHaveBeenCalledWith("ir_approved");
    expect(container.textContent).toContain("Queue Pantry Fried Rice");
    expect(container.textContent).toContain("Reviewed import");
    expect(container.textContent).toContain("external import");
    expect(container.textContent).toContain("imported reviewed");
    expect(container.textContent).toContain("Pantry fit");
    expect(container.textContent).toContain("Source preserved");
    expect(container.textContent).toContain("Separate from curated verified recipes.");
    expect(getResultCard("Queue Pantry Fried Rice")).toBeFalsy();
    expect(getReviewedImportCard("Queue Pantry Fried Rice")).toBeTruthy();
    expect(container.querySelectorAll(".results-card")).toHaveLength(4);
  });

  it("shows existing reviewed imports with trust badges without replacing internal cards", async () => {
    fetchImportedRecipesMock.mockResolvedValueOnce([
      makeImportedRecipeRecord({
        import_id: "imp_existing",
        title: "Reviewed Provider Noodles",
        source_id: "provider-noodles",
      }),
    ]);
    fetchImportReviewsMock.mockResolvedValueOnce([
      makeImportReviewRecord({
        review_id: "ir_pending_import_blocked",
        status: "pending_review",
        display_title: "Pending Provider Noodles",
      }),
    ]);

    await renderRecipeBrowser();

    expect(container.textContent).toContain("Reviewed import lane");
    expect(container.textContent).toContain("Reviewed imports stay separate");
    expect(container.textContent).toContain("Preview and cleanup are local to this lane.");
    expect(container.textContent).toContain("Reviewed Provider Noodles");
    expect(container.textContent).toContain("Reviewed import");
    expect(container.textContent).toContain("imported reviewed");
    expect(container.textContent).toContain("Source preserved");
    expect(getReviewedImportCard("Reviewed Provider Noodles")?.textContent).toContain("Promotion readiness:");
    expect(getReviewedImportCard("Reviewed Provider Noodles")?.textContent).toContain("No promotion action");
    expect(getReviewedImportCard("Reviewed Provider Noodles")?.querySelector(".browser-source-trust-badge--reviewed_import")).toBeTruthy();
    expect(getReviewedImportCard("Reviewed Provider Noodles")?.querySelector(".browser-source-trust-badge--curated_verified")).toBeFalsy();
    expect(getReviewedImportCard("Reviewed Provider Noodles")?.querySelector('a[href^="/recipes/"]')).toBeFalsy();
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Import reviewed recipe")).toBeFalsy();
    expect(getResultCard("Reviewed Provider Noodles")).toBeFalsy();
    expect(getReviewedImportCard("Reviewed Provider Noodles")).toBeTruthy();
    expect(container.querySelectorAll(".results-card")).toHaveLength(4);
  });

  it("ranks reviewed imports by pantry fit while keeping them out of curated recipe cards", async () => {
    fetchImportedRecipesMock.mockResolvedValueOnce([
      makeImportedRecipeRecord({
        import_id: "imp_weaker",
        review_id: "ir_weaker",
        title: "Reviewed Pantry Stretch Noodles",
        source_id: "provider-weaker-noodles",
        ingredients: ["Noodles", "Miso", "Scallions"],
      }),
      makeImportedRecipeRecord({
        import_id: "imp_stronger",
        review_id: "ir_stronger",
        title: "Reviewed Garlic Chicken Pasta",
        source_id: "provider-stronger-pasta",
        ingredients: ["Chicken", "Garlic", "Pasta", "Soy sauce"],
      }),
    ]);

    await renderRecipeBrowser();

    expect(getReviewedImportTitles()).toEqual([
      "Reviewed Garlic Chicken Pasta",
      "Reviewed Pantry Stretch Noodles",
    ]);
    expect(getReviewedImportCard("Reviewed Garlic Chicken Pasta")?.textContent).toContain("Pantry fit 75%");
    expect(getReviewedImportCard("Reviewed Garlic Chicken Pasta")?.textContent).toContain("Matches your pantry: 3");
    expect(getReviewedImportCard("Reviewed Pantry Stretch Noodles")?.textContent).toContain("Pantry fit 0%");
    expect(getResultCard("Reviewed Garlic Chicken Pasta")).toBeFalsy();
    expect(getResultCard("Reviewed Pantry Stretch Noodles")).toBeFalsy();
    expect(getResultTitles()).toContain("American Beef Soup");
    expect(container.querySelectorAll(".results-card")).toHaveLength(4);
    expect(getReviewedImportCard("Reviewed Garlic Chicken Pasta")?.textContent).not.toContain("Verified recipe");
    expect(getReviewedImportCard("Reviewed Garlic Chicken Pasta")?.textContent).not.toContain("Official recipe");
    expect(getReviewedImportCard("Reviewed Garlic Chicken Pasta")?.textContent).not.toContain("Fully trusted");
  });

  it("opens and closes reviewed import details without navigating to curated Recipe Detail", async () => {
    fetchImportReviewsMock.mockResolvedValueOnce([
      makeImportReviewRecord({
        review_id: "ir_preview",
        status: "approved",
        display_title: "Reviewed Garlic Chicken Pasta",
        display_ready_minutes: 35,
        display_servings: 4,
        used_ingredients: ["Chicken", "Garlic", "Pasta"],
        missed_ingredients: ["Soy sauce"],
      }),
    ]);
    fetchImportedRecipesMock.mockResolvedValueOnce([
      makeImportedRecipeRecord({
        import_id: "imp_preview",
        review_id: "ir_preview",
        title: "Reviewed Garlic Chicken Pasta",
        source_id: "provider-preview-pasta",
        source_url: "https://example.test/provider-preview-pasta",
        ingredients: ["Chicken", "Garlic", "Pasta", "Soy sauce"],
        instructions: ["Season the chicken.", "Cook the pasta and combine."],
      }),
    ]);

    await renderRecipeBrowser();

    const importCard = getReviewedImportCard("Reviewed Garlic Chicken Pasta");
    expect(importCard).toBeTruthy();
    expect(importCard?.textContent).toContain("Preview details");
    expect(importCard?.querySelector('a[href^="/recipes/"]')).toBeFalsy();

    click(Array.from(importCard?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent === "Preview details"));
    await flushAsyncUpdates();

    const preview = getReviewedImportPreview();
    expect(preview).toBeTruthy();
    expect(preview?.textContent).toContain("Reviewed import details");
    expect(preview?.textContent).toContain("Reviewed Garlic Chicken Pasta");
    expect(preview?.textContent).toContain("Reviewed import");
    expect(preview?.textContent).toContain("Imported from review");
    expect(preview?.textContent).toContain("Source preserved");
    expect(preview?.textContent).toContain("spoonacular / provider-preview-pasta");
    expect(preview?.textContent).toContain("https://example.test/provider-preview-pasta");
    expect(preview?.textContent).toContain("Pantry fit 75%");
    expect(preview?.textContent).toContain("Chicken");
    expect(preview?.textContent).toContain("Soy sauce");
    expect(preview?.textContent).toContain("Season the chicken.");
    expect(preview?.textContent).toContain("Cook the pasta and combine.");
    expect(preview?.textContent).toContain("35 min");
    expect(preview?.textContent).toContain("4 servings");
    expect(preview?.textContent).toContain("Approved for import");
    expect(preview?.textContent).toContain("Separate from curated verified recipes.");
    expect(preview?.textContent).toContain("Promotion readiness");
    expect(preview?.textContent).toContain("Candidate for promotion review");
    expect(preview?.textContent).toContain("Still a reviewed import");
    expect(preview?.textContent).toContain("Not added to curated verified recipes yet");
    expect(preview?.textContent).toContain("No promotion action is available here.");
    expect(preview?.textContent).toContain("Duplicate review");
    expect(preview?.textContent).not.toContain("Open recipe detail");
    expect(preview?.textContent).not.toContain("Verified recipe");
    expect(preview?.textContent).not.toContain("Official recipe");
    expect(preview?.textContent).not.toContain("Fully trusted");
    expect(Array.from(preview?.querySelectorAll<HTMLButtonElement>("button") ?? []).some((button) => /promote/i.test(button.textContent ?? ""))).toBe(false);
    expect(getResultCard("Reviewed Garlic Chicken Pasta")).toBeFalsy();
    expect(getResultTitles()).toContain("American Beef Soup");
    expect(container.querySelectorAll(".results-card")).toHaveLength(4);

    click(Array.from(preview?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent === "Close preview"));

    expect(getReviewedImportPreview()).toBeFalsy();
  });

  it("shows a non-mutating promotion readiness audit for reviewed imports that still need cleanup", async () => {
    fetchImportReviewsMock.mockResolvedValueOnce([
      makeImportReviewRecord({
        review_id: "ir_readiness_needs_cleanup",
        status: "approved",
        display_title: "Reviewed Sparse Provider Rice",
        safety_flags: ["missing_instructions", "needs_human_review"],
      }),
    ]);
    fetchImportedRecipesMock.mockResolvedValueOnce([
      makeImportedRecipeRecord({
        import_id: "imp_readiness_needs_cleanup",
        review_id: "ir_readiness_needs_cleanup",
        title: "Reviewed Sparse Provider Rice",
        source_id: "provider-sparse-rice",
        ingredients: ["Rice", "Egg"],
        instructions: [],
      }),
    ]);

    await renderRecipeBrowser();

    click(Array.from(getReviewedImportCard("Reviewed Sparse Provider Rice")?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent === "Preview details"));
    await flushAsyncUpdates();

    const preview = getReviewedImportPreview();
    expect(preview?.textContent).toContain("Promotion readiness");
    expect(preview?.textContent).toContain("Needs cleanup before promotion review");
    expect(preview?.textContent).toContain("Still a reviewed import");
    expect(preview?.textContent).toContain("Not added to curated verified recipes yet");
    expect(preview?.textContent).toContain("Instructions need cleanup before promotion review.");
    expect(preview?.textContent).toContain("2 review safety flags must be resolved.");
    expect(preview?.textContent).toContain("No final curated verified write is available from this panel.");
    expect(Array.from(preview?.querySelectorAll<HTMLButtonElement>("button") ?? []).some((button) => /promote/i.test(button.textContent ?? ""))).toBe(false);
    expect(updateImportedRecipeCleanupMock).not.toHaveBeenCalled();
    expect(getResultCard("Reviewed Sparse Provider Rice")).toBeFalsy();
    expect(container.querySelectorAll(".results-card")).toHaveLength(4);
  });

  it("persists reviewed import promotion audit state without promoting the import", async () => {
    fetchImportReviewsMock.mockResolvedValueOnce([
      makeImportReviewRecord({
        review_id: "ir_promotion_audit",
        status: "approved",
        display_title: "Reviewed Audit Chicken",
      }),
    ]);
    fetchImportedRecipesMock.mockResolvedValueOnce([
      makeImportedRecipeRecord({
        import_id: "imp_promotion_audit",
        review_id: "ir_promotion_audit",
        title: "Reviewed Audit Chicken",
        source_id: "provider-audit-chicken",
        ingredients: ["Chicken", "Garlic", "Pasta"],
        instructions: ["Season chicken.", "Cook pasta.", "Combine."],
      }),
    ]);
    fetchImportedRecipePromotionAuditMock.mockResolvedValueOnce(makePromotionAuditRecord({
      import_id: "imp_promotion_audit",
      review_id: "ir_promotion_audit",
      provenance_status: "passed",
      cleanup_status: "needs_work",
      reviewer_notes: "Needs duplicate check.",
    }));
    updateImportedRecipePromotionAuditMock.mockImplementationOnce(async (importId, payload) => makePromotionAuditRecord({
      import_id: importId,
      review_id: "ir_promotion_audit",
      ...payload,
      promotion_readiness: "blocked",
    }));

    await renderRecipeBrowser();

    click(Array.from(getReviewedImportCard("Reviewed Audit Chicken")?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent === "Preview details"));

    await flushAsyncUpdates();

    const auditPanel = container.querySelector<HTMLElement>(".browser-imported-promotion-audit-editor");
    expect(auditPanel?.textContent).toContain("Promotion audit state");
    expect(auditPanel?.textContent).toContain("Audit not ready");
    expect(auditPanel?.textContent).toContain("Persist checklist state only");
    expect(auditPanel?.textContent).toContain("Still a reviewed import");
    expect(auditPanel?.textContent).toContain("Not added to curated verified recipes yet");
    expect(auditPanel?.textContent).toContain("No promotion action");
    expect(auditPanel?.textContent).toContain("Cleanup review: Needs work");

    const selects = Array.from(auditPanel?.querySelectorAll<HTMLSelectElement>("select") ?? []);
    changeSelectValue(selects[5], "blocked");
    changeTextareaValue(auditPanel?.querySelector<HTMLTextAreaElement>("textarea"), "Duplicate overlaps a pantry bank recipe.");
    click(Array.from(auditPanel?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent === "Save audit state"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(updateImportedRecipePromotionAuditMock).toHaveBeenCalledWith("imp_promotion_audit", {
      provenance_status: "passed",
      cleanup_status: "needs_work",
      safety_status: "not_started",
      feasibility_status: "not_started",
      quality_status: "not_started",
      duplicate_status: "blocked",
      reviewer_notes: "Duplicate overlaps a pantry bank recipe.",
    });
    expect(getReviewedImportPreview()?.textContent).toContain("Audit blocked");
    expect(getReviewedImportPreview()?.textContent).toContain("Duplicate review: Blocked");
    expect(getReviewedImportPreview()?.textContent).not.toContain("Verified recipe");
    expect(getReviewedImportPreview()?.textContent).not.toContain("Curated recipe");
    expect(Array.from(getReviewedImportPreview()?.querySelectorAll<HTMLButtonElement>("button") ?? []).some((button) => /promote/i.test(button.textContent ?? ""))).toBe(false);
    expect(getResultCard("Reviewed Audit Chicken")).toBeFalsy();
    expect(container.querySelectorAll(".results-card")).toHaveLength(4);
  });

  it("shows safe feedback when promotion audit state save fails", async () => {
    fetchImportedRecipesMock.mockResolvedValueOnce([
      makeImportedRecipeRecord({
        import_id: "imp_promotion_audit_failure",
        title: "Reviewed Audit Failure Rice",
      }),
    ]);
    updateImportedRecipePromotionAuditMock.mockRejectedValueOnce(new Error("Promotion audit state could not be saved."));

    await renderRecipeBrowser();

    click(Array.from(getReviewedImportCard("Reviewed Audit Failure Rice")?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent === "Preview details"));

    await flushAsyncUpdates();

    const auditPanel = container.querySelector<HTMLElement>(".browser-imported-promotion-audit-editor");
    const selects = Array.from(auditPanel?.querySelectorAll<HTMLSelectElement>("select") ?? []);
    changeSelectValue(selects[0], "passed");
    click(Array.from(auditPanel?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent === "Save audit state"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Promotion audit state could not be saved.");
    expect(container.querySelector<HTMLElement>(".browser-imported-promotion-audit-editor")).toBeTruthy();
    expect(getResultCard("Reviewed Audit Failure Rice")).toBeFalsy();
  });

  it("edits reviewed import cleanup locally and saves only reviewed import fields", async () => {
    fetchImportReviewsMock.mockResolvedValueOnce([
      makeImportReviewRecord({
        review_id: "ir_cleanup",
        status: "approved",
        display_title: "Reviewed Garlic Chicken Pasta",
      }),
    ]);
    fetchImportedRecipesMock.mockResolvedValueOnce([
      makeImportedRecipeRecord({
        import_id: "imp_cleanup",
        review_id: "ir_cleanup",
        title: "Reviewed Garlic Chicken Pasta",
        source_id: "provider-cleanup-pasta",
        ingredients: ["Chicken", "Garlic", "Pasta", "Soy sauce"],
        instructions: ["Season the chicken.", "Cook the pasta and combine."],
      }),
    ]);
    updateImportedRecipeCleanupMock.mockImplementationOnce(async (importId, payload) => makeImportedRecipeRecord({
      import_id: importId,
      review_id: "ir_cleanup",
      title: payload.title,
      source_id: "provider-cleanup-pasta",
      ingredients: payload.ingredients,
      instructions: payload.instructions,
    }));

    await renderRecipeBrowser();

    click(Array.from(getReviewedImportCard("Reviewed Garlic Chicken Pasta")?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent === "Preview details"));
    await flushAsyncUpdates();
    expect(getReviewedImportPreview()?.textContent).toContain("Edit reviewed import");

    click(getButton("Edit reviewed import"));

    const editor = container.querySelector<HTMLElement>(".browser-imported-cleanup-editor");
    expect(editor).toBeTruthy();
    expect(editor?.textContent).toContain("Reviewed import cleanup");
    expect(editor?.textContent).toContain("Source preserved");
    expect(editor?.textContent).toContain("Separate from curated verified recipes.");
    expect(editor?.textContent).toContain("Does not promote this recipe");
    expect(getReviewedImportPreview()?.textContent).toContain("Promotion readiness");
    expect(getReviewedImportPreview()?.textContent).toContain("Candidate for promotion review");
    expect(getReviewedImportPreview()?.textContent).toContain("No promotion action is available here.");
    expect(editor?.querySelector<HTMLInputElement>("input")?.value).toBe("Reviewed Garlic Chicken Pasta");
    expect(Array.from(editor?.querySelectorAll<HTMLTextAreaElement>("textarea") ?? []).map((textarea) => textarea.value)).toEqual([
      "Chicken\nGarlic\nPasta\nSoy sauce",
      "Season the chicken.\nCook the pasta and combine.",
    ]);

    changeInputValue(editor?.querySelector<HTMLInputElement>("input"), "Cleaned Garlic Chicken Pasta");
    const textareas = Array.from(editor?.querySelectorAll<HTMLTextAreaElement>("textarea") ?? []);
    changeTextareaValue(textareas[0], "Chicken thighs\nGarlic\nPasta\nSoy sauce");
    changeTextareaValue(textareas[1], "Season chicken.\nCook pasta.\nCombine and serve.");
    click(getButton("Save reviewed import"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(updateImportedRecipeCleanupMock).toHaveBeenCalledWith("imp_cleanup", {
      title: "Cleaned Garlic Chicken Pasta",
      ingredients: ["Chicken thighs", "Garlic", "Pasta", "Soy sauce"],
      instructions: ["Season chicken.", "Cook pasta.", "Combine and serve."],
    });
    expect(getReviewedImportCard("Cleaned Garlic Chicken Pasta")).toBeTruthy();
    expect(getReviewedImportCard("Cleaned Garlic Chicken Pasta")?.textContent).toContain("Chicken thighs");
    expect(getReviewedImportPreview()?.textContent).toContain("Cleaned Garlic Chicken Pasta");
    expect(getReviewedImportPreview()?.textContent).toContain("Season chicken.");
    expect(getReviewedImportPreview()?.textContent).toContain("Separate from curated verified recipes.");
    expect(getReviewedImportPreview()?.textContent).not.toContain("Verified recipe");
    expect(getReviewedImportPreview()?.textContent).not.toContain("Official recipe");
    expect(getResultCard("Cleaned Garlic Chicken Pasta")).toBeFalsy();
    expect(container.querySelectorAll(".results-card")).toHaveLength(4);
  });

  it("cancels reviewed import cleanup without changing the preview or card", async () => {
    fetchImportedRecipesMock.mockResolvedValueOnce([
      makeImportedRecipeRecord({
        import_id: "imp_cancel_cleanup",
        title: "Reviewed Cancel Noodles",
        ingredients: ["Noodles", "Miso"],
        instructions: ["Simmer noodles."],
      }),
    ]);

    await renderRecipeBrowser();

    click(Array.from(getReviewedImportCard("Reviewed Cancel Noodles")?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent === "Preview details"));
    await flushAsyncUpdates();
    click(getButton("Edit reviewed import"));

    const editor = container.querySelector<HTMLElement>(".browser-imported-cleanup-editor");
    changeInputValue(editor?.querySelector<HTMLInputElement>("input"), "Changed Cancel Noodles");
    click(getButton("Cancel cleanup"));

    expect(updateImportedRecipeCleanupMock).not.toHaveBeenCalled();
    expect(getReviewedImportCard("Reviewed Cancel Noodles")).toBeTruthy();
    expect(getReviewedImportCard("Changed Cancel Noodles")).toBeFalsy();
    expect(getReviewedImportPreview()?.textContent).toContain("Reviewed Cancel Noodles");
    expect(getReviewedImportPreview()?.textContent).not.toContain("Changed Cancel Noodles");
  });

  it("shows safe feedback when reviewed import cleanup save fails and keeps the editor usable", async () => {
    fetchImportedRecipesMock.mockResolvedValueOnce([
      makeImportedRecipeRecord({
        import_id: "imp_cleanup_failure",
        title: "Reviewed Failure Rice",
        ingredients: ["Rice", "Egg"],
        instructions: ["Cook rice."],
      }),
    ]);
    updateImportedRecipeCleanupMock.mockRejectedValueOnce(new Error("Reviewed import cleanup could not be saved."));

    await renderRecipeBrowser();

    click(Array.from(getReviewedImportCard("Reviewed Failure Rice")?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent === "Preview details"));
    await flushAsyncUpdates();
    click(getButton("Edit reviewed import"));

    const editor = container.querySelector<HTMLElement>(".browser-imported-cleanup-editor");
    changeInputValue(editor?.querySelector<HTMLInputElement>("input"), "Cleaned Failure Rice");
    click(getButton("Save reviewed import"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Reviewed import cleanup could not be saved.");
    expect(container.querySelector<HTMLElement>(".browser-imported-cleanup-editor")).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>(".browser-imported-cleanup-editor input")?.value).toBe("Cleaned Failure Rice");
    expect(getReviewedImportCard("Reviewed Failure Rice")).toBeTruthy();
    expect(getReviewedImportCard("Cleaned Failure Rice")).toBeFalsy();
    expect(getResultCard("Reviewed Failure Rice")).toBeFalsy();
  });

  it("does not show pending, needs-edit, or rejected review records in the ranked reviewed-import lane", async () => {
    fetchImportReviewsMock.mockResolvedValueOnce([
      makeImportReviewRecord({
        review_id: "ir_pending_ranked_lane",
        status: "pending_review",
        display_title: "Pending Ranked Lane Candidate",
      }),
      makeImportReviewRecord({
        review_id: "ir_needs_edit_ranked_lane",
        status: "needs_edit",
        display_title: "Needs Edit Ranked Lane Candidate",
      }),
      makeImportReviewRecord({
        review_id: "ir_rejected_ranked_lane",
        status: "rejected",
        display_title: "Rejected Ranked Lane Candidate",
      }),
    ]);
    fetchImportedRecipesMock.mockResolvedValueOnce([]);

    await renderRecipeBrowser();

    expect(container.textContent).toContain("Pending Ranked Lane Candidate");
    expect(container.textContent).toContain("Needs Edit Ranked Lane Candidate");
    expect(container.textContent).toContain("Rejected Ranked Lane Candidate");
    expect(getReviewedImportCard("Pending Ranked Lane Candidate")).toBeFalsy();
    expect(getReviewedImportCard("Needs Edit Ranked Lane Candidate")).toBeFalsy();
    expect(getReviewedImportCard("Rejected Ranked Lane Candidate")).toBeFalsy();
    expect(container.textContent).toContain("No reviewed external recipes have been imported yet.");
    expect(container.querySelectorAll(".results-card")).toHaveLength(4);
  });

  it("keeps main Recipe Browser usable when reviewed imports fail to load", async () => {
    fetchImportedRecipesMock.mockRejectedValueOnce(new Error("Imported reviews unavailable"));

    await renderRecipeBrowser();

    expect(container.textContent).toContain("Imported reviews unavailable");
    expect(container.textContent).toContain("American Beef Soup");
    expect(container.textContent).toContain("Living availability");
    expect(container.textContent).toContain("Import review queue");
    expect(container.querySelectorAll(".results-card")).toHaveLength(4);
  });

  it("shows safe feedback when import review queueing fails", async () => {
    const liveCandidate = makeDinnerTonightCandidate({
      source_id: "review-failure",
      display_title: "Review Failure Fried Rice",
    });
    fetchDinnerTonightCandidatesMock.mockResolvedValueOnce(
      makeDinnerTonightCandidatesResponse({
        best: liveCandidate,
        candidates: [liveCandidate],
      }),
    );
    createImportReviewMock.mockRejectedValueOnce(new Error("Review queue unavailable"));

    await renderRecipeBrowser();

    click(Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Inspect candidate"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    click(Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Mark for review"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Review queue unavailable");
    expect(container.textContent).not.toContain("Saved recipe");
    expect(getResultCard("Review Failure Fried Rice")).toBeFalsy();
    expect(container.querySelectorAll(".results-card")).toHaveLength(4);
  });

  it("shows a safe zero-live-candidate status while internal Browser results remain usable", async () => {
    fetchDinnerTonightCandidatesMock.mockResolvedValueOnce(
      makeDinnerTonightCandidatesResponse({
        best: null,
        candidates: [],
      }),
    );

    await renderRecipeBrowser();

    expect(container.textContent).toContain("No live candidates for this pantry state yet.");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    click(getTab("Cuisine"));
    click(getChip("Italian"));
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
  });

  it("sends selected_filters when a dynamic facet is selected", async () => {
    await renderRecipeBrowser();

    click(getLivingFacet("Cuban"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchDinnerTonightCandidatesMock).toHaveBeenLastCalledWith({
      ingredients: ["chicken", "garlic", "pasta"],
      limit: 10,
      selected_filters: { cuisine_tags: ["cuban"] },
      filter_mode: "all",
    });
    expect(getLivingFacet("Cuban")?.getAttribute("aria-pressed")).toBe("true");
    expect(getActiveFilterChip("Cuban")).toBeTruthy();
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).not.toContain("Italian Chicken Skillet");
  });

  it("cleans live facet display labels while preserving raw selected_filters values", async () => {
    fetchDinnerTonightCandidatesMock
      .mockResolvedValueOnce(
        makeDinnerTonightCandidatesResponse({
          filter_counts: {
            mode: "all",
            selected_filters: {},
            families: {
              ingredients: [
                { value: "bulbs garlic", count: 2 },
                { value: "chicken weighing 2.3kg", count: 1 },
                { value: "salt and pepper", count: 1 },
              ],
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        makeDinnerTonightCandidatesResponse({
          filter_counts: {
            mode: "all",
            selected_filters: { ingredients: ["bulbs garlic"] },
            families: {
              ingredients: [
                { value: "bulbs garlic", count: 1 },
                { value: "chicken weighing 2.3kg", count: 1 },
                { value: "salt and pepper", count: 1 },
              ],
            },
          },
        }),
      );

    await renderRecipeBrowser();

    expect(getLivingFacet("Garlic")).toBeTruthy();
    expect(getLivingFacet("Chicken")).toBeTruthy();
    expect(getLivingFacet("Salt and pepper")).toBeTruthy();
    expect(container.textContent).not.toContain("Bulbs Garlic");
    expect(container.textContent).not.toContain("Chicken Weighing 2.3kg");
    expect(container.textContent).not.toContain("Salt And Pepper");

    click(getLivingFacet("Garlic"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchDinnerTonightCandidatesMock).toHaveBeenLastCalledWith({
      ingredients: ["chicken", "garlic", "pasta"],
      limit: 10,
      selected_filters: { ingredients: ["bulbs garlic"] },
      filter_mode: "all",
    });
    expect(getSelectedLivingFacet("Garlic")?.textContent).toContain("Garlic");
    expect(getSelectedLivingFacet("Garlic")?.textContent).toContain("Availability only");
  });

  it("keeps unmappable live facets as availability constraints without filtering internal cards", async () => {
    fetchDinnerTonightCandidatesMock.mockResolvedValueOnce(
      makeDinnerTonightCandidatesResponse({
        filter_counts: {
          mode: "all",
          selected_filters: {},
          families: {
            dish_type_tags: [{ value: "fried rice", count: 2 }],
          },
        },
      }),
    );

    await renderRecipeBrowser();

    click(getLivingFacet("Fried Rice"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchDinnerTonightCandidatesMock).toHaveBeenLastCalledWith({
      ingredients: ["chicken", "garlic", "pasta"],
      limit: 10,
      selected_filters: { dish_type_tags: ["fried rice"] },
      filter_mode: "all",
    });
    expect(getSelectedLivingFacet("Fried Rice")?.textContent).toContain("Availability only");
    expect(getActiveFilterChip("Fried Rice")).toBeFalsy();
    expect(container.querySelectorAll(".results-card")).toHaveLength(4);
  });

  it("keeps selected dynamic facets removable when narrowed counts stop returning that value", async () => {
    fetchDinnerTonightCandidatesMock
      .mockResolvedValueOnce(makeDinnerTonightCandidatesResponse())
      .mockResolvedValueOnce(
        makeDinnerTonightCandidatesResponse({
          filter_counts: {
            mode: "all",
            selected_filters: { cuisine_tags: ["cuban"] },
            families: {
              cuisine_tags: [],
              method_tags: [{ value: "skillet", count: 1 }],
            },
          },
        }),
      );

    await renderRecipeBrowser();

    click(getLivingFacet("Cuban"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getLivingFacet("Cuban")).toBeFalsy();
    expect(getSelectedLivingFacet("Cuban")).toBeTruthy();
    expect(container.textContent).toContain("1 live facet shaping candidate availability.");

    click(getSelectedLivingFacet("Cuban"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getSelectedLivingFacet("Cuban")).toBeFalsy();
    expect(fetchDinnerTonightCandidatesMock).toHaveBeenLastCalledWith({
      ingredients: ["chicken", "garlic", "pasta"],
      limit: 10,
      selected_filters: {},
      filter_mode: "all",
    });
  });

  it("renders real Cost options from supported recipe metadata instead of a placeholder", async () => {
    await renderRecipeBrowser();

    click(getTab("Cost"));

    expect(getTab("Cost")?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Now browsingCost");
    expect(container.textContent).toContain("Choose a dinner lane by budget feel.");
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
      "Choose how much cleanup you want tonight.",
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
      "Show recipes with clear diet labels.",
    );
    expect(container.textContent).toContain("Vegetarian");
    expect(container.textContent).not.toContain("Vegan");
    expect(container.textContent).not.toContain("Diet filters are not wired yet");
  });

  it("renders real Household options from supported recipe metadata instead of a placeholder", async () => {
    await renderRecipeBrowser();

    click(getTab("Household"));

    expect(getTab("Household")?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Now browsingMeal Type");
    expect(container.textContent).toContain(
      "Choose the kind of dinner you need.",
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
    expect(container.textContent).toContain("Pick a style and recipes update as you choose.");
    expect(container.textContent).toContain("American");
    expect(container.textContent).toContain("Cuban");
    expect(container.textContent).toContain("Italian");
    expect(container.textContent).not.toContain("Mexican & Latin");
    expect(container.textContent).not.toContain("Asian");
    expect(container.textContent).not.toContain("Mediterranean & European");
    expect(container.textContent).not.toContain("BBQ");
    expect(container.textContent).not.toContain("Southern");
    expect(container.querySelector(".browser-filter-chip")?.textContent).not.toContain(
      RECIPE_BROWSER_MVP_FILTERS.ingredients.options[0].label,
    );
  });

  it("lets cuisine parents filter broadly before child styles narrow the cuisine family", async () => {
    fetchRecipeBrowserCatalogMock.mockResolvedValueOnce(
      makeCatalog([
        makeRecipe({ id: 21, name: "American Skillet", cuisine: "american" }),
        makeRecipe({ id: 22, name: "BBQ Chicken", cuisine: "bbq" }),
        makeRecipe({ id: 23, name: "Southern Chicken", cuisine: "southern" }),
        makeRecipe({ id: 24, name: "Chicken Tacos", cuisine: "mexican", tags: ["tacos"] }),
        makeRecipe({ id: 25, name: "Tex-Mex Chicken Quesadillas", cuisine: "tex_mex", tags: ["quesadillas"] }),
        makeRecipe({ id: 26, name: "Chicken Curry", cuisine: "indian", tags: ["curry"] }),
        makeRecipe({ id: 27, name: "Italian Chicken", cuisine: "italian" }),
      ]),
    );

    await renderRecipeBrowser();

    click(getTab("Cuisine"));

    expect(getChip("American")).toBeTruthy();
    expect(getChip("Mexican")).toBeTruthy();
    expect(getChip("Indian")).toBeTruthy();
    expect(getChip("Italian")).toBeTruthy();
    expect(getChip("Mexican & Latin")).toBeFalsy();
    expect(getChip("Asian")).toBeFalsy();
    expect(getChip("Mediterranean & European")).toBeFalsy();
    expect(getChip("BBQ")).toBeFalsy();
    expect(getChip("Southern")).toBeFalsy();
    expect(getChip("Tex-Mex")).toBeFalsy();

    click(getChip("American"));

    expect(getActiveFilterChip("American")).toBeTruthy();
    expect(getChip("BBQ")).toBeTruthy();
    expect(getChip("Southern")).toBeTruthy();
    expect(getChip("Comfort Food")).toBeFalsy();
    expect(container.textContent).toContain("3 eligible recipes");
    expect(container.textContent).toContain("American Skillet");
    expect(container.textContent).toContain("BBQ Chicken");
    expect(container.textContent).toContain("Southern Chicken");
    expect(container.textContent).not.toContain("Italian Chicken");

    click(getChip("BBQ"));

    expect(getActiveFilterChip("BBQ")).toBeTruthy();
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("BBQ Chicken");
    expect(container.textContent).not.toContain("American Skillet");
    expect(container.textContent).not.toContain("Southern Chicken");

    click(getActiveFilterChip("BBQ"));

    expect(getActiveFilterChip("BBQ")).toBeFalsy();
    expect(getActiveFilterChip("American")).toBeTruthy();
    expect(container.textContent).toContain("3 eligible recipes");

    click(getActiveFilterChip("American"));
    click(getTab("Cuisine"));
    click(getChip("Mexican"));
    expect(getActiveFilterChip("Mexican")).toBeTruthy();
    expect(getChip("Tex-Mex")).toBeTruthy();
    click(getChip("Tex-Mex"));
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Tex-Mex Chicken Quesadillas");
    expect(container.textContent).not.toContain("Chicken Tacos");

    click(getActiveFilterChip("Mexican"));
    click(getActiveFilterChip("Tex-Mex"));
    click(getTab("Cuisine"));
    click(getChip("Indian"));
    expect(getChip("Curry")).toBeTruthy();
    expect(getChip("Masala")).toBeFalsy();
  });

  it("keeps globally supported cuisine children visible when another filter is active", async () => {
    fetchRecipeBrowserCatalogMock.mockResolvedValueOnce(
      makeCatalog([
        makeRecipe({
          id: 31,
          name: "Chicken Pasta",
          cuisine: "italian",
          primary_protein: "chicken",
          ingredients: [
            {
              ingredient_id: 31,
              ingredient_name: "chicken",
              is_required: true,
              measurement_is_estimated: false,
            },
          ],
        }),
        makeRecipe({
          id: 32,
          name: "Southern Beef Supper",
          cuisine: "american",
          primary_protein: "beef",
          tags: ["southern"],
          ingredients: [
            {
              ingredient_id: 32,
              ingredient_name: "beef",
              is_required: true,
              measurement_is_estimated: false,
            },
          ],
        }),
        makeRecipe({
          id: 33,
          name: "BBQ Beef Supper",
          cuisine: "american",
          primary_protein: "beef",
          tags: ["bbq"],
          ingredients: [
            {
              ingredient_id: 33,
              ingredient_name: "beef",
              is_required: true,
              measurement_is_estimated: false,
            },
          ],
        }),
        makeRecipe({
          id: 34,
          name: "Comfort Food Beef Chili",
          cuisine: "american",
          primary_protein: "beef",
          tags: ["comfort food"],
          ingredients: [
            {
              ingredient_id: 34,
              ingredient_name: "beef",
              is_required: true,
              measurement_is_estimated: false,
            },
          ],
        }),
        makeRecipe({
          id: 35,
          name: "Tex-Mex Beef Quesadillas",
          cuisine: "mexican",
          primary_protein: "beef",
          tags: ["tex mex"],
          ingredients: [
            {
              ingredient_id: 35,
              ingredient_name: "beef",
              is_required: true,
              measurement_is_estimated: false,
            },
          ],
        }),
      ]),
    );

    await renderRecipeBrowser();

    click(getChip("Chicken & poultry"));
    expect(container.textContent).toContain("1 eligible recipe");

    click(getTab("Cuisine"));
    expect(getChip("American")).toBeTruthy();
    expect(getChip("Mexican")).toBeTruthy();

    click(getChip("American"));
    expect(getChip("Southern")).toBeTruthy();
    expect(getChip("BBQ")).toBeTruthy();
    expect(getChip("Comfort Food")).toBeTruthy();

    click(getActiveFilterChip("American"));
    click(getChip("Mexican"));
    expect(getChip("Tex-Mex")).toBeTruthy();
  });

  it("renders protein browse groups inside Ingredients instead of a top-level Protein tab", async () => {
    await renderRecipeBrowser();

    expect(getTab("Protein")).toBeFalsy();
    expect(getTab("Ingredients")?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Now browsingIngredients");
    expect(container.textContent).toContain("Proteins");
    expect(container.textContent).toContain("Chicken & poultry");
    expect(container.textContent).toContain("Beef");
    expect(container.textContent).toContain("Pork");
    expect(container.textContent).not.toContain("Protein filters are not wired yet");
  });

  it("hides main ingredient child bubbles until a parent ingredient filter is selected", async () => {
    await renderRecipeBrowser();

    expect(getChildChip("Bacon")).toBeFalsy();
    expect(getChildChip("Pork Chops")).toBeFalsy();
    expect(getChildChip("Sausage")).toBeFalsy();
  });

  it("reveals Pork child bubbles inline when Pork is selected", async () => {
    await renderRecipeBrowser();

    click(getChip("Pork"));

    expect(getChildChipLabels()).toEqual([
      "Bacon",
      "Pork Chops",
      "Sausage",
      "Ham",
      "Ground Pork",
      "Ribs",
      "Tenderloin",
    ]);
    expect(getChildChip("Ground Pork")?.getAttribute("aria-disabled")).toBe("true");
    expect(getChildChip("Ground Pork")?.disabled).toBe(true);
    expect(getChildChip("Ground Pork")?.getAttribute("aria-label")).toBe(
      "Ground Pork ingredient sub-filter planned for future taxonomy",
    );
    expect(getChildChip("Ribs")?.getAttribute("aria-disabled")).toBe("true");
    expect(getChildChip("Ribs")?.disabled).toBe(true);
    expect(container.querySelector(".browser-ingredient-leaf-tray")).toBeFalsy();
  });

  it("applies and clears selected Pork child filter state with the parent", async () => {
    await renderRecipeBrowser();

    click(getChip("Pork"));
    click(getChildChip("Bacon"));

    expect(getChildChip("Bacon")?.classList.contains("is-selected")).toBe(true);
    expect(getActiveFilterChip("Pork")).toBeTruthy();
    expect(getActiveFilterChip("Bacon")).toBeTruthy();

    click(getChip("Pork"));

    expect(getChildChip("Bacon")).toBeFalsy();
    expect(getActiveFilterChip("Pork")).toBeFalsy();
    expect(getActiveFilterChip("Bacon")).toBeFalsy();
  });

  it("renders inline child bubbles for other parent ingredient filters too", async () => {
    await renderRecipeBrowser();

    click(getChip("Chicken & poultry"));

    expect(getChildChip("Chicken Breast")).toBeTruthy();
    expect(getChildChip("Chicken Thighs")).toBeTruthy();
    expect(getChildChip("Ground Chicken")).toBeTruthy();
    expect(container.querySelector(".browser-ingredient-leaf-tray")).toBeFalsy();
  });

  it("keeps the default console practical while hiding specialty pantry families", async () => {
    await renderRecipeBrowser();

    expect(getTab("Ingredients")?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector(".browser-console-row--family")).toBeTruthy();
    expect(container.textContent).toContain("Proteins");
    expect(container.textContent).toContain("Beans & Legumes");
    expect(container.textContent).toContain("Grains, Pasta & Starches");
    expect(container.textContent).toContain("Fruits");
    expect(container.textContent).toContain("Oils & Fats");
    expect(container.textContent).toContain("Sauces & Condiments");
    expect(container.textContent).not.toContain("Drinks & Plant Milks");
    expect(container.textContent).not.toContain("Nuts, Seeds & Butters");
    expect(container.textContent).not.toContain("Pantry Basics");
    expect(container.textContent).not.toContain("Prepared / Not Core Pantry");
    expect(container.textContent).not.toContain("quinoa");
    expect(container.textContent).not.toContain("farro");
    expect(container.textContent).not.toContain("orange juice");
    expect(container.textContent).not.toContain("almond milk");
  });

  it("keeps Effort marked Later without opening an active panel", async () => {
    await renderRecipeBrowser();

    const effortTab = getTab("Effort");
    expect(effortTab?.hasAttribute("disabled")).toBe(true);
    click(effortTab);

    expect(effortTab?.getAttribute("aria-selected")).toBe("false");
    expect(container.textContent).toContain("Now browsingIngredients");
    expect(container.textContent).not.toContain("Now browsingEffort");
    expect(container.textContent).not.toContain("Difficulty");
  });

  it("marks each selected console depth with testable state hooks", async () => {
    fetchRecipeBrowserCatalogMock.mockResolvedValueOnce(
      makeCatalog([
        makeRecipe({
          id: 61,
          name: "Chicken Thigh Tray",
          primary_protein: "chicken thighs",
          ingredients: [
            {
              ingredient_id: 61,
              ingredient_name: "chicken thighs",
              is_required: true,
              measurement_is_estimated: false,
            },
          ],
        }),
      ]),
    );
    await renderRecipeBrowser();

    expect(getTab("Ingredients")?.getAttribute("data-console-depth")).toBe("top");
    expect(getTab("Ingredients")?.getAttribute("data-selected")).toBe("true");

    click(getIngredientFamilyButton("Proteins"));
    expect(getIngredientFamilyButton("Proteins")?.getAttribute("data-console-depth")).toBe("family");
    expect(getIngredientFamilyButton("Proteins")?.getAttribute("data-selected")).toBe("true");

    click(getChip("Chicken & poultry"));
    expect(getChip("Chicken & poultry")?.getAttribute("data-console-depth")).toBe("subfamily");
    expect(getChip("Chicken & poultry")?.getAttribute("data-selected")).toBe("true");

    click(getLeafChip("chicken thighs"));
    expect(getLeafChip("chicken thighs")?.getAttribute("data-console-depth")).toBe("leaf");
    expect(getLeafChip("chicken thighs")?.getAttribute("data-selected")).toBe("true");
    expect(getLeafChip("chicken thighs")?.getAttribute("aria-pressed")).toBe("true");
    expect(getLeafChip("chicken thighs")?.className).toContain("browser-console-bubble--leaf");
    expect(getLeafChip("chicken thighs")?.className).toContain("is-selected");
    expect(getActiveFilterChip("chicken thighs")).toBeTruthy();
  });

  it("exposes supported fruits, oils, and broth filters without surfacing pantry-basics noise", async () => {
    fetchRecipeBrowserCatalogMock.mockResolvedValueOnce(
      makeCatalog([
        makeRecipe({
          id: 91,
          name: "Lemon Butter Cod",
          ingredients: [
            {
              ingredient_id: 91,
              ingredient_name: "lemons",
              is_required: true,
              measurement_is_estimated: false,
            },
            {
              ingredient_id: 92,
              ingredient_name: "butter",
              is_required: true,
              measurement_is_estimated: false,
            },
          ],
        }),
        makeRecipe({
          id: 92,
          name: "Lime Olive Oil Chicken",
          ingredients: [
            {
              ingredient_id: 93,
              ingredient_name: "limes",
              is_required: true,
              measurement_is_estimated: false,
            },
            {
              ingredient_id: 94,
              ingredient_name: "olive oil",
              is_required: true,
              measurement_is_estimated: false,
            },
          ],
        }),
        makeRecipe({
          id: 93,
          name: "Chicken Broth Soup",
          ingredients: [
            {
              ingredient_id: 95,
              ingredient_name: "broth",
              is_required: true,
              measurement_is_estimated: false,
            },
          ],
        }),
      ]),
    );

    await renderRecipeBrowser();

    expect(getIngredientFamilyButton("Fruits")).toBeTruthy();
    expect(getIngredientFamilyButton("Oils & Fats")).toBeTruthy();
    expect(getIngredientFamilyButton("Pantry Basics")).toBeFalsy();

    click(getIngredientFamilyButton("Fruits"));
    click(getIngredientSubfamilyButton("Citrus"));
    expect(getLeafChip("lemons")).toBeTruthy();
    expect(getLeafChip("limes")).toBeTruthy();

    click(getIngredientFamilyButton("Oils & Fats"));
    click(getIngredientSubfamilyButton("Oils & fats"));
    expect(getLeafChip("butter")).toBeTruthy();
    expect(getLeafChip("olive oil")).toBeTruthy();

    click(getIngredientFamilyButton("Sauces & Condiments"));
    click(getIngredientSubfamilyButton("Broths & stocks"));
    expect(getLeafChip("broth")).toBeTruthy();
  });

  it("opens top-level ingredient families without making them active filters", async () => {
    await renderRecipeBrowser();

    click(getIngredientFamilyButton("Vegetables"));

    expect(getIngredientFamilyButton("Vegetables")?.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("No filters yet");
    expect(getActiveFilterChip("Vegetables")).toBeFalsy();
    expect(container.textContent).toContain("4 eligible recipes");
  });

  it("selects and deselects bubbles with active filters shown separately", async () => {
    await renderRecipeBrowser();

    const chickenChip = getChip("Chicken & poultry");
    click(chickenChip);

    expect(chickenChip?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Current recipe search stack");
    expect(getActiveFilterChip("chicken")).toBeTruthy();

    click(chickenChip);

    expect(chickenChip?.getAttribute("aria-pressed")).toBe("false");
    expect(container.textContent).toContain("No filters yet");
    expect(container.textContent).not.toContain("Current selections");
  });

  it("lets ingredient subfamilies filter broadly before leaf ingredients narrow the result set", async () => {
    fetchRecipeBrowserCatalogMock.mockResolvedValueOnce(
      makeCatalog([
        makeRecipe({
          id: 11,
          name: "Chicken Thigh Tray",
          primary_protein: "chicken thighs",
          ingredients: [
            {
              ingredient_id: 11,
              ingredient_name: "chicken thighs",
              is_required: true,
              measurement_is_estimated: false,
            },
          ],
        }),
        makeRecipe({
          id: 12,
          name: "Chicken Breast Pasta",
          primary_protein: "chicken breast",
          ingredients: [
            {
              ingredient_id: 12,
              ingredient_name: "chicken breast",
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

    click(getChip("Chicken & poultry"));

    expect(getActiveFilterChip("chicken")).toBeTruthy();
    expect(container.textContent).toContain("2 eligible recipes");
    expect(container.textContent).toContain("Chicken Thigh Tray");
    expect(container.textContent).toContain("Chicken Breast Pasta");
    expect(container.textContent).not.toContain("Beef Rice Bowl");
    expect(getLeafChip("chicken thighs")).toBeTruthy();

    click(getLeafChip("chicken thighs"));

    expect(getActiveFilterChip("chicken thighs")).toBeTruthy();
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Chicken Thigh Tray");
    expect(container.textContent).not.toContain("Chicken Breast Pasta");
  });

  it("preserves selections across tab changes", async () => {
    await renderRecipeBrowser();

    click(getChip("Chicken & poultry"));
    click(getTab("Cuisine"));
    click(getChip("Italian"));
    click(getTab("Ingredients"));

    expect(getChip("Chicken & poultry")?.getAttribute("aria-pressed")).toBe("true");
    expect(getActiveFilterChip("chicken")).toBeTruthy();
    expect(getActiveFilterChip("Italian")).toBeTruthy();
  });

  it("filters the live result set when a protein ingredient leaf is selected", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getIngredientFamilyButton("Beans & Legumes"));
    click(getChip("Tofu & plant protein"));
    click(getChip("tofu"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).not.toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(getActiveFilterChip("tofu")).toBeTruthy();
  });

  it("keeps protein ingredient filters working alongside existing family filters", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getChip("Chicken & poultry"));
    click(getTab("Method"));
    click(getChip("Skillet"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(container.textContent).not.toContain("Cuban Garlic Tofu Bake");
    expect(getActiveFilterChip("chicken")).toBeTruthy();
    expect(getActiveFilterChip("Skillet")).toBeTruthy();
  });

  it("updates the active filter strip cleanly when protein ingredient filters are added and removed", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getIngredientFamilyButton("Beans & Legumes"));
    click(getChip("Tofu & plant protein"));
    click(getChip("tofu"));

    expect(getActiveFilterChip("tofu")).toBeTruthy();

    click(getActiveFilterChip("tofu"));

    expect(getActiveFilterChip("tofu")).toBeFalsy();
    click(getTab("Ingredients"));
    expect(getChip("tofu")?.getAttribute("aria-pressed")).toBe("false");
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
    expect(container.textContent).toContain("100% ingredient coverage");
    expect(container.textContent).toContain("82% ingredient coverage");
    expect(container.textContent).toContain("2 eligible recipes");
  });

  it("dims zero-relevance filter choices while keeping them selectable for exploration", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getChip("Chicken & poultry"));
    click(getTab("Method"));

    const ovenChip = getChip("Oven");
    expect(ovenChip?.className).toContain("is-unavailable");
    expect(ovenChip?.textContent).toContain("No matches");
    expect(ovenChip?.hasAttribute("disabled")).toBe(false);

    click(ovenChip);

    expect(container.textContent).toContain("No recipes match this browser state");
    expect(getActiveFilterChip("Oven")).toBeTruthy();
  });

  it("renders stronger decision-support details on result cards with honest pantry-fit wording", async () => {
    await renderRecipeBrowser();

    const cookNowCard = getResultCard("American Beef Soup");
    const almostThereCard = getResultCard("Italian Chicken Skillet");

    expect(cookNowCard?.textContent).toContain("Ready to cook with what you have");
    expect(cookNowCard?.textContent).toContain("Coverage: Saved pantry covers 100% of required ingredient names");
    expect(cookNowCard?.textContent).toContain("Missing: Nothing missing from required ingredients");
    expect(cookNowCard?.textContent).toContain(
      "Eligible in this view and ranked against your saved pantry.",
    );

    expect(almostThereCard?.textContent).toContain("Almost there - missing 1 ingredient");
    expect(almostThereCard?.textContent).toContain("Coverage: Saved pantry covers 82% of required ingredient names");
    expect(almostThereCard?.textContent).toContain("Missing: Missing 1 required ingredient");
    expect(almostThereCard?.textContent).toContain("25 min");
    expect(almostThereCard?.textContent).toContain("Italian cuisine");
    expect(almostThereCard?.textContent).toContain("Easy effort");
  });

  it("renders curated recipe results as a compact table-card row with source trust fields", async () => {
    await renderRecipeBrowser();

    const result = getResultCard("American Beef Soup");

    expect(result?.textContent).toContain("Recipe name");
    expect(result?.textContent).toContain("Pantry fit");
    expect(result?.textContent).toContain("Missing items");
    expect(result?.textContent).toContain("Time");
    expect(result?.textContent).toContain("Source / trust");
    expect(result?.textContent).toContain("Status");
    expect(result?.textContent).toContain("Curated verified recipe");
    expect(result?.querySelector<HTMLAnchorElement>('a[href="/recipes/2"]')).toBeTruthy();
    expect(getReviewedImportCard("American Beef Soup")).toBeFalsy();
  });

  it("sorts Recipe Browser rows by the selected browser-only sort mode", async () => {
    await renderRecipeBrowser();

    expect(getResultTitles().slice(0, 2)).toEqual(["American Beef Soup", "Italian Chicken Skillet"]);

    changeSelectValue(
      container.querySelector<HTMLSelectElement>('select[aria-label="Sort Recipe Browser results"]'),
      "fastest",
    );

    expect(container.textContent).toContain("Sorted by: Fastest");
    expect(container.textContent).toContain("Dinner Tonight ranking is unchanged.");
    expect(getResultTitles().slice(0, 2)).toEqual(["Italian Chicken Skillet", "American Beef Soup"]);
  });

  it("keeps scope-based pantry-fit wording honest on result cards", async () => {
    await renderRecipeBrowser();

    click(getScopeChip("Cook Now"));

    const cookNowCard = getResultCard("American Beef Soup");

    expect(cookNowCard?.textContent).toContain("Ready to cook with what you have");
    expect(cookNowCard?.textContent).toContain("Showing because it lands in Cook Now.");
  });

  it("does not present 100% ingredient coverage with unknown quantities as ready to cook", async () => {
    const quantityCheckEntry = makeRecommendationEntry(1, "Italian Chicken Skillet", "almost_there", 1, 100);
    quantityCheckEntry.missing = {
      ...quantityCheckEntry.missing,
      count: 1,
      ingredients: ["chicken"],
      summary: "Need quantity confirmation for 1 ingredient: chicken.",
      quantity_confirmation_count: 1,
      quantity_confirmation_ingredients: ["chicken"],
    };
    quantityCheckEntry.cta = {
      ...quantityCheckEntry.cta,
      type: "cook_recipe",
      pantry_ready: false,
      missing_count: 0,
      missing_ingredients: [],
    };
    fetchRecommendationsMock.mockResolvedValueOnce({
      best_tonight: null,
      alternatives: [],
      closest_options: [quantityCheckEntry],
      cook_now: [],
      almost_there: [quantityCheckEntry],
      not_worth_it: [],
    });

    await renderRecipeBrowser();

    const card = getResultCard("Italian Chicken Skillet");

    expect(card?.textContent).toContain("Ingredients found - confirm amounts");
    expect(card?.textContent).toContain("Ingredients found - confirm amounts first");
    expect(card?.textContent).toContain("Missing: Confirm amount for 1 ingredient");
    expect(card?.textContent).not.toContain("Ready to cook with what you have");
    expect(card?.textContent).not.toContain("100% pantry match");
  });

  it("explains why a result matches the current supported browser filters", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getChip("Chicken & poultry"));
    click(getTab("Method"));
    click(getChip("Skillet"));

    const card = getResultCard("Italian Chicken Skillet");

    expect(card?.textContent).toContain("Matches current filters: chicken + Skillet.");
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
    click(getIngredientFamilyButton("Vegetables"));
    click(getChip("Aromatics & Alliums"));
    click(getChip("garlic"));
    click(getIngredientFamilyButton("Proteins"));
    click(getChip("Chicken & poultry"));
    click(getTab("Method"));
    click(getChip("Skillet"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(container.textContent).not.toContain("Cuban Garlic Tofu Bake");
    expect(container.textContent).toContain("Only 1 recipe remains in this view.");
  });

  it("includes descendant cuisines when a parent taxonomy filter is selected", async () => {
    fetchRecipeBrowserCatalogMock.mockResolvedValueOnce(
      makeCatalog([
        makeRecipe({ id: 31, name: "Mexican Chicken Tacos", cuisine: "mexican", tags: ["tacos"] }),
        makeRecipe({ id: 32, name: "Tex-Mex Chicken Quesadillas", cuisine: "tex_mex", tags: ["quesadillas"] }),
        makeRecipe({ id: 33, name: "Italian Chicken", cuisine: "italian" }),
      ]),
    );

    await renderRecipeBrowser();

    click(getTab("Cuisine"));
    click(getChip("Mexican"));

    expect(container.textContent).toContain("2 eligible recipes");
    expect(container.textContent).toContain("Mexican Chicken Tacos");
    expect(container.textContent).toContain("Tex-Mex Chicken Quesadillas");
    expect(container.textContent).not.toContain("Italian Chicken Skillet");
  });

  it("narrows to the selected taxonomy branch when a child cuisine filter is selected", async () => {
    fetchRecipeBrowserCatalogMock.mockResolvedValueOnce(
      makeCatalog([
        makeRecipe({ id: 34, name: "Mexican Chicken Tacos", cuisine: "mexican", tags: ["tacos"] }),
        makeRecipe({ id: 35, name: "Tex-Mex Chicken Quesadillas", cuisine: "tex_mex", tags: ["quesadillas"] }),
      ]),
    );

    await renderRecipeBrowser();

    click(getTab("Cuisine"));
    click(getChip("Mexican"));
    click(getChip("Tex-Mex"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Tex-Mex Chicken Quesadillas");
    expect(container.textContent).not.toContain("Mexican Chicken Tacos");
  });

  it("fails closed for unsupported metadata when a family is selected", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getChip("Chicken & poultry"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("Unsupported Egg Recipe");
  });

  it("shows recovery actions for filter-driven empty states instead of dead-ending", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getChip("Chicken & poultry"));
    click(getIngredientFamilyButton("Beans & Legumes"));
    click(getChip("Beans & legumes"));
    changeInputValue(getSearchInput(), "black beans");
    click(getSearchResult("black beans"));

    expect(container.textContent).toContain("No recipes match this browser state");
    expect(container.textContent).toContain(
      "No recipes match this stack yet. Try one recovery step to reopen dinner options.",
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
      "Try an explicit ingredient swap to reopen more options while keeping the exact-match story clear.",
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
      "These swaps are explicit, so your exact ingredient choice stays honest until you choose a broader path.",
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
    click(getIngredientFamilyButton("Beans & Legumes"));
    click(getChip("Beans & legumes"));
    changeInputValue(getSearchInput(), "quinoa");
    click(getSearchResult("quinoa"));
    click(getRecoveryAction("Remove latest filter: quinoa"));

    expect(getActiveFilterChip("quinoa")).toBeFalsy();
    expect(getActiveFilterChip("chicken")).toBeTruthy();
    expect(container.textContent).not.toContain("Ingredientsquinoa");
  });

  it("clears the latest active family from the empty-state recovery actions", async () => {
    await renderRecipeBrowser();

    click(getTab("Cuisine"));
    click(getChip("Cuban"));
    click(getScopeChip("Cook Now"));

    expect(container.textContent).toContain("No recipes match this browser state");
    click(getRecoveryAction("Clear Cuisine filter"));

    expect(container.textContent).not.toContain("No recipes match this browser state");
    expect(container.textContent).toContain("1 recipe in Cook Now");
    expect(container.textContent).toContain("American Beef Soup");
    expect(container.textContent).not.toContain("CuisineCuban");
    expect(getTab("Cuisine")?.getAttribute("aria-selected")).toBe("true");
  });

  it("keeps recovery-style empty states working after protein ingredient filtering", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
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

    click(getChip("Chicken & poultry"));
    click(getTab("Cuisine"));
    click(getChip("Italian"));
    click(getActiveFilterChip("chicken"));

    expect(getActiveFilterChip("chicken")).toBeFalsy();
    expect(getActiveFilterChip("Italian")).toBeTruthy();
    click(getTab("Ingredients"));
    expect(getChip("Chicken & poultry")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("clears all selected filters at once", async () => {
    await renderRecipeBrowser();

    click(getChip("Chicken & poultry"));
    click(getTab("Cuisine"));
    click(getChip("Italian"));
    click(container.querySelector(".browser-active-filters-clear"));

    expect(container.textContent).not.toContain("Current selections");
    expect(container.textContent).toContain("No filters yet");
    click(getTab("Ingredients"));
    expect(getChip("Chicken & poultry")?.getAttribute("aria-pressed")).toBe("false");
    click(getTab("Cuisine"));
    expect(getChip("Italian")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("saves and loads the current Recipe Browser search locally", async () => {
    await renderRecipeBrowser();

    click(getTab("Cuisine"));
    click(getChip("Italian"));
    click(getButton("Save current search"));

    expect(container.textContent).toContain("Saved current search on this device.");

    click(getButton("Clear all filters"));
    expect(getActiveFilterChip("Italian")).toBeFalsy();

    click(getButton("Load saved search"));

    expect(container.textContent).toContain("Loaded saved search from this device.");
    expect(getActiveFilterChip("Italian")).toBeTruthy();
    expect(getChip("Italian")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("applies control board display toggles without changing reviewed import separation", async () => {
    fetchImportedRecipesMock.mockResolvedValueOnce([
      makeImportedRecipeRecord({
        import_id: "imp_toggle",
        title: "Reviewed Toggle Soup",
      }),
    ]);

    await renderRecipeBrowser();

    click(getCheckbox("Show only missing one item"));

    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");

    click(getCheckbox("Show reviewed imports only"));

    expect(container.textContent).toContain("Curated results hidden");
    expect(getReviewedImportCard("Reviewed Toggle Soup")).toBeTruthy();
    expect(getResultCard("Reviewed Toggle Soup")).toBeFalsy();
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

    expect(container.textContent).toContain("Beans & Legumes");
    expect(container.textContent).toContain("Vegetables");
    expect(container.textContent).toContain("Herbs, Spices & Seasonings");
    expect(container.textContent).toContain("Sauces & Condiments");
  });

  it("renders Recipe Browser ingredient groups and expanded leaves in alphabetical label order", async () => {
    await renderRecipeBrowser();

    click(getTab("Ingredients"));
    click(getIngredientFamilyButton("Vegetables"));

    expect(getBrowseGroupTitlesForFamily("Vegetables")).toEqual([
      "Aromatics & Alliums",
      "Peppers & chiles",
      "Leafy greens",
      "Brassicas",
      "Root Vegetables",
      "Squash",
      "Other Vegetables",
      "Tomatoes",
      "Mushrooms",
    ]);

    click(getChip("Squash"));

    expect(getChip("Squash")?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".browser-ingredient-leaf-tray")?.textContent).toContain(
      "No exact recipes yet for the narrower items here.",
    );
    expect(getExpandedLeafTitles()).toEqual([]);
    expect(getActiveFilterChip("Squash")).toBeFalsy();
    expect(getChip("Squash")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("returns taxonomy-backed ingredient search matches for canonical ingredients and aliases", async () => {
    await renderRecipeBrowser();

    changeInputValue(getSearchInput(), "lentil");
    expect(getSearchResult("lentils")?.textContent).toContain("Beans & legumes");

    changeInputValue(getSearchInput(), "salsa verde");
    expect(getSearchResult("salsa verde")?.textContent).toContain("Regional sauces & pastes");

    changeInputValue(getSearchInput(), "spaghetti");
    expect(getSearchResult("spaghetti")?.textContent).toContain("Try pasta instead");
  });

  it("applies the correct ingredient filter when a search result is selected and keeps ingredient chips working", async () => {
    await renderRecipeBrowser();

    changeInputValue(getSearchInput(), "pasta");
    click(getSearchResult("pasta"));

    expect(container.textContent).toContain("Current recipe search stack");
    expect(getActiveFilterChip("pasta")).toBeTruthy();
    expect(container.textContent).toContain("1 eligible recipe");
    expect(container.textContent).toContain("Italian Chicken Skillet");
    expect(container.textContent).not.toContain("American Beef Soup");
    expect(getTab("Ingredients")?.getAttribute("aria-selected")).toBe("true");

    click(getIngredientFamilyButton("Vegetables"));
    click(getChip("Aromatics & Alliums"));
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
    expect(getChip("Pasta & noodles")?.getAttribute("aria-pressed")).toBe("true");
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
