import type { RecommendationEntry, RecommendationsResponse } from "./mvpApi";
import { isReadyToCook } from "./recommendationReadinessCopy";

export function selectBestDinnerOption(recommendations: RecommendationsResponse | null): RecommendationEntry | null {
  if (!recommendations) return null;
  if (recommendations.best_tonight) return recommendations.best_tonight;

  const surfacedFallback = recommendations.alternatives[0]
    ?? recommendations.closest_options?.[0]
    ?? recommendations.cook_now[0]
    ?? recommendations.almost_there[0]
    ?? recommendations.not_worth_it[0];

  if (recommendations.recommendation_status === "no_strong_match") return surfacedFallback ?? null;

  return recommendations.recommendation_status
    ? null
    : surfacedFallback ?? null;
}

export function getHeroPrimaryActionLabel(entry: RecommendationEntry): string {
  return entry.missing.count === 0 ? "Cook This Tonight" : "View Recipe";
}

export function buildHeroTrustExplanation(
  entry: RecommendationEntry,
  runnerUp?: RecommendationEntry | null,
): string {
  const missingCount = entry.missing.count;
  const time = entry.recipe.estimated_time_minutes;
  const coverage = entry.recipe.pantry_coverage_pct;
  const behavior = entry.behavior;
  const scoreBreakdown = entry.score_breakdown;
  const matchedIngredients = behavior?.ingredient_matches?.map((match) => match.ingredient).slice(0, 2) ?? [];
  const summaryParts: string[] = [];

  if (missingCount === 0) {
    summaryParts.push("Ready from your pantry");
  } else {
    summaryParts.push(entry.missing.summary.replace(/\.$/, ""));
  }

  if (typeof time === "number") {
    summaryParts.push(`about ${time} min`);
  }

  if (entry.confidence_label) {
    summaryParts.push(`${entry.confidence_label} confidence`);
  }

  if (behavior?.has_signal || scoreBreakdown?.behavior_applied) {
    summaryParts.push("small history boost");
  }

  if (behavior?.has_signal || scoreBreakdown?.behavior_applied) {
    const behaviorClause = matchedIngredients.length > 0
      ? `recent activity on ${matchedIngredients.join(", ")} broke a close call`
      : "recent activity broke a close call";

    if (missingCount === 0) {
      return `${summaryParts.join(" • ")}. It won because it is ready now from your pantry, and ${behaviorClause}.`;
    }

    return `${summaryParts.join(" • ")}. It surfaced first because it is still within reach tonight, and ${behaviorClause}.`;
  }

  if (runnerUp && runnerUp.recipe.recipe_id !== entry.recipe.recipe_id) {
    if (entry.missing.count < runnerUp.missing.count) {
      return `${summaryParts.join(" • ")}. It surfaced first because it leaves you with fewer gaps than the next option: ${entry.missing.count} missing versus ${runnerUp.missing.count}.`;
    }

    const entryTime = typeof time === "number" ? time : null;
    const runnerUpTime = typeof runnerUp.recipe.estimated_time_minutes === "number"
      ? runnerUp.recipe.estimated_time_minutes
      : null;
    if (entryTime !== null && runnerUpTime !== null && entryTime < runnerUpTime) {
      return `${summaryParts.join(" • ")}. It surfaced first because it is the faster realistic option tonight: ${entryTime} minutes versus ${runnerUpTime}.`;
    }
  }

  if (isReadyToCook(entry)) {
    if (typeof time === "number") {
      return `${summaryParts.join(" • ")}. It won because you already have everything required and it stays weeknight-friendly at about ${time} minutes.`;
    }
    return `${summaryParts.join(" • ")}. It won because you already have everything required to cook it tonight.`;
  }

  if (missingCount === 1) {
    if (typeof time === "number" && time <= 30) {
      return `${summaryParts.join(" • ")}. It is the closest match because you are only missing one ingredient and it is still one of the faster realistic options tonight.`;
    }
    return `${summaryParts.join(" • ")}. It is the closest match because you are only missing one ingredient and it remains the closest realistic dinner choice.`;
  }

  if (coverage >= 75) {
    return `${summaryParts.join(" • ")}. It is the closest match because you already have ${coverage}% of the required ingredients and it is still within reach tonight.`;
  }

  return `${summaryParts.join(" • ")}. It is the closest realistic option from your current pantry.`;
}

export function buildBestOptionComparison(
  winner: RecommendationEntry,
  runnerUp: RecommendationEntry | null | undefined,
): string | null {
  if (!runnerUp) return null;

  if (winner.missing.count !== runnerUp.missing.count) {
    const ingredientGap = runnerUp.missing.count - winner.missing.count;
    if (ingredientGap > 0) {
      return `It needs ${ingredientGap} fewer ingredient${ingredientGap === 1 ? "" : "s"} than the next option.`;
    }
  }

  const coverageGap = winner.recipe.pantry_coverage_pct - runnerUp.recipe.pantry_coverage_pct;
  if (coverageGap > 0) {
    return `It covers ${coverageGap}% more of the pantry than the next option.`;
  }

  const winnerTime = winner.recipe.estimated_time_minutes;
  const runnerUpTime = runnerUp.recipe.estimated_time_minutes;
  if (typeof winnerTime === "number" && typeof runnerUpTime === "number" && winnerTime < runnerUpTime) {
    return `It gets dinner on the table about ${runnerUpTime - winnerTime} minutes faster than the next option.`;
  }

  if (winner.behavior?.has_signal && !runnerUp.behavior?.has_signal) {
    return "Recent activity nudged it ahead once the pantry fit was already close.";
  }

  return null;
}

export function buildBehaviorTrustNote(entry: RecommendationEntry): string | null {
  if (!entry.behavior?.has_signal) return null;

  if (entry.behavior.direct_recipe_points > 0 && entry.behavior.ingredient_matches.length > 0) {
    return "Recent activity on this recipe and similar ingredients gave it a small tie-break boost.";
  }

  if (entry.behavior.direct_recipe_points > 0) {
    return "Recent activity on this recipe gave it a small tie-break boost.";
  }

  if (entry.behavior.ingredient_matches.length > 0) {
    return "Recent activity on similar ingredients gave it a small tie-break boost.";
  }

  return "Recent activity gave it a small tie-break boost.";
}

export function buildEffortSummary(entry: RecommendationEntry): string {
  const time = entry.recipe.estimated_time_minutes;
  const difficulty = entry.recipe.difficulty?.toLowerCase();
  const simplicity = entry.recipe.simplicity ?? 1;

  if (typeof time === "number" && time <= 20 && simplicity >= 1.1) {
    return "Fast and low-friction";
  }
  if (typeof time === "number" && time <= 35) {
    return "Weeknight-friendly effort";
  }
  if (difficulty === "advanced" || difficulty === "hard" || simplicity < 0.9) {
    return "Higher-effort cook";
  }
  return "Moderate effort";
}
