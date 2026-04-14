import type { RecipeDetail } from "./mvpApi";
import {
  RECIPE_BROWSER_MVP_FILTERS,
  normalizeRecipeBrowserCostId,
  normalizeRecipeBrowserCleanupId,
  normalizeRecipeBrowserDietIds,
  deriveRecipeBrowserCuisinePath,
  deriveRecipeBrowserTimeBucket,
  normalizeRecipeBrowserIngredientToken,
  normalizeRecipeBrowserPrimaryProteinIngredient,
  type RecipeBrowserMvpCostId,
  type RecipeBrowserMvpCleanupId,
  type RecipeBrowserMvpCuisineId,
  type RecipeBrowserMvpDietId,
  type RecipeBrowserMvpDifficultyId,
  type RecipeBrowserMvpFilterFamilyId,
  type RecipeBrowserMvpFilterValueIdByFamily,
  type RecipeBrowserMvpIngredientId,
  type RecipeBrowserMvpMethodId,
  type RecipeBrowserMvpProteinId,
  type RecipeBrowserMvpTimeBucketId,
} from "./recipeBrowserMvp";

export type RecipeBrowserSelectedFilters = {
  ingredients: RecipeBrowserMvpIngredientId[];
  protein: RecipeBrowserMvpProteinId[];
  cuisine: RecipeBrowserMvpCuisineId[];
  time: RecipeBrowserMvpTimeBucketId[];
  difficulty: RecipeBrowserMvpDifficultyId[];
  method: RecipeBrowserMvpMethodId[];
  cleanup: RecipeBrowserMvpCleanupId[];
  diet: RecipeBrowserMvpDietId[];
  cost: RecipeBrowserMvpCostId[];
};

export type RecipeBrowserEligibleMetadata = {
  ingredients: RecipeBrowserMvpIngredientId[];
  protein: RecipeBrowserMvpProteinId[];
  cuisinePath: RecipeBrowserMvpCuisineId[] | null;
  time: RecipeBrowserMvpTimeBucketId | null;
  difficulty: RecipeBrowserMvpDifficultyId | null;
  method: RecipeBrowserMvpMethodId | null;
  cleanup: RecipeBrowserMvpCleanupId | null;
  diet: RecipeBrowserMvpDietId[];
  cost: RecipeBrowserMvpCostId | null;
};

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

function deriveIngredientTokens(
  recipe: Pick<RecipeDetail, "primary_protein" | "ingredients">,
): RecipeBrowserMvpIngredientId[] {
  const ingredientTokens = new Set<RecipeBrowserMvpIngredientId>();

  const primaryProteinToken = normalizeRecipeBrowserPrimaryProteinIngredient(recipe.primary_protein);
  if (primaryProteinToken) {
    ingredientTokens.add(primaryProteinToken);
  }

  for (const ingredient of recipe.ingredients ?? []) {
    const candidates = [
      ingredient.pantry_name,
      ingredient.display_name,
      ingredient.ingredient_name,
    ];

    for (const candidate of candidates) {
      const token = normalizeRecipeBrowserIngredientToken(candidate);
      if (token) {
        ingredientTokens.add(token);
      }
    }
  }

  return Array.from(ingredientTokens);
}

export function deriveRecipeBrowserEligibleMetadata(recipe: Pick<
  RecipeDetail,
  "primary_protein" | "ingredients" | "cuisine" | "total_time_minutes" | "difficulty" | "cook_method" | "tags"
>): RecipeBrowserEligibleMetadata {
  const ingredientTokens = deriveIngredientTokens(recipe);

  return {
    ingredients: ingredientTokens,
    protein: ingredientTokens.filter((token): token is RecipeBrowserMvpProteinId =>
      RECIPE_BROWSER_MVP_FILTERS.protein.options.some((option) => option.id === token),
    ),
    cuisinePath: deriveRecipeBrowserCuisinePath(recipe.cuisine),
    time: deriveRecipeBrowserTimeBucket(recipe.total_time_minutes),
    difficulty: normalizeSupportedDifficulty(recipe.difficulty),
    method: normalizeSupportedMethod(recipe.cook_method),
    cleanup: normalizeRecipeBrowserCleanupId(recipe.tags),
    diet: normalizeRecipeBrowserDietIds(recipe.tags),
    cost: normalizeRecipeBrowserCostId(recipe.tags),
  };
}

function matchesIngredientFamily(
  selectedValues: RecipeBrowserSelectedFilters["ingredients"],
  candidateValues: RecipeBrowserEligibleMetadata["ingredients"],
): boolean {
  if (selectedValues.length === 0) {
    return true;
  }

  if (candidateValues.length === 0) {
    return false;
  }

  return selectedValues.every((selectedValue) => candidateValues.includes(selectedValue));
}

function matchesCuisineFamily(
  selectedValues: RecipeBrowserSelectedFilters["cuisine"],
  candidatePath: RecipeBrowserEligibleMetadata["cuisinePath"],
): boolean {
  if (selectedValues.length === 0) {
    return true;
  }

  if (!candidatePath || candidatePath.length === 0) {
    return false;
  }

  return selectedValues.some((selectedValue) => candidatePath.includes(selectedValue));
}

function matchesFlatFamily<TValue extends string>(
  selectedValues: TValue[],
  candidateValue: TValue | null,
): boolean {
  if (selectedValues.length === 0) {
    return true;
  }

  if (candidateValue === null) {
    return false;
  }

  return selectedValues.includes(candidateValue);
}

function matchesMultiValueFlatFamily<TValue extends string>(
  selectedValues: TValue[],
  candidateValues: TValue[],
): boolean {
  if (selectedValues.length === 0) {
    return true;
  }

  if (candidateValues.length === 0) {
    return false;
  }

  return selectedValues.some((selectedValue) => candidateValues.includes(selectedValue));
}

