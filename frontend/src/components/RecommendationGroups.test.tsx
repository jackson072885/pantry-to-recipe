// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RecommendationGroups from "./RecommendationGroups";
import type { RecommendationsResponse } from "../lib/mvpApi";

const {
  trackCtaClickedMock,
  trackCtaRenderedMock,
  trackEventMock,
  trackOutboundLinkOpenedMock,
} = vi.hoisted(() => ({
  trackCtaClickedMock: vi.fn().mockResolvedValue(true),
  trackCtaRenderedMock: vi.fn().mockResolvedValue(true),
  trackEventMock: vi.fn().mockResolvedValue(true),
  trackOutboundLinkOpenedMock: vi.fn().mockResolvedValue(true),
}));

vi.mock("../lib/tracking", () => ({
  trackCtaClicked: trackCtaClickedMock,
  trackCtaRendered: trackCtaRenderedMock,
  trackEvent: trackEventMock,
  trackOutboundLinkOpened: trackOutboundLinkOpenedMock,
}));

const recommendations: RecommendationsResponse = {
  best_tonight: null,
  alternatives: [],
  cook_now: [
    {
      recipe: {
        recipe_id: 1,
        recipe_name: "Chicken Rice Bowl",
        short_description: "Skillet dinner built around chicken, rice, and soy sauce.",
        servings: 3,
        difficulty: "easy",
        meal_type: "dinner",
        is_weeknight_friendly: true,
        is_beginner_friendly: true,
        present_required_count: 3,
        required_count: 3,
        pantry_coverage_pct: 100,
        missing_count: 0,
        missing_ingredients: [],
        estimated_time_minutes: 20,
        simplicity: 1.2,
      },
      explanation: "Selected because you have everything.",
      why_best: "Chicken Rice Bowl is ready without a store stop.",
      recommendation_type: "cook_now",
      confidence_score: 0.93,
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
        internal_path: "/recipes/1",
        affiliate_query: "",
        missing_count: 0,
        missing_ingredients: [],
      },
      tonight_score: 0.9,
    },
  ],
  almost_there: [
    {
      recipe: {
        recipe_id: 2,
        recipe_name: "Bean Skillet",
        short_description: "Quick stovetop dinner with beans and onion.",
        servings: 2,
        difficulty: "easy",
        meal_type: "dinner",
        quality_bucket: "KEEP_AND_ENRICH",
        present_required_count: 2,
        required_count: 3,
        pantry_coverage_pct: 67,
        missing_count: 1,
        missing_ingredients: ["onion"],
        estimated_time_minutes: 25,
        simplicity: 1.0,
      },
      explanation: "Missing one ingredient.",
      why_best: "Bean Skillet is one quick ingredient away.",
      recommendation_type: "almost_there",
      confidence_score: 0.68,
      confidence_label: "medium",
      missing: {
        count: 1,
        ingredients: ["onion"],
        summary: "Missing 1 ingredient: onion.",
      },
      cta: {
        type: "shop_missing_ingredients",
        label: "Get 1 Missing Ingredient",
        pantry_ready: false,
        internal_path: "/recipes/2",
        affiliate_query: "onion",
        missing_count: 1,
        missing_ingredients: ["onion"],
      },
    },
  ],
  not_worth_it: [],
};

describe("RecommendationGroups", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    trackCtaClickedMock.mockClear();
    trackCtaRenderedMock.mockClear();
    trackEventMock.mockClear();
    trackOutboundLinkOpenedMock.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders recommendation group titles and recipe names", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RecommendationGroups recommendations={recommendations} />
      </MemoryRouter>,
    );

    expect(html).toContain("Cook Now");
    expect(html).toContain("Almost There");
    expect(html).toContain("Chicken Rice Bowl");
    expect(html).toContain("Bean Skillet");
    expect(html).toContain("Weeknight-friendly");
    expect(html).toContain("3/3 required on hand");
  });

  it("renders internal and external next-step CTAs based on missing ingredients", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RecommendationGroups recommendations={recommendations} />
      </MemoryRouter>,
    );

    expect(html).toContain("Cook This Tonight");
    expect(html).toContain("Search Walmart for 1 missing ingredient");
    expect(html).toContain('href="/recipes/1"');
    expect(html).toContain("https://www.walmart.com/search?q=onion");
    expect(html).toContain("Opens a Walmart search in a new tab for onion.");
  });

  it("tracks outbound CTA clicks consistently with the rendered Walmart handoff", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <RecommendationGroups recommendations={recommendations} />
        </MemoryRouter>,
      );
    });

    const outboundCta = Array.from(container.querySelectorAll("a")).find((link) =>
      link.textContent?.includes("Search Walmart for 1 missing ingredient"),
    );

    expect(outboundCta?.getAttribute("href")).toBe("https://www.walmart.com/search?q=onion");

    await act(async () => {
      outboundCta?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(trackCtaRenderedMock).toHaveBeenCalledWith(2, expect.objectContaining({ destination: "outbound", missing_count: 1 }));
    expect(trackCtaClickedMock).toHaveBeenCalledWith(2, expect.objectContaining({ destination: "outbound" }));
    expect(trackEventMock).toHaveBeenCalledWith(
      "ingredients_requested",
      expect.objectContaining({
        recipeId: 2,
        metadata: expect.objectContaining({ missing_count: 1, missing_ingredients: ["onion"] }),
      }),
    );
    expect(trackOutboundLinkOpenedMock).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ href: "https://www.walmart.com/search?q=onion", missing_count: 1, missing_ingredients: ["onion"] }),
    );
  });
});
