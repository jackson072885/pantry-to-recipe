import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import RecommendationGroups from "./RecommendationGroups";
import type { RecommendationsResponse } from "../lib/mvpApi";

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
    expect(html).toContain("Get 1 Missing Ingredient");
    expect(html).toContain('href="/recipes/1"');
    expect(html).toContain("https://www.walmart.com/search?q=onion");
  });
});
