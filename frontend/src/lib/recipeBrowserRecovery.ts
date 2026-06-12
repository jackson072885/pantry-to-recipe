import { filterRecipeBrowserRecipes, type RecipeBrowserSelectedFilters } from "./recipeBrowserEligibility";
import {
  RECIPE_BROWSER_MVP_FILTERS,
  getRecipeBrowserIngredientOptionsForBrowseNode,
  type RecipeBrowserMvpIngredientId,
} from "./recipeBrowserMvp";

type RecipeBrowserRecoveryRecipe = Parameters<typeof filterRecipeBrowserRecipes>[0][number];

export type IngredientRecoverySuggestion = {
  sourceIngredientId: RecipeBrowserMvpIngredientId;
  sourceLabel: string;
  targetIngredientId: RecipeBrowserMvpIngredientId;
  targetLabel: string;
  strategy: "broader" | "nearby";
  resultingCount: number;
};

const EXPLICIT_BROADER_RECOVERY_MAP: Partial<
  Record<RecipeBrowserMvpIngredientId, readonly RecipeBrowserMvpIngredientId[]>
> = {
  chicken_breast: ["chicken"],
  chicken_thighs: ["chicken"],
  ground_beef: ["beef"],
  steak: ["beef"],
  pork_chops: ["pork"],
  white_beans: ["beans"],
  quinoa: ["rice"],
  couscous: ["rice"],
  feta: ["cheese"],
  vegetable_broth: ["broth"],
  sesame_oil: ["oil"],
  ramen_noodles: ["noodles"],
  ravioli: ["pasta"],
};

const INGREDIENT_OPTION_BY_ID = new Map(
  RECIPE_BROWSER_MVP_FILTERS.ingredients.options.map((option) => [option.id, option] as const),
);

function replaceIngredientSelection(
  selectedIngredients: readonly RecipeBrowserMvpIngredientId[],
  sourceIngredientId: RecipeBrowserMvpIngredientId,
  targetIngredientId: RecipeBrowserMvpIngredientId,
): RecipeBrowserMvpIngredientId[] {
  const nextIngredients = selectedIngredients.map((ingredientId) =>
    ingredientId === sourceIngredientId ? targetIngredientId : ingredientId,
  );

  return Array.from(new Set(nextIngredients));
}

export function getRecipeBrowserIngredientRecoverySuggestions(
  recipes: ReadonlyArray<RecipeBrowserRecoveryRecipe>,
  selectedFilters: RecipeBrowserSelectedFilters,
  maxSuggestions = 3,
): IngredientRecoverySuggestion[] {
  if (selectedFilters.ingredients.length === 0 || maxSuggestions <= 0) {
    return [];
  }

  const currentResultCount = filterRecipeBrowserRecipes(recipes, selectedFilters).length;
  if (currentResultCount > 2) {
    return [];
  }

  const selectedIngredientSet = new Set(selectedFilters.ingredients);
  const suggestions: IngredientRecoverySuggestion[] = [];
  const seenSuggestions = new Set<string>();

  for (const sourceIngredientId of selectedFilters.ingredients) {
    const sourceOption = INGREDIENT_OPTION_BY_ID.get(sourceIngredientId);
    if (!sourceOption) {
      continue;
    }

    const broaderCandidateIds = EXPLICIT_BROADER_RECOVERY_MAP[sourceIngredientId] ?? [];
    const siblingCandidateIds = sourceOption.browseNodeIds.flatMap((browseNodeId) =>
      getRecipeBrowserIngredientOptionsForBrowseNode(browseNodeId).map((option) => option.id),
    );

    const rankedCandidateIds = [
      ...broaderCandidateIds,
      ...siblingCandidateIds,
    ].filter((candidateId) => candidateId !== sourceIngredientId && !selectedIngredientSet.has(candidateId));

    for (const candidateId of rankedCandidateIds) {
      const candidateOption = INGREDIENT_OPTION_BY_ID.get(candidateId);
      if (!candidateOption) {
        continue;
      }

      const key = `${sourceIngredientId}:${candidateId}`;
      if (seenSuggestions.has(key)) {
        continue;
      }

      const nextSelectedIngredients = replaceIngredientSelection(
        selectedFilters.ingredients,
        sourceIngredientId,
        candidateId,
      );
      const resultingCount = filterRecipeBrowserRecipes(recipes, {
        ...selectedFilters,
        ingredients: nextSelectedIngredients,
      }).length;

      if (resultingCount <= currentResultCount || resultingCount === 0) {
        continue;
      }

      suggestions.push({
        sourceIngredientId,
        sourceLabel: sourceOption.label,
        targetIngredientId: candidateId,
        targetLabel: candidateOption.label,
        strategy: broaderCandidateIds.includes(candidateId) ? "broader" : "nearby",
        resultingCount,
      });
      seenSuggestions.add(key);
    }
  }

  return suggestions
    .sort((left, right) => {
      if (left.strategy !== right.strategy) {
        return left.strategy === "broader" ? -1 : 1;
      }

      if (left.resultingCount !== right.resultingCount) {
        return right.resultingCount - left.resultingCount;
      }

      return left.targetLabel.localeCompare(right.targetLabel);
    })
    .slice(0, maxSuggestions);
}