export function matchesRecipeBrowserFamily(
  familyId: "ingredients",
  selectedValues: RecipeBrowserSelectedFilters["ingredients"],
  metadata: RecipeBrowserEligibleMetadata,
): boolean;
export function matchesRecipeBrowserFamily(
  familyId: "protein",
  selectedValues: RecipeBrowserSelectedFilters["protein"],
  metadata: RecipeBrowserEligibleMetadata,
): boolean;
export function matchesRecipeBrowserFamily(
  familyId: "cuisine",
  selectedValues: RecipeBrowserSelectedFilters["cuisine"],
  metadata: RecipeBrowserEligibleMetadata,
): boolean;
export function matchesRecipeBrowserFamily(
  familyId: "time",
  selectedValues: RecipeBrowserSelectedFilters["time"],
  metadata: RecipeBrowserEligibleMetadata,
): boolean;
export function matchesRecipeBrowserFamily(
  familyId: "difficulty",
  selectedValues: RecipeBrowserSelectedFilters["difficulty"],
  metadata: RecipeBrowserEligibleMetadata,
): boolean;
export function matchesRecipeBrowserFamily(
  familyId: "method",
  selectedValues: RecipeBrowserSelectedFilters["method"],
  metadata: RecipeBrowserEligibleMetadata,
): boolean;
export function matchesRecipeBrowserFamily(
  familyId: "cleanup",
  selectedValues: RecipeBrowserSelectedFilters["cleanup"],
  metadata: RecipeBrowserEligibleMetadata,
): boolean;
export function matchesRecipeBrowserFamily(
  familyId: "diet",
  selectedValues: RecipeBrowserSelectedFilters["diet"],
  metadata: RecipeBrowserEligibleMetadata,
): boolean;
export function matchesRecipeBrowserFamily(
  familyId: "cost",
  selectedValues: RecipeBrowserSelectedFilters["cost"],
  metadata: RecipeBrowserEligibleMetadata,
): boolean;
export function matchesRecipeBrowserFamily(
  familyId: RecipeBrowserMvpFilterFamilyId,
  selectedValues: RecipeBrowserMvpFilterValueIdByFamily[RecipeBrowserMvpFilterFamilyId][],
  metadata: RecipeBrowserEligibleMetadata,
): boolean {
  if (familyId === "ingredients") {
    return matchesIngredientFamily(
      selectedValues as RecipeBrowserSelectedFilters["ingredients"],
      metadata.ingredients,
    );
  }

  if (familyId === "cuisine") {
    return matchesCuisineFamily(
      selectedValues as RecipeBrowserSelectedFilters["cuisine"],
      metadata.cuisinePath,
    );
  }

  if (familyId === "protein") {
    return matchesFlatFamily(selectedValues as RecipeBrowserSelectedFilters["protein"], metadata.protein[0] ?? null)
      || (selectedValues.length > 0 &&
        metadata.protein.some((value) =>
          (selectedValues as RecipeBrowserSelectedFilters["protein"]).includes(value),
        ));
  }

  if (familyId === "time") {
    return matchesFlatFamily(selectedValues as RecipeBrowserSelectedFilters["time"], metadata.time);
  }

  if (familyId === "difficulty") {
    return matchesFlatFamily(selectedValues as RecipeBrowserSelectedFilters["difficulty"], metadata.difficulty);
  }

  if (familyId === "method") {
    return matchesFlatFamily(selectedValues as RecipeBrowserSelectedFilters["method"], metadata.method);
  }

  if (familyId === "cleanup") {
    return matchesFlatFamily(selectedValues as RecipeBrowserSelectedFilters["cleanup"], metadata.cleanup);
  }

  if (familyId === "diet") {
    return matchesMultiValueFlatFamily(selectedValues as RecipeBrowserSelectedFilters["diet"], metadata.diet);
  }

  return matchesFlatFamily(selectedValues as RecipeBrowserSelectedFilters["cost"], metadata.cost);
}

export function isRecipeBrowserRecipeEligible(
  recipe: Pick<
    RecipeDetail,
    "primary_protein" | "ingredients" | "cuisine" | "total_time_minutes" | "difficulty" | "cook_method" | "tags"
  >,
  selectedFilters: RecipeBrowserSelectedFilters,
): boolean {
  const metadata = deriveRecipeBrowserEligibleMetadata(recipe);

  return (
    matchesRecipeBrowserFamily("ingredients", selectedFilters.ingredients, metadata) &&
    matchesRecipeBrowserFamily("protein", selectedFilters.protein, metadata) &&
    matchesRecipeBrowserFamily("cuisine", selectedFilters.cuisine, metadata) &&
    matchesRecipeBrowserFamily("time", selectedFilters.time, metadata) &&
    matchesRecipeBrowserFamily("difficulty", selectedFilters.difficulty, metadata) &&
    matchesRecipeBrowserFamily("method", selectedFilters.method, metadata) &&
    matchesRecipeBrowserFamily("cleanup", selectedFilters.cleanup, metadata) &&
    matchesRecipeBrowserFamily("diet", selectedFilters.diet, metadata) &&
    matchesRecipeBrowserFamily("cost", selectedFilters.cost, metadata)
  );
}

export function filterRecipeBrowserRecipes<TRecipe extends Pick<
  RecipeDetail,
  "primary_protein" | "ingredients" | "cuisine" | "total_time_minutes" | "difficulty" | "cook_method" | "tags"
>>(recipes: TRecipe[], selectedFilters: RecipeBrowserSelectedFilters): TRecipe[] {
  return recipes.filter((recipe) => isRecipeBrowserRecipeEligible(recipe, selectedFilters));
}
