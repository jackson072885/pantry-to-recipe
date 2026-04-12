import type { RecommendationEntry, RecommendationsResponse, RecipeDetail } from "./mvpApi";

export type RecipeBrowserPantryFitState = "cook_now" | "almost_there" | "pantry_stretch";

export type RecipeBrowserPantryFit = {
  state: RecipeBrowserPantryFitState;
  badgeLabel: string;
  summary: string;
  pantryCoveragePct: number | null;
  missingCount: number;
};

export type RankedRecipeBrowserRecipe<TRecipe extends Pick<RecipeDetail, "id">> = {
  recipe: TRecipe;
  pantryFit: RecipeBrowserPantryFit | null;
};

type RecommendationLookupEntry = {
  pantryFit: RecipeBrowserPantryFit;
  rankIndex: number;
};

const PANTRY_FIT_LABELS: Record<RecipeBrowserPantryFitState, string> = {
  cook_now: "Cook Now",
  almost_there: "Almost There",
  pantry_stretch: "Pantry Stretch",
};

function mapRecommendationTypeToPantryFitState(
  recommendationType: RecommendationEntry["recommendation_type"],
): RecipeBrowserPantryFitState {
  if (recommendationType === "cook_now") {
    return "cook_now";
  }

  if (recommendationType === "almost_there") {
    return "almost_there";
  }

  return "pantry_stretch";
}

function buildPantryFitSummary(entry: RecommendationEntry, state: RecipeBrowserPantryFitState): string {
  const missingCount = entry.missing?.count ?? entry.recipe.missing_count ?? 0;
  const missingSummary = entry.missing?.summary?.trim();

  if (state === "cook_now") {
    return "Everything required is already covered by your saved pantry.";
  }

  if (missingSummary && missingSummary !== "No missing ingredients.") {
    return missingSummary;
  }

  if (state === "almost_there") {
    if (missingCount === 1) {
      return "One ingredient away from being practical tonight.";
    }

    return "Close to ready, but still missing a small piece.";
  }

  if (missingCount <= 1) {
    return "Still not a confident tonight option from your current pantry.";
  }

  return `Still a pantry stretch tonight with ${missingCount} required items missing.`;
}

function buildRecommendationLookup(
  recommendations: RecommendationsResponse | null,
): Map<number, RecommendationLookupEntry> {
  if (!recommendations) {
    return new Map();
  }

  const orderedEntries = [
    ...recommendations.cook_now,
    ...recommendations.almost_there,
    ...recommendations.not_worth_it,
  ];

  return new Map(
    orderedEntries.map((entry, rankIndex) => {
      const state = mapRecommendationTypeToPantryFitState(entry.recommendation_type);
      const missingCount = entry.missing?.count ?? entry.recipe.missing_count ?? 0;

      return [
        entry.recipe.recipe_id,
        {
          rankIndex,
          pantryFit: {
            state,
            badgeLabel: PANTRY_FIT_LABELS[state],
            summary: buildPantryFitSummary(entry, state),
            pantryCoveragePct:
              typeof entry.recipe.pantry_coverage_pct === "number" ? entry.recipe.pantry_coverage_pct : null,
            missingCount,
          },
        },
      ];
    }),
  );
}

export function rankRecipeBrowserRecipes<TRecipe extends Pick<RecipeDetail, "id">>(
  recipes: TRecipe[],
  recommendations: RecommendationsResponse | null,
): RankedRecipeBrowserRecipe<TRecipe>[] {
  const recommendationLookup = buildRecommendationLookup(recommendations);

  return recipes
    .map((recipe, originalIndex) => {
      const recommendation = recommendationLookup.get(recipe.id);

      return {
        recipe,
        pantryFit: recommendation?.pantryFit ?? null,
        originalIndex,
        recommendationRankIndex: recommendation?.rankIndex ?? Number.POSITIVE_INFINITY,
      };
    })
    .sort((left, right) => {
      if (left.recommendationRankIndex !== right.recommendationRankIndex) {
        return left.recommendationRankIndex - right.recommendationRankIndex;
      }

      return left.originalIndex - right.originalIndex;
    })
    .map(({ recipe, pantryFit }) => ({ recipe, pantryFit }));
}
