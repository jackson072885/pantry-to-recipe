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
        pantry_coverage_pct: 100,
        missing_count: 0,
        missing_ingredients: [],
        estimated_time_minutes: 20,
        simplicity: 1.2,
      },
      explanation: "Selected because you have everything.",
      tonight_score: 0.9,
    },
  ],
  almost_there: [
    {
      recipe: {
        recipe_id: 2,
        recipe_name: "Bean Skillet",
        pantry_coverage_pct: 67,
        missing_count: 1,
        missing_ingredients: ["onion"],
        estimated_time_minutes: 25,
        simplicity: 1.0,
      },
      explanation: "Missing one ingredient.",
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

    expect(html).toContain("Cook Tonight");
    expect(html).toContain("One Quick Store Stop");
    expect(html).toContain("Chicken Rice Bowl");
    expect(html).toContain("Bean Skillet");
  });

  it("renders one CTA that stays internal for cook-now and external for missing ingredients", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <RecommendationGroups recommendations={recommendations} />
      </MemoryRouter>,
    );

    expect(html).toContain("Cook This Tonight");
    expect(html).toContain('href="/recipes/1"');
    expect(html).toContain("https://www.walmart.com/search?q=onion");
  });
});

