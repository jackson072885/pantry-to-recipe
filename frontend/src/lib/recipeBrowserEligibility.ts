import type { RecipeDetail } from "./mvpApi";
import {
  RECIPE_BROWSER_MVP_FILTERS,
  deriveRecipeBrowserTimeBucket,
  normalizeRecipeBrowserProteinFamily,
  type RecipeBrowserMvpCuisineId,
  type RecipeBrowserMvpDifficultyId,
  type RecipeBrowserMvpFilterFamilyId,
  type RecipeBrowserMvpFilterValueId,
  type RecipeBrowserMvpMethodId,
  type RecipeBrowserMvpProteinFamilyId,
  type RecipeBrowserMvpTimeBucketId,
} from "./recipeBrowserMvp";

export type RecipeBrowserSelectedFilters = Record<
  RecipeBrowserMvpFilterFamilyId,
  RecipeBrowserMvpFilterValueId[]
>;

export type RecipeBrowserEligibleMetadata = {
  protein: RecipeBrowserMvpProteinFamilyId | null;
  cuisine: RecipeBrowserMvpCuisineId | null;
  time: RecipeBrowserMvpTimeBucketId | null;
  difficulty: RecipeBrowserMvpDifficultyId | null;
  method: RecipeBrowserMvpMethodId | null;
};

function normalizeSupportedCuisine(cuisine: string | null | undefined): RecipeBrowserMvpCuisineId | null {
  const normalized = cuisine?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return RECIPE_BROWSER_MVP_FILTERS.cuisine.options.some((option) => option.id === normalized)
    ? (normalized as RecipeBrowserMvpCuisineId)
    : null;
}

function normalizeSupportedDifficulty(difficulty: string | null | undefined): RecipeBrowserMvpDifficultyId | null {
  const normalized = difficulty?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return RECIPE_BROWSER_MVP_FILTERS.difficulty.options.some((option) => option.id === normalized)
    ? (normalized as RecipeBrowserMvpDifficultyId)
    : null;
}

function normalizeSupportedMethod(method: string | null | undefined): RecipeBrowserMvpMethodId | null {
  const normalized = method?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return RECIPE_BROWSER_MVP_FILTERS.method.options.some((option) => option.id === normalized)
    ? (normalized as RecipeBrowserMvpMethodId)
    : null;
}

export function deriveRecipeBrowserEligibleMetadata(recipe: Pick<
  RecipeDetail,
  "primary_protein" | "cuisine" | "total_time_minutes" | "difficulty" | "cook_method"
>): RecipeBrowserEligibleMetadata {
  return {
    protein: normalizeRecipeBrowserProteinFamily(recipe.primary_protein),
    cuisine: normalizeSupportedCuisine(recipe.cuisine),
    time: deriveRecipeBrowserTimeBucket(recipe.total_time_minutes),
    difficulty: normalizeSupportedDifficulty(recipe.difficulty),
    method: normalizeSupportedMethod(recipe.cook_method),
  };
}

function matchesFamily(
  selectedValues: RecipeBrowserMvpFilterValueId[],
  candidateValue: RecipeBrowserMvpFilterValueId | null,
): boolean {
  if (selectedValues.length === 0) {
    return true;
  }

  if (candidateValue === null) {
    return false;
  }

  return selectedValues.includes(candidateValue);
}

export function isRecipeBrowserRecipeEligible(
  recipe: Pick<RecipeDetail, "primary_protein" | "cuisine" | "total_time_minutes" | "difficulty" | "cook_method">,
  selectedFilters: RecipeBrowserSelectedFilters,
): boolean {
  const metadata = deriveRecipeBrowserEligibleMetadata(recipe);

  return (
    matchesFamily(selectedFilters.protein, metadata.protein) &&
    matchesFamily(selectedFilters.cuisine, metadata.cuisine) &&
    matchesFamily(selectedFilters.time, metadata.time) &&
    matchesFamily(selectedFilters.difficulty, metadata.difficulty) &&
    matchesFamily(selectedFilters.method, metadata.method)
  );
}

export function filterRecipeBrowserRecipes<TRecipe extends Pick<
  RecipeDetail,
  "primary_protein" | "cuisine" | "total_time_minutes" | "difficulty" | "cook_method"
>>(recipes: TRecipe[], selectedFilters: RecipeBrowserSelectedFilters): TRecipe[] {
  return recipes.filter((recipe) => isRecipeBrowserRecipeEligible(recipe, selectedFilters));
}
