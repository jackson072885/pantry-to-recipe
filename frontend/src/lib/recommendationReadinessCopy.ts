import type { RecommendationEntry } from "./mvpApi";

export function getQuantityConfirmationCount(entry: RecommendationEntry): number {
  return entry.missing.quantity_confirmation_count ?? 0;
}

export function getShoppingMissingCount(entry: RecommendationEntry): number {
  return entry.cta?.missing_count ?? entry.recipe.missing_count ?? entry.missing.count;
}

export function isReadyToCook(entry: RecommendationEntry): boolean {
  return entry.cta?.pantry_ready === true
    && entry.missing.count === 0
    && getQuantityConfirmationCount(entry) === 0;
}

export function getReadinessBadgeLabel(entry: RecommendationEntry): string {
  const shoppingMissingCount = getShoppingMissingCount(entry);
  const quantityConfirmationCount = getQuantityConfirmationCount(entry);

  if (isReadyToCook(entry)) {
    return "Ready to cook";
  }

  if (quantityConfirmationCount > 0 && shoppingMissingCount === 0) {
    return "Confirm amounts";
  }

  if (quantityConfirmationCount > 0) {
    return "Quantity check needed";
  }

  if (shoppingMissingCount === 1) {
    return "Missing 1 item";
  }

  if (shoppingMissingCount > 1) {
    return `Missing ${shoppingMissingCount} items`;
  }

  return "Check readiness";
}

export function getIngredientCoverageLabel(entry: RecommendationEntry): string {
  const coverage = Math.round(entry.recipe.pantry_coverage_pct);

  if (isReadyToCook(entry)) {
    return `${coverage}% ingredient coverage`;
  }

  if (coverage === 100 && getQuantityConfirmationCount(entry) > 0) {
    return "Ingredients found - confirm amounts";
  }

  return `${coverage}% ingredient coverage`;
}

export function getReadinessDecisionLabel(entry: RecommendationEntry): string {
  const shoppingMissingCount = getShoppingMissingCount(entry);
  const quantityConfirmationCount = getQuantityConfirmationCount(entry);

  if (isReadyToCook(entry)) {
    return "Ready to cook with what you have";
  }

  if (quantityConfirmationCount > 0 && shoppingMissingCount === 0) {
    return "You may have this - confirm amounts first";
  }

  if (quantityConfirmationCount > 0) {
    return "Closest match with a quantity check";
  }

  if (shoppingMissingCount > 0) {
    return shoppingMissingCount === 1 ? "Almost there - needs 1 more item" : `Almost there - needs ${shoppingMissingCount} more items`;
  }

  return "Open Recipe Detail to confirm readiness";
}
