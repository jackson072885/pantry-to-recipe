import type { RecommendationEntry, RecommendationsResponse } from "./mvpApi";

export function selectBestDinnerOption(recommendations: RecommendationsResponse | null): RecommendationEntry | null {
  if (!recommendations) return null;
  if (recommendations.recommendation_status === "no_strong_match") return null;
  return recommendations.best_tonight
    ?? (recommendations.recommendation_status
      ? null
      : recommendations.cook_now[0]
        ?? recommendations.almost_there[0]
        ?? recommendations.not_worth_it[0])
    ?? null;
}

export function getHeroPrimaryActionLabel(entry: RecommendationEntry): string {
  return entry.missing.count === 0 ? "Cook This Tonight" : "View Recipe";
}

export function buildHeroTrustExplanation(entry: RecommendationEntry): string {
  const missingCount = entry.missing.count;
  const confidence = entry.confidence_label;
  const time = entry.recipe.estimated_time_minutes;
  const coverage = entry.recipe.pantry_coverage_pct;

  if (missingCount === 0) {
    if (typeof time === "number" && time <= 30 && confidence === "high") {
      return "Chosen because you already have everything and it is one of your fastest high-confidence meals.";
    }
    if (confidence === "high") {
      return "Chosen because you already have everything on hand and it scores well for tonight.";
    }
    if (typeof time === "number" && time <= 30) {
      return "Chosen because you already have everything and it is a fast option for tonight.";
    }
    return "Chosen because you already have everything needed to make it tonight.";
  }

  if (missingCount === 1) {
    if (typeof time === "number" && time <= 30) {
      return "Chosen because you are only missing one ingredient and it is still one of your faster options tonight.";
    }
    return "Chosen because you are only missing one ingredient and it still scores well for tonight.";
  }

  if (coverage >= 75) {
    return `Chosen because you already have ${coverage}% of the ingredients and it is still within reach tonight.`;
  }

  return "Chosen because it is the closest realistic option from your current pantry.";
}
