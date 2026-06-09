import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import PageHero from "../components/PageHero";

import {
  RECIPE_BROWSER_MVP_CUISINE_GROUPS,
  RECIPE_BROWSER_MVP_FILTER_ORDER,
  RECIPE_BROWSER_MVP_FILTERS,
  normalizeRecipeBrowserCuisineId,
  normalizeRecipeBrowserIngredientToken,
  type RecipeBrowserMvpIngredientId,
  type RecipeBrowserMvpCuisineId,
  type RecipeBrowserMvpFilterFamilyId,
  type RecipeBrowserMvpFilterValueId,
} from "../lib/recipeBrowserMvp";
import {
  createImportReview,
  fetchDinnerTonightCandidates,
  fetchImportedRecipePromotionAudit,
  fetchImportedRecipes,
  fetchImportReviews,
  fetchRecipeBrowserCatalog,
  importApprovedReview,
  inspectDinnerTonightCandidate,
  updateImportedRecipeCleanup,
  updateImportedRecipePromotionAudit,
  updateImportReview,
  type DinnerTonightCandidate,
  type DinnerTonightCandidateInspection,
  type DinnerTonightFilterCounts,
  type DinnerTonightProviderStatus,
  type ImportedRecipePromotionAuditRecord,
  type ImportedRecipePromotionAuditUpdateRequest,
  type ImportedRecipeRecord,
  type ImportedRecipeCleanupUpdateRequest,
  type ImportReviewCandidate,
  type ImportReviewRecord,
  type ImportReviewStatus,
  type RecipeBrowserCatalog,
  type RecipeDetail,
} from "../lib/mvpApi";
import { filterRecipeBrowserRecipes, type RecipeBrowserSelectedFilters } from "../lib/recipeBrowserEligibility";
import {
  rankRecipeBrowserRecipes,
  type RankedRecipeBrowserRecipe,
  type RecipeBrowserPantryFit,
} from "../lib/recipeBrowserRanking";
import { getRecipeBrowserIngredientRecoverySuggestions } from "../lib/recipeBrowserRecovery";
import {
  RECIPE_BROWSER_INGREDIENT_BROWSE_TREE,
  RECIPE_BROWSER_FILTER_FAMILY_REGISTRY,
  RECIPE_BROWSER_SCOPE_OPTIONS,
  type RecipeBrowserIngredientNodeId,
  type RecipeBrowserScopeId,
  searchIngredientBrowseNodes,
} from "../lib/recipeTaxonomy";
import { useSavedPantryRecommendations } from "../lib/useSavedPantryRecommendations";

type ActiveFilter = {
  familyId: RecipeBrowserMvpFilterFamilyId;
  familyLabel: string;
  valueId: RecipeBrowserMvpFilterValueId;
  valueLabel: string;
};

type ActiveFilterGroup = {
  familyId: RecipeBrowserMvpFilterFamilyId;
  familyLabel: string;
  filters: ActiveFilter[];
};

type FilterHistoryEntry = {
  familyId: RecipeBrowserMvpFilterFamilyId;
  valueId: RecipeBrowserMvpFilterValueId;
};

type RecipeBrowserRegistryFamilyId = (typeof RECIPE_BROWSER_FILTER_FAMILY_REGISTRY)[number]["id"];
type ConsoleDepth = "top" | "family" | "subfamily" | "leaf";
type LivingFilterStatus = "idle" | "loading" | "live" | "unavailable";
type LivingFilterFamilyId =
  | "cuisine_tags"
  | "dish_type_tags"
  | "flavor_tags"
  | "sauce_tags"
  | "method_tags"
  | "ingredients"
  | "used_ingredients"
  | "missed_ingredients"
  | "feasibility_bucket";

type LivingFilterFacet = {
  familyId: LivingFilterFamilyId;
  familyLabel: string;
  value: string;
  label: string;
  count: number;
};

type LivingFacetBrowserMapping = {
  familyId: RecipeBrowserMvpFilterFamilyId;
  valueId: RecipeBrowserMvpFilterValueId;
};

type ParentIngredientChildFilter = {
  label: string;
  filterId: RecipeBrowserMvpIngredientId | null;
};

type LivingCandidateAvailability = {
  count: number;
  bestTitle: string | null;
};

type ImportedRecipePantryFit = {
  matchedIngredients: string[];
  missingIngredients: string[];
  pantryCoveragePct: number | null;
};

type RankedImportedRecipe = {
  record: ImportedRecipeRecord;
  pantryFit: ImportedRecipePantryFit | null;
};

type ImportedRecipePreview = RankedImportedRecipe & {
  review: ImportReviewRecord | null;
};

type PromotionAuditFieldId =
  | "provenance_status"
  | "cleanup_status"
  | "safety_status"
  | "feasibility_status"
  | "quality_status"
  | "duplicate_status";

type PromotionReadinessItemStatus = "met" | "needs_attention" | "blocked";

type PromotionReadinessItem = {
  id: string;
  label: string;
  status: PromotionReadinessItemStatus;
  detail: string;
};

type PromotionReadinessAssessment = {
  status: "candidate" | "blocked";
  label: string;
  summary: string;
  items: PromotionReadinessItem[];
};

type SourceTrustState =
  | "curated_verified"
  | "reviewed_import"
  | "external_candidate"
  | "internal_fallback"
  | "provider_unavailable";

type RecipeBrowserSortMode =
  | "best_pantry_fit"
  | "fastest"
  | "fewest_missing"
  | "most_trusted"
  | "recently_imported"
  | "highest_confidence";

type SavedRecipeBrowserSearch = {
  selectedFilters: RecipeBrowserSelectedFilters;
  activeScopeId: RecipeBrowserScopeId;
};

const REGISTRY_TO_IMPLEMENTED_FAMILY_ID: Partial<
  Record<RecipeBrowserRegistryFamilyId, RecipeBrowserMvpFilterFamilyId>
> = {
  ingredients: "ingredients",
  cuisine: "cuisine",
  time: "time",
  effort: "difficulty",
  method: "method",
  cleanup: "cleanup",
  diet: "diet",
  cost: "cost",
  household: "household",
};
const DEFAULT_ACTIVE_FAMILY_ID: RecipeBrowserRegistryFamilyId = RECIPE_BROWSER_FILTER_FAMILY_REGISTRY[0].id;
const DEFAULT_ACTIVE_SCOPE_ID: RecipeBrowserScopeId = "explore_all";
const INGREDIENT_BROWSE_GROUPS_BY_FAMILY = RECIPE_BROWSER_INGREDIENT_BROWSE_TREE;
const DEFAULT_ACTIVE_INGREDIENT_FAMILY_ID: string | null = "proteins";
const DEFAULT_ACTIVE_INGREDIENT_GROUP_ID: RecipeBrowserIngredientNodeId | null = null;
const DEFAULT_ACTIVE_CUISINE_GROUP_ID: RecipeBrowserMvpCuisineId | null = null;
const SAVED_RECIPE_BROWSER_SEARCH_KEY = "pantry.recipeBrowser.savedSearch.v1";
const RECIPE_BROWSER_SORT_OPTIONS: Array<{ value: RecipeBrowserSortMode; label: string }> = [
  { value: "best_pantry_fit", label: "Best pantry fit" },
  { value: "fastest", label: "Fastest" },
  { value: "fewest_missing", label: "Fewest missing ingredients" },
  { value: "most_trusted", label: "Most trusted source" },
  { value: "recently_imported", label: "Recently imported" },
  { value: "highest_confidence", label: "Highest confidence" },
];
const DEFAULT_CONSOLE_FAMILY_IDS: RecipeBrowserRegistryFamilyId[] = [
  "ingredients",
  "cuisine",
  "time",
  "household",
  "diet",
  "method",
  "cleanup",
  "cost",
  "effort",
];
const DEFAULT_INGREDIENT_CONSOLE_FAMILY_IDS = new Set([
  "proteins",
  "beans_legumes",
  "grains_starches",
  "vegetables",
  "fruits",
  "dairy_creamy",
  "oils_fats",
  "sauces_condiments",
  "herbs_spices",
]);
const LIVING_FILTER_FAMILY_LABELS: Record<LivingFilterFamilyId, string> = {
  cuisine_tags: "Cuisine",
  dish_type_tags: "Dish Type",
  flavor_tags: "Flavor",
  sauce_tags: "Sauce",
  method_tags: "Method",
  ingredients: "Ingredients",
  used_ingredients: "Used Ingredients",
  missed_ingredients: "Missed Ingredients",
  feasibility_bucket: "Feasibility",
};
const LIVING_FILTER_FAMILY_ORDER = Object.keys(LIVING_FILTER_FAMILY_LABELS) as LivingFilterFamilyId[];
const PROMOTION_AUDIT_FIELDS: Array<{ id: PromotionAuditFieldId; label: string }> = [
  { id: "provenance_status", label: "Provenance audit" },
  { id: "cleanup_status", label: "Cleanup review" },
  { id: "safety_status", label: "Safety review" },
  { id: "feasibility_status", label: "Pantry feasibility" },
  { id: "quality_status", label: "Recipe quality" },
  { id: "duplicate_status", label: "Duplicate review" },
];
const PROMOTION_AUDIT_STATUS_OPTIONS: Array<{
  value: ImportedRecipePromotionAuditRecord[PromotionAuditFieldId];
  label: string;
}> = [
  { value: "not_started", label: "Not started" },
  { value: "passed", label: "Passed" },
  { value: "needs_work", label: "Needs work" },
  { value: "blocked", label: "Blocked" },
];

const EMPTY_SELECTED_FILTERS: RecipeBrowserSelectedFilters = {
  ingredients: [],
  protein: [],
  cuisine: [],
  time: [],
  difficulty: [],
  method: [],
  cleanup: [],
  diet: [],
  household: [],
  cost: [],
};

const SCOPE_TO_PANTRY_FIT_STATE = {
  cook_now: "cook_now",
  almost_there: "almost_there",
  pantry_stretch: "pantry_stretch",
} as const;
const MAIN_INGREDIENT_CHILD_FILTER_OVERRIDES_BY_PARENT: Partial<
  Record<RecipeBrowserMvpIngredientId, readonly ParentIngredientChildFilter[]>
> = {
  pork: [
    { label: "Bacon", filterId: "bacon" },
    { label: "Pork Chops", filterId: "pork_chops" },
    { label: "Sausage", filterId: "sausage" },
    { label: "Ham", filterId: "ham" },
    { label: "Ground Pork", filterId: null },
    { label: "Ribs", filterId: null },
    { label: "Tenderloin", filterId: "pork_tenderloin" },
  ],
};

function getChildFiltersForParent(
  parentFilterId: RecipeBrowserMvpFilterValueId | null | undefined,
  ingredients: readonly { id: RecipeBrowserMvpIngredientId; label: string }[] = [],
): readonly ParentIngredientChildFilter[] {
  if (!parentFilterId) {
    return [];
  }

  const configuredFilters = MAIN_INGREDIENT_CHILD_FILTER_OVERRIDES_BY_PARENT[parentFilterId as RecipeBrowserMvpIngredientId];
  if (configuredFilters) {
    return configuredFilters;
  }

  return ingredients
    .filter((ingredient) => ingredient.id !== parentFilterId)
    .map((ingredient) => ({
      label: formatDisplayLabel(ingredient.label) ?? ingredient.label,
      filterId: ingredient.id,
    }));
}

function getChildFilterIdsForParent(
  parentFilterId: RecipeBrowserMvpFilterValueId | null | undefined,
  ingredients: readonly { id: RecipeBrowserMvpIngredientId; label: string }[] = [],
): RecipeBrowserMvpIngredientId[] {
  return getChildFiltersForParent(parentFilterId, ingredients)
    .map((filter) => filter.filterId)
    .filter((filterId): filterId is RecipeBrowserMvpIngredientId => Boolean(filterId));
}

function isParentFilterSelected(
  selectedFilters: RecipeBrowserSelectedFilters,
  parentFilterId: RecipeBrowserMvpFilterValueId | null | undefined,
): boolean {
  return parentFilterId ? selectedFilters.ingredients.includes(parentFilterId as RecipeBrowserMvpIngredientId) : false;
}

function buildActiveFilters(selectedFilters: RecipeBrowserSelectedFilters): ActiveFilter[] {
  return RECIPE_BROWSER_MVP_FILTER_ORDER.flatMap((family) =>
    family.options
      .filter((option) => (selectedFilters[family.id] as readonly RecipeBrowserMvpFilterValueId[]).includes(option.id))
      .map((option) => ({
        familyId: family.id,
        familyLabel: family.label,
        valueId: option.id,
        valueLabel: option.label,
      })),
  );
}

function formatMinutes(totalTimeMinutes: number | null | undefined): string | null {
  return typeof totalTimeMinutes === "number" ? `${totalTimeMinutes} min` : null;
}

function formatDisplayLabel(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  return normalized
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatEditableList(values: string[]): string {
  return values.join("\n");
}

function parseEditableList(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => {
      const key = line.toLocaleLowerCase();
      if (!line || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function formatLivingFacetDisplayLabel(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  const cleaned = normalized
    .replace(/^bulbs?\s+/i, "")
    .replace(/\bweighing\s+\d+(?:\.\d+)?\s*(?:kg|g|lb|lbs|oz)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const displayLabel = formatDisplayLabel(cleaned) ?? cleaned;

  if (displayLabel === "Salt And Pepper") {
    return "Salt and pepper";
  }

  return displayLabel;
}

function getImplementedFamilyId(
  familyId: RecipeBrowserRegistryFamilyId,
): RecipeBrowserMvpFilterFamilyId | null {
  return REGISTRY_TO_IMPLEMENTED_FAMILY_ID[familyId] ?? null;
}

function getImplementedFamilyLabel(familyId: RecipeBrowserMvpFilterFamilyId): string {
  if (familyId === "difficulty") {
    return "Effort";
  }

  if (familyId === "household") {
    return "Meal Type";
  }

  return RECIPE_BROWSER_MVP_FILTERS[familyId].label;
}

function getLivingFilterFacets(filterCounts: DinnerTonightFilterCounts | null): LivingFilterFacet[] {
  const families = filterCounts?.families;
  if (!families) {
    return [];
  }

  return LIVING_FILTER_FAMILY_ORDER.flatMap((familyId) =>
    (families[familyId] ?? [])
      .filter((row) => row.count > 0 && row.value.trim().length > 0)
      .slice(0, 6)
      .map((row) => ({
        familyId,
        familyLabel: LIVING_FILTER_FAMILY_LABELS[familyId],
        value: row.value,
        label: formatLivingFacetDisplayLabel(row.value) ?? row.value,
        count: row.count,
      })),
  );
}

function getSelectedLivingFilterFacets(
  selectedFilters: Record<string, string[]>,
  filterCounts: DinnerTonightFilterCounts | null,
): LivingFilterFacet[] {
  return LIVING_FILTER_FAMILY_ORDER.flatMap((familyId) => {
    const selectedValues = selectedFilters[familyId] ?? [];
    const availableRows = filterCounts?.families?.[familyId] ?? [];

    return selectedValues.map((value) => ({
      familyId,
      familyLabel: LIVING_FILTER_FAMILY_LABELS[familyId],
      value,
      label: formatLivingFacetDisplayLabel(value) ?? value,
      count: availableRows.find((row) => row.value === value)?.count ?? 0,
    }));
  });
}

function getLivingFilterCountLabel(count: number): string {
  return count > 0 ? `${count}` : "Selected";
}

function normalizeLivingFacetLookupValue(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function findFlatBrowserOption(
  familyId: RecipeBrowserMvpFilterFamilyId,
  value: string,
): RecipeBrowserMvpFilterValueId | null {
  const normalizedValue = normalizeLivingFacetLookupValue(value);
  const option = RECIPE_BROWSER_MVP_FILTERS[familyId].options.find(
    (candidate) =>
      normalizeLivingFacetLookupValue(candidate.id) === normalizedValue ||
      normalizeLivingFacetLookupValue(candidate.label) === normalizedValue,
  );

  return option?.id ?? null;
}

function getLivingFacetBrowserMapping(
  familyId: LivingFilterFamilyId,
  value: string,
): LivingFacetBrowserMapping | null {
  if (familyId === "cuisine_tags") {
    const cuisineId = normalizeRecipeBrowserCuisineId(value);
    return cuisineId ? { familyId: "cuisine", valueId: cuisineId } : null;
  }

  if (familyId === "method_tags") {
    const methodId = findFlatBrowserOption("method", value);
    return methodId ? { familyId: "method", valueId: methodId } : null;
  }

  if (familyId === "ingredients" || familyId === "used_ingredients") {
    const ingredientId = normalizeRecipeBrowserIngredientToken(value);
    return ingredientId ? { familyId: "ingredients", valueId: ingredientId } : null;
  }

  return null;
}

function getLivingFacetBrowserKey(mapping: LivingFacetBrowserMapping): string {
  return `${mapping.familyId}:${mapping.valueId}`;
}

function parseLivingFacetBrowserKey(key: string): LivingFacetBrowserMapping | null {
  const [familyId, valueId] = key.split(":");
  if (!familyId || !valueId) {
    return null;
  }

  return { familyId: familyId as RecipeBrowserMvpFilterFamilyId, valueId: valueId as RecipeBrowserMvpFilterValueId };
}

function getLivingFacetScopeLabel(mapping: LivingFacetBrowserMapping | null): string {
  return mapping ? "Also filters recipe cards" : "Availability only";
}

function getLivingFilterProviderCopy(
  status: LivingFilterStatus,
  providerStatus: DinnerTonightProviderStatus | null,
  hasSavedPantry: boolean,
  facetCount: number,
  availability: LivingCandidateAvailability | null,
): string {
  if (!hasSavedPantry) {
    return "Add pantry items to unlock live availability.";
  }

  if (status === "loading") {
    return "Checking live dinner availability.";
  }

  if (status === "live" && facetCount > 0) {
    return "Live pantry facets use saved pantry candidate availability; mapped facets also narrow verified recipe cards.";
  }

  if (status === "live" && availability && availability.count > 0) {
    return `${availability.count} live provider candidate${availability.count === 1 ? "" : "s"} checked. No live facets available for this pantry state yet.`;
  }

  if (status === "live") {
    return "No live facets available for this pantry state yet.";
  }

  if (providerStatus === "disabled" || providerStatus === "missing_api_key" || providerStatus === "error") {
    return "Live facets unavailable; verified internal browser filters still work.";
  }

  return "Static browser filters are available.";
}

function getLivingCandidateAvailabilityCopy(
  status: LivingFilterStatus,
  providerStatus: DinnerTonightProviderStatus | null,
  availability: LivingCandidateAvailability | null,
  hasSavedPantry: boolean,
): string {
  if (!hasSavedPantry) {
    return "Live candidate availability appears after pantry items are saved.";
  }

  if (status === "loading") {
    return "Checking live candidate availability.";
  }

  if (providerStatus === "disabled" || providerStatus === "missing_api_key" || providerStatus === "error") {
    return "Live provider unavailable; using verified internal browser results.";
  }

  if (availability?.bestTitle) {
    return `Best live candidate found: ${availability.bestTitle}`;
  }

  if (availability && availability.count > 0) {
    return `${availability.count} live candidate${availability.count === 1 ? "" : "s"} available.`;
  }

  if (availability && availability.count === 0) {
    return "No live candidates for this pantry state yet.";
  }

  return "Internal browser results remain available.";
}

function getConsoleFamilyLabel(familyId: RecipeBrowserRegistryFamilyId): string {
  if (familyId === "ingredients") {
    return "Ingredient";
  }

  if (familyId === "household") {
    return "Meal Type";
  }

  return RECIPE_BROWSER_FILTER_FAMILY_REGISTRY.find((family) => family.id === familyId)?.label ?? familyId;
}

function getRegistryFamilyIdForImplementedFamily(
  familyId: RecipeBrowserMvpFilterFamilyId,
): RecipeBrowserRegistryFamilyId {
  const registryEntry = RECIPE_BROWSER_FILTER_FAMILY_REGISTRY.find(
    (family) => REGISTRY_TO_IMPLEMENTED_FAMILY_ID[family.id] === familyId,
  );

  return registryEntry?.id ?? "ingredients";
}

function getIngredientFamilyIdForNodeId(browseNodeId: RecipeBrowserIngredientNodeId): string {
  return (
    INGREDIENT_BROWSE_GROUPS_BY_FAMILY.find((family) =>
      family.nodeIds.some((nodeId) => nodeId === browseNodeId),
    )?.id ?? DEFAULT_ACTIVE_INGREDIENT_FAMILY_ID ?? "proteins"
  );
}

function getFamilySelectionNote(familyId: RecipeBrowserMvpFilterFamilyId): string {
  if (familyId === "ingredients") {
    return "Start broad, then narrow to ingredients with real dinner matches.";
  }

  if (familyId === "cuisine") {
    return "Pick a style and recipes update as you choose.";
  }

  if (familyId === "protein") {
    return "Protein uses OR within the family and follows the current browse-node mapping.";
  }

  if (familyId === "cost") {
    return "Choose a dinner lane by budget feel.";
  }

  if (familyId === "cleanup") {
    return "Choose how much cleanup you want tonight.";
  }

  if (familyId === "diet") {
    return "Show recipes with clear diet labels.";
  }

  if (familyId === "household") {
    return "Choose the kind of dinner you need.";
  }

  return "Recipes update as you choose.";
}

function getPantryDecisionLabel(pantryFit: RecipeBrowserPantryFit | null): string {
  if (!pantryFit) {
    return "Pantry fit unavailable for this browser session";
  }

  if (pantryFit.state === "cook_now") {
    return pantryFit.quantityConfirmationCount > 0 ? "Confirm amounts before cooking" : "Ready to cook with what you have";
  }

  if (pantryFit.quantityConfirmationCount > 0 && pantryFit.shoppingMissingCount === 0) {
    return "Ingredients found - confirm amounts first";
  }

  if (pantryFit.state === "almost_there") {
    if (pantryFit.shoppingMissingCount > 0) {
      return `Almost there - missing ${pantryFit.shoppingMissingCount} ingredient${pantryFit.shoppingMissingCount === 1 ? "" : "s"}`;
    }
    return "Almost there - quantity check needed";
  }

  return `Pantry stretch${pantryFit.shoppingMissingCount > 0 ? ` - missing ${pantryFit.shoppingMissingCount} ingredient${pantryFit.shoppingMissingCount === 1 ? "" : "s"}` : ""}`;
}

function getPantryCoverageLine(pantryFit: RecipeBrowserPantryFit | null): string | null {
  if (!pantryFit || typeof pantryFit.pantryCoveragePct !== "number") {
    return null;
  }

  if (pantryFit.pantryCoveragePct === 100 && pantryFit.quantityConfirmationCount > 0) {
    return "Saved pantry has the ingredient names, but amounts need confirmation";
  }

  return `Saved pantry covers ${pantryFit.pantryCoveragePct}% of required ingredient names`;
}

function getMissingCoverageLine(pantryFit: RecipeBrowserPantryFit | null): string | null {
  if (!pantryFit) {
    return "Missing-ingredient coverage is unavailable right now.";
  }

  if (pantryFit.missingCount === 0 && pantryFit.quantityConfirmationCount === 0) {
    return "Nothing missing from required ingredients";
  }

  if (pantryFit.quantityConfirmationCount > 0 && pantryFit.shoppingMissingCount === 0) {
    return `Confirm amount${pantryFit.quantityConfirmationCount === 1 ? "" : "s"} for ${pantryFit.quantityConfirmationCount} ingredient${pantryFit.quantityConfirmationCount === 1 ? "" : "s"}`;
  }

  return `Missing ${pantryFit.shoppingMissingCount} required ingredient${pantryFit.shoppingMissingCount === 1 ? "" : "s"}`;
}

function getPantryStatusLabel(
  recommendations: ReturnType<typeof useSavedPantryRecommendations>["recommendations"],
  pantryRankingLoading: boolean,
  pantryRankingError: string,
  hasSavedPantry: boolean,
): string {
  if (recommendations) {
    return "Pantry-aware ranking live";
  }

  if (pantryRankingLoading) {
    return "Checking pantry fit";
  }

  if (pantryRankingError) {
    return "Pantry ranking unavailable";
  }

  if (hasSavedPantry) {
    return "Pantry saved";
  }

  return "Add pantry items to rank";
}

function getPantryStatusTone(
  recommendations: ReturnType<typeof useSavedPantryRecommendations>["recommendations"],
  pantryRankingLoading: boolean,
  pantryRankingError: string,
  hasSavedPantry: boolean,
): "live" | "loading" | "warning" | "idle" {
  if (recommendations) {
    return "live";
  }

  if (pantryRankingLoading) {
    return "loading";
  }

  if (pantryRankingError) {
    return "warning";
  }

  return hasSavedPantry ? "idle" : "warning";
}

function buildWhyItMatches(
  activeFilters: ActiveFilter[],
  activeScopeId: RecipeBrowserScopeId,
  activeScopeLabel: string,
  pantryFit: RecipeBrowserPantryFit | null,
): string {
  if (activeFilters.length > 0) {
    const visibleLabels = activeFilters.slice(0, 2).map((filter) => filter.valueLabel);
    const remainder = activeFilters.length - visibleLabels.length;
    const filterClause =
      remainder > 0 ? `${visibleLabels.join(" + ")} + ${remainder} more` : visibleLabels.join(" + ");

    if (activeScopeId !== "explore_all" && pantryFit) {
      return `Matches current filters: ${filterClause}. Also lands in ${activeScopeLabel}.`;
    }

    return `Matches current filters: ${filterClause}.`;
  }

  if (activeScopeId !== "explore_all" && pantryFit) {
    return `Showing because it lands in ${activeScopeLabel}.`;
  }

  if (pantryFit) {
    return "Eligible in this view and ranked against your saved pantry.";
  }

  return "Eligible in this view.";
}

function filterRankedRecipesByScope(
  rankedRecipes: RankedRecipeBrowserRecipe<RecipeDetail>[],
  activeScopeId: RecipeBrowserScopeId,
  hasPantryScopeData: boolean,
): RankedRecipeBrowserRecipe<RecipeDetail>[] {
  if (activeScopeId === "explore_all") {
    return rankedRecipes;
  }

  if (!hasPantryScopeData) {
    return [];
  }

  return rankedRecipes.filter((entry) => entry.pantryFit?.state === SCOPE_TO_PANTRY_FIT_STATE[activeScopeId]);
}

function sortRecipeBrowserRows(
  rows: RankedRecipeBrowserRecipe<RecipeDetail>[],
  sortMode: RecipeBrowserSortMode,
): RankedRecipeBrowserRecipe<RecipeDetail>[] {
  return rows
    .map((row, originalIndex) => ({ ...row, originalIndex }))
    .sort((left, right) => {
      if (sortMode === "fastest") {
        const leftTime = left.recipe.total_time_minutes ?? Number.POSITIVE_INFINITY;
        const rightTime = right.recipe.total_time_minutes ?? Number.POSITIVE_INFINITY;
        return leftTime !== rightTime ? leftTime - rightTime : left.originalIndex - right.originalIndex;
      }

      if (sortMode === "fewest_missing") {
        const leftMissing = left.pantryFit?.shoppingMissingCount ?? Number.POSITIVE_INFINITY;
        const rightMissing = right.pantryFit?.shoppingMissingCount ?? Number.POSITIVE_INFINITY;
        return leftMissing !== rightMissing ? leftMissing - rightMissing : left.originalIndex - right.originalIndex;
      }

      if (sortMode === "highest_confidence") {
        const leftConfidence = left.recipe.quality_score ?? 0;
        const rightConfidence = right.recipe.quality_score ?? 0;
        return leftConfidence !== rightConfidence ? rightConfidence - leftConfidence : left.originalIndex - right.originalIndex;
      }

      return left.originalIndex - right.originalIndex;
    })
    .map(({ originalIndex: _originalIndex, ...row }) => row);
}

function countRecipesForCuisineCandidate(
  recipes: RecipeDetail[],
  selectedFilters: RecipeBrowserSelectedFilters,
  cuisineValues: RecipeBrowserMvpCuisineId[],
): number {
  return filterRecipeBrowserRecipes(recipes, {
    ...selectedFilters,
    cuisine: cuisineValues,
  }).length;
}

function countGloballySupportedCuisineCandidate(
  recipes: RecipeDetail[],
  cuisineValues: RecipeBrowserMvpCuisineId[],
): number {
  return countRecipesForCuisineCandidate(recipes, EMPTY_SELECTED_FILTERS, cuisineValues);
}

function countRecipesForIngredientCandidate(
  recipes: RecipeDetail[],
  ingredientValue: RecipeBrowserMvpIngredientId,
): number {
  return filterRecipeBrowserRecipes(recipes, {
    ...EMPTY_SELECTED_FILTERS,
    ingredients: [ingredientValue],
  }).length;
}

function countRecipesForFilterCandidate(
  recipes: RecipeDetail[],
  selectedFilters: RecipeBrowserSelectedFilters,
  familyId: RecipeBrowserMvpFilterFamilyId,
  valueIds: readonly RecipeBrowserMvpFilterValueId[],
): number {
  const currentFamilyValues = selectedFilters[familyId] as RecipeBrowserMvpFilterValueId[];
  const nextFamilyValues = Array.from(new Set([...currentFamilyValues, ...valueIds]));

  return filterRecipeBrowserRecipes(recipes, {
    ...selectedFilters,
    [familyId]: nextFamilyValues,
  } as RecipeBrowserSelectedFilters).length;
}

function getFilterAvailabilityLabel(count: number, isSelected: boolean): string {
  if (isSelected) {
    return "Selected";
  }

  return count > 0 ? `${count}` : "No matches";
}

function getIngredientFamilyLabel(familyId: string): string {
  if (familyId === "dairy_creamy") {
    return "Dairy";
  }

  return INGREDIENT_BROWSE_GROUPS_BY_FAMILY.find((family) => family.id === familyId)?.label ?? familyId;
}

function getSearchFallbackCopy(
  recipes: RecipeDetail[],
  browseNodeId: RecipeBrowserIngredientNodeId,
): string {
  const group = INGREDIENT_BROWSE_GROUPS_BY_FAMILY
    .flatMap((family) => family.nodes.map((node) => ({ family, node })))
    .find((entry) => entry.node.id === browseNodeId);

  if (group?.node.filterId && countRecipesForIngredientCandidate(recipes, group.node.filterId) > 0) {
    return `No exact recipes yet. Try ${group.node.filterLabel ?? group.node.label} instead.`;
  }

  if (group) {
    return `No exact recipes yet. Try ${group.node.label}.`;
  }

  return "No exact recipes yet. Try a broader choice.";
}

function getConsoleChipClass(depth: ConsoleDepth, extraClasses = ""): string {
  return `browser-filter-chip browser-console-bubble browser-console-bubble--${depth}${extraClasses}`;
}

function getImportReviewStatusLabel(status: ImportReviewStatus): string {
  if (status === "pending_review") {
    return "Pending review";
  }

  if (status === "needs_edit") {
    return "Needs edit";
  }

  if (status === "approved") {
    return "Approved for import";
  }

  return "Rejected";
}

function getImportReviewSafetyLabel(flag: string): string {
  return formatDisplayLabel(flag) ?? flag;
}

function getImportedRecipeTrustCopy(record: ImportedRecipeRecord): string {
  if (record.origin === "external_import" && record.verification_status === "imported_reviewed") {
    return "Reviewed external import. Separate from curated verified recipes.";
  }

  return "Imported recipe. Verification status needs review.";
}

function normalizeImportedRecipeIngredient(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ");
}

function importedIngredientMatchesPantry(ingredient: string, pantryNames: string[]): boolean {
  const normalizedIngredient = normalizeImportedRecipeIngredient(ingredient);

  if (!normalizedIngredient) {
    return false;
  }

  return pantryNames.some((pantryName) => {
    const normalizedPantryName = normalizeImportedRecipeIngredient(pantryName);

    return (
      normalizedPantryName.length > 0 &&
      (normalizedIngredient === normalizedPantryName ||
        normalizedIngredient.includes(normalizedPantryName) ||
        normalizedPantryName.includes(normalizedIngredient))
    );
  });
}

function buildImportedRecipePantryFit(
  record: ImportedRecipeRecord,
  pantryNames: string[],
): ImportedRecipePantryFit | null {
  const ingredients = record.ingredients.filter((ingredient) => ingredient.trim().length > 0);

  if (ingredients.length === 0 || pantryNames.length === 0) {
    return null;
  }

  const matchedIngredients = ingredients.filter((ingredient) => importedIngredientMatchesPantry(ingredient, pantryNames));
  const missingIngredients = ingredients.filter((ingredient) => !importedIngredientMatchesPantry(ingredient, pantryNames));

  return {
    matchedIngredients,
    missingIngredients,
    pantryCoveragePct: Math.round((matchedIngredients.length / ingredients.length) * 100),
  };
}

function rankImportedRecipes(
  records: ImportedRecipeRecord[],
  pantryNames: string[],
): RankedImportedRecipe[] {
  return records
    .filter(
      (record) =>
        record.origin === "external_import" &&
        record.verification_status === "imported_reviewed" &&
        record.imported_from_external,
    )
    .map((record, originalIndex) => ({
      record,
      pantryFit: buildImportedRecipePantryFit(record, pantryNames),
      originalIndex,
    }))
    .sort((left, right) => {
      const leftCoverage = left.pantryFit?.pantryCoveragePct ?? -1;
      const rightCoverage = right.pantryFit?.pantryCoveragePct ?? -1;

      if (leftCoverage !== rightCoverage) {
        return rightCoverage - leftCoverage;
      }

      const leftMissing = left.pantryFit?.missingIngredients.length ?? Number.POSITIVE_INFINITY;
      const rightMissing = right.pantryFit?.missingIngredients.length ?? Number.POSITIVE_INFINITY;

      if (leftMissing !== rightMissing) {
        return leftMissing - rightMissing;
      }

      const titleSort = left.record.title.localeCompare(right.record.title);
      return titleSort !== 0 ? titleSort : left.originalIndex - right.originalIndex;
    })
    .map(({ record, pantryFit }) => ({ record, pantryFit }));
}

function getImportedPantryFitSummary(pantryFit: ImportedRecipePantryFit | null): string {
  if (!pantryFit || pantryFit.pantryCoveragePct === null) {
    return "Pantry fit needs saved pantry ingredient names.";
  }

  if (pantryFit.missingIngredients.length === 0) {
    return "Matches your pantry ingredients by name; source and review status stay separate.";
  }

  return `Pantry fit: ${pantryFit.pantryCoveragePct}% ingredient-name match with ${pantryFit.missingIngredients.length} still separate.`;
}

function getImportedRecipeSourceUrl(record: ImportedRecipeRecord): string | null {
  const provenanceSourceUrl = record.provenance["original_source_url"];
  return record.source_url ?? (typeof provenanceSourceUrl === "string" ? provenanceSourceUrl : null);
}

function getImportedRecipeSourceLabel(record: ImportedRecipeRecord): string {
  return [record.provider, record.source_id].filter((value) => value.trim().length > 0).join(" / ") || "Source preserved";
}

function getPromotionReadinessStatusLabel(status: PromotionReadinessItemStatus): string {
  if (status === "met") {
    return "Met";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  return "Needs attention";
}

function getPersistedAuditStatusLabel(status: ImportedRecipePromotionAuditRecord[PromotionAuditFieldId]): string {
  return PROMOTION_AUDIT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "Not started";
}

function getPersistedAuditReadinessLabel(
  readiness: ImportedRecipePromotionAuditRecord["promotion_readiness"],
): string {
  if (readiness === "ready_for_review") {
    return "Audit ready for promotion review";
  }

  if (readiness === "blocked") {
    return "Audit blocked";
  }

  return "Audit not ready";
}

function getProvenanceString(record: ImportedRecipeRecord, key: string): string | null {
  const value = record.provenance[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function hasImportedRecipeSourceIdentity(record: ImportedRecipeRecord): boolean {
  return Boolean(
    record.source.trim() ||
      record.provider.trim() ||
      record.source_id.trim() ||
      getProvenanceString(record, "original_source") ||
      getProvenanceString(record, "original_provider") ||
      getProvenanceString(record, "original_source_id") ||
      getProvenanceString(record, "review_id"),
  );
}

function getPromotionReadinessAssessment(
  record: ImportedRecipeRecord,
  review: ImportReviewRecord | null,
  pantryFit: ImportedRecipePantryFit | null,
): PromotionReadinessAssessment {
  const hasSourceIdentity = hasImportedRecipeSourceIdentity(record);
  const sourceUrl = getImportedRecipeSourceUrl(record);
  const hasTitle = record.title.trim().length > 0;
  const hasIngredients = record.ingredients.some((ingredient) => ingredient.trim().length > 0);
  const hasInstructions = record.instructions.some((instruction) => instruction.trim().length > 0);
  const safetyFlags = review?.safety_flags ?? [];
  const trustFieldsPreserved =
    record.origin === "external_import" &&
    record.verification_status === "imported_reviewed" &&
    record.imported_from_external;

  const items: PromotionReadinessItem[] = [
    {
      id: "reviewed-import-record",
      label: "Reviewed import record",
      status: "met",
      detail: "Import record is present in the reviewed-import layer.",
    },
    {
      id: "trust-fields",
      label: "Trust fields preserved",
      status: trustFieldsPreserved ? "met" : "blocked",
      detail: trustFieldsPreserved
        ? "origin, verification status, and external-import flag still identify this as a reviewed import."
        : "Trust fields must stay reviewed-import only before any promotion review.",
    },
    {
      id: "source-identity",
      label: "Source identity preserved",
      status: hasSourceIdentity ? "met" : "blocked",
      detail: hasSourceIdentity
        ? "Provider, source id, or original provenance identity is still attached."
        : "Source or provider identity is required before promotion review.",
    },
    {
      id: "source-url",
      label: "Source URL or provenance",
      status: sourceUrl || hasSourceIdentity ? "met" : "needs_attention",
      detail: sourceUrl
        ? "Source URL is available for audit."
        : "Source URL is absent, so audit must rely on preserved provenance.",
    },
    {
      id: "title-cleanup",
      label: "Title cleanup",
      status: hasTitle ? "met" : "blocked",
      detail: hasTitle ? "Title is present for promotion review." : "Title needs cleanup before promotion review.",
    },
    {
      id: "ingredient-cleanup",
      label: "Ingredient cleanup",
      status: hasIngredients ? "met" : "blocked",
      detail: hasIngredients
        ? "Ingredients are present for promotion review."
        : "Ingredients need cleanup before promotion review.",
    },
    {
      id: "instruction-cleanup",
      label: "Instruction cleanup",
      status: hasInstructions ? "met" : "blocked",
      detail: hasInstructions
        ? "Instructions are present for promotion review."
        : "Instructions need cleanup before promotion review.",
    },
    {
      id: "safety-flags",
      label: "Safety flags",
      status: safetyFlags.length === 0 ? "met" : "blocked",
      detail:
        safetyFlags.length === 0
          ? "No review safety flags are attached."
          : `${safetyFlags.length} review safety flag${safetyFlags.length === 1 ? "" : "s"} must be resolved.`,
    },
    {
      id: "pantry-feasibility",
      label: "Pantry feasibility",
      status: typeof pantryFit?.pantryCoveragePct === "number" ? "met" : "needs_attention",
      detail:
        typeof pantryFit?.pantryCoveragePct === "number"
          ? `Pantry fit can be explained as ${pantryFit.pantryCoveragePct}% ingredient-name coverage.`
          : "Pantry feasibility still needs saved pantry names or reviewer notes.",
    },
    {
      id: "recipe-existence",
      label: "Recipe existence review",
      status: "needs_attention",
      detail: "Recipe quality and cookability still need an explicit promotion audit.",
    },
    {
      id: "duplicate-review",
      label: "Duplicate review",
      status: "needs_attention",
      detail: "Duplicate and near-duplicate checks are not complete in this cleanup flow.",
    },
    {
      id: "final-confirmation",
      label: "Final promotion confirmation",
      status: "needs_attention",
      detail: "No final curated verified write is available from this panel.",
    },
  ];
  const hasBlockedItem = items.some((item) => item.status === "blocked");

  if (hasBlockedItem) {
    return {
      status: "blocked",
      label: "Needs cleanup before promotion review",
      summary: "Still a reviewed import. Source preserved. Not added to curated verified recipes yet.",
      items,
    };
  }

  return {
    status: "candidate",
    label: "Candidate for promotion review",
    summary: "Readiness only. Still a reviewed import. Not added to curated verified recipes yet.",
    items,
  };
}

function formatImportedAt(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function SourceTrustBadge({ state }: { state: SourceTrustState }) {
  const trustCopy: Record<SourceTrustState, string> = {
    curated_verified: "Curated verified recipe",
    reviewed_import: "Reviewed import",
    external_candidate: "External candidate",
    internal_fallback: "Internal fallback",
    provider_unavailable: "Provider unavailable",
  };

  return (
    <span className={`browser-source-trust-badge browser-source-trust-badge--${state}`}>
      {trustCopy[state]}
    </span>
  );
}

function buildImportReviewCandidate(inspection: DinnerTonightCandidateInspection): ImportReviewCandidate {
  const candidate = inspection.candidate;
  const displayIngredients =
    candidate.display_ingredients && candidate.display_ingredients.length > 0
      ? candidate.display_ingredients
      : inspection.ingredients.map((ingredient) => ingredient.display);

  return {
    source: inspection.source,
    source_id: inspection.source_id,
    source_url: inspection.source_url ?? candidate.source_url ?? null,
    provider: inspection.source,
    display_title: inspection.display_title,
    display_image_url: candidate.image_url ?? null,
    display_ready_minutes: candidate.ready_minutes ?? null,
    display_servings: candidate.servings ?? null,
    display_ingredients: displayIngredients,
    display_instructions: inspection.instructions.steps,
    candidate_provenance: inspection.provenance,
    readiness_bucket: candidate.feasibility_bucket,
    readiness_score: candidate.score,
    used_ingredients: candidate.display_used_ingredients?.length
      ? candidate.display_used_ingredients
      : candidate.used_ingredients,
    missed_ingredients: candidate.display_missed_ingredients?.length
      ? candidate.display_missed_ingredients
      : candidate.missed_ingredients,
  };
}

function RecipeBrowserPage() {
  const [activeFamilyId, setActiveFamilyId] = useState<RecipeBrowserRegistryFamilyId>(DEFAULT_ACTIVE_FAMILY_ID);
  const [activeScopeId, setActiveScopeId] = useState<RecipeBrowserScopeId>(DEFAULT_ACTIVE_SCOPE_ID);
  const [activeIngredientFamilyId, setActiveIngredientFamilyId] = useState<string | null>(
    DEFAULT_ACTIVE_INGREDIENT_FAMILY_ID,
  );
  const [activeIngredientGroupId, setActiveIngredientGroupId] = useState<RecipeBrowserIngredientNodeId | null>(
    DEFAULT_ACTIVE_INGREDIENT_GROUP_ID,
  );
  const [activeCuisineGroupId, setActiveCuisineGroupId] = useState<RecipeBrowserMvpCuisineId | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<RecipeBrowserSelectedFilters>(EMPTY_SELECTED_FILTERS);
  const [filterHistory, setFilterHistory] = useState<FilterHistoryEntry[]>([]);
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState("");
  const [savedSearch, setSavedSearch] = useState<SavedRecipeBrowserSearch | null>(null);
  const [savedSearchFeedback, setSavedSearchFeedback] = useState("");
  const [sortMode, setSortMode] = useState<RecipeBrowserSortMode>("best_pantry_fit");
  const [showOnlyMissingOneItem, setShowOnlyMissingOneItem] = useState(false);
  const [hideExternalCandidateTools, setHideExternalCandidateTools] = useState(false);
  const [showReviewedImportsOnly, setShowReviewedImportsOnly] = useState(false);
  const [recipes, setRecipes] = useState<RecipeDetail[]>([]);
  const [catalogLoadSummary, setCatalogLoadSummary] = useState<RecipeBrowserCatalog | null>(null);
  const [livingFilterCounts, setLivingFilterCounts] = useState<DinnerTonightFilterCounts | null>(null);
  const [livingSelectedFilters, setLivingSelectedFilters] = useState<Record<string, string[]>>({});
  const [livingAppliedBrowserFilterKeys, setLivingAppliedBrowserFilterKeys] = useState<string[]>([]);
  const [livingProviderStatus, setLivingProviderStatus] = useState<DinnerTonightProviderStatus | null>(null);
  const [livingFilterStatus, setLivingFilterStatus] = useState<LivingFilterStatus>("idle");
  const [livingCandidateAvailability, setLivingCandidateAvailability] = useState<LivingCandidateAvailability | null>(null);
  const [inspectableLivingCandidate, setInspectableLivingCandidate] = useState<DinnerTonightCandidate | null>(null);
  const [livingCandidateInspection, setLivingCandidateInspection] = useState<DinnerTonightCandidateInspection | null>(null);
  const [livingCandidateInspectionLoading, setLivingCandidateInspectionLoading] = useState(false);
  const [livingCandidateInspectionError, setLivingCandidateInspectionError] = useState("");
  const [livingCandidateReviewLoading, setLivingCandidateReviewLoading] = useState(false);
  const [livingCandidateReviewFeedback, setLivingCandidateReviewFeedback] = useState("");
  const [importReviewQueue, setImportReviewQueue] = useState<ImportReviewRecord[]>([]);
  const [importReviewQueueLoading, setImportReviewQueueLoading] = useState(false);
  const [importReviewQueueError, setImportReviewQueueError] = useState("");
  const [importReviewUpdatingId, setImportReviewUpdatingId] = useState<string | null>(null);
  const [importedRecipes, setImportedRecipes] = useState<ImportedRecipeRecord[]>([]);
  const [importedRecipesLoading, setImportedRecipesLoading] = useState(false);
  const [importedRecipesError, setImportedRecipesError] = useState("");
  const [selectedImportedRecipeId, setSelectedImportedRecipeId] = useState<string | null>(null);
  const [promotionAuditsByImportId, setPromotionAuditsByImportId] = useState<Record<string, ImportedRecipePromotionAuditRecord>>({});
  const [promotionAuditLoadingId, setPromotionAuditLoadingId] = useState<string | null>(null);
  const [promotionAuditSavingId, setPromotionAuditSavingId] = useState<string | null>(null);
  const [promotionAuditError, setPromotionAuditError] = useState("");
  const [importingReviewId, setImportingReviewId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const {
    pantryNames,
    recommendations,
    loading: pantryRankingLoading,
    error: pantryRankingError,
  } = useSavedPantryRecommendations({
    genericErrorMessage: "Saved pantry ranking is unavailable right now.",
    initialLoading: true,
  });

  const activeFamilyEntry =
    RECIPE_BROWSER_FILTER_FAMILY_REGISTRY.find((family) => family.id === activeFamilyId) ??
    RECIPE_BROWSER_FILTER_FAMILY_REGISTRY[0];
  const activeImplementedFamilyId = getImplementedFamilyId(activeFamilyEntry.id);
  const activeFamily = activeImplementedFamilyId ? RECIPE_BROWSER_MVP_FILTERS[activeImplementedFamilyId] : null;
  const activeScope = RECIPE_BROWSER_SCOPE_OPTIONS.find((scope) => scope.id === activeScopeId) ?? RECIPE_BROWSER_SCOPE_OPTIONS[0];
  const activeFilters = buildActiveFilters(selectedFilters);
  const hasActiveFilters = activeFilters.length > 0;
  const consoleFamilies = useMemo(
    () =>
      DEFAULT_CONSOLE_FAMILY_IDS.map((familyId) =>
        RECIPE_BROWSER_FILTER_FAMILY_REGISTRY.find((family) => family.id === familyId),
      ).filter((family): family is (typeof RECIPE_BROWSER_FILTER_FAMILY_REGISTRY)[number] => Boolean(family)),
    [],
  );
  const desktopFilterMatrix = useMemo(
    () =>
      [
        { label: "Cookability", familyIds: ["time", "meal_type", "household", "diet"] },
        { label: "Cuisine", familyIds: ["cuisine"] },
        { label: "Main Ingredient", familyIds: ["ingredients"] },
        { label: "Cook Method", familyIds: ["method"] },
        { label: "Practical", familyIds: ["cleanup", "cost", "effort"] },
      ].map((column) => ({
        ...column,
        families: column.familyIds
          .map((familyId) => consoleFamilies.find((family) => family.id === familyId))
          .filter((family): family is (typeof RECIPE_BROWSER_FILTER_FAMILY_REGISTRY)[number] => Boolean(family)),
      })),
    [consoleFamilies],
  );
  const ingredientSearchResults = useMemo(
    () => searchIngredientBrowseNodes(ingredientSearchQuery),
    [ingredientSearchQuery],
  );
  const hasIngredientSearchQuery = ingredientSearchQuery.trim().length > 0;
  const eligibleRecipes = useMemo(
    () => filterRecipeBrowserRecipes(recipes, selectedFilters),
    [recipes, selectedFilters],
  );
  const visibleIngredientFamilies = useMemo(
    () => INGREDIENT_BROWSE_GROUPS_BY_FAMILY.filter((family) => DEFAULT_INGREDIENT_CONSOLE_FAMILY_IDS.has(family.id)),
    [],
  );
  const activeIngredientFamily = useMemo(
    () => visibleIngredientFamilies.find((family) => family.id === activeIngredientFamilyId) ?? null,
    [activeIngredientFamilyId, visibleIngredientFamilies],
  );
  const activeIngredientGroup = useMemo(
    () =>
      activeIngredientFamily?.nodes.find((group) => group.id === activeIngredientGroupId) ??
      null,
    [activeIngredientFamily, activeIngredientGroupId],
  );
  const supportedActiveIngredientLeaves = useMemo(
    () =>
      activeIngredientGroup?.ingredients.filter(
        (option) =>
          option.id !== activeIngredientGroup.filterId &&
          countRecipesForIngredientCandidate(recipes, option.id) > 0,
      ) ?? [],
    [activeIngredientGroup, recipes],
  );
  const visibleCuisineGroups = useMemo(() => {
    return RECIPE_BROWSER_MVP_CUISINE_GROUPS.flatMap((group) => {
      const parentOption = RECIPE_BROWSER_MVP_FILTERS.cuisine.options.find((option) => option.id === group.id);
      const parentMatchCount = countGloballySupportedCuisineCandidate(recipes, [group.id]);

      if (!parentOption || parentMatchCount === 0) {
        return [];
      }

      const childOptions = group.childIds
        .map((childId) => RECIPE_BROWSER_MVP_FILTERS.cuisine.options.find((option) => option.id === childId))
        .filter((option): option is NonNullable<typeof option> => Boolean(option))
        .filter((option) => countGloballySupportedCuisineCandidate(recipes, [group.id, option.id]) > 0);

      return [{
        ...group,
        parentOption,
        childOptions,
      }];
    });
  }, [recipes]);
  const ingredientRecoverySuggestions = useMemo(
    () =>
      activeScopeId === "explore_all"
        ? getRecipeBrowserIngredientRecoverySuggestions(recipes, selectedFilters)
        : [],
    [activeScopeId, recipes, selectedFilters],
  );
  const activeRecommendations = pantryRankingError ? null : recommendations;
  const hasSavedPantry = pantryNames.length > 0;
  const livingFilterFacets = useMemo(() => getLivingFilterFacets(livingFilterCounts), [livingFilterCounts]);
  const selectedLivingFilterFacets = useMemo(
    () => getSelectedLivingFilterFacets(livingSelectedFilters, livingFilterCounts),
    [livingFilterCounts, livingSelectedFilters],
  );
  const livingSelectedFilterCount = selectedLivingFilterFacets.length;
  const hasLivingSelectedFilters = livingSelectedFilterCount > 0;
  const livingSelectedFiltersKey = JSON.stringify(livingSelectedFilters);
  const livingFilterProviderCopy = useMemo(
    () =>
      getLivingFilterProviderCopy(
        livingFilterStatus,
        livingProviderStatus,
        hasSavedPantry,
        livingFilterFacets.length,
        livingCandidateAvailability,
      ),
    [hasSavedPantry, livingCandidateAvailability, livingFilterFacets.length, livingFilterStatus, livingProviderStatus],
  );
  const livingCandidateAvailabilityCopy = useMemo(
    () =>
      getLivingCandidateAvailabilityCopy(
        livingFilterStatus,
        livingProviderStatus,
        livingCandidateAvailability,
        hasSavedPantry,
      ),
    [hasSavedPantry, livingCandidateAvailability, livingFilterStatus, livingProviderStatus],
  );
  const rankedRecipes = useMemo(
    () => rankRecipeBrowserRecipes(eligibleRecipes, activeRecommendations),
    [activeRecommendations, eligibleRecipes],
  );
  const rankedImportedRecipes = useMemo(
    () => rankImportedRecipes(importedRecipes, pantryNames),
    [importedRecipes, pantryNames],
  );
  const selectedImportedRecipePreview: ImportedRecipePreview | null = useMemo(() => {
    if (!selectedImportedRecipeId) {
      return null;
    }

    const rankedImport = rankedImportedRecipes.find(({ record }) => record.import_id === selectedImportedRecipeId);
    if (!rankedImport) {
      return null;
    }

    return {
      ...rankedImport,
      review: importReviewQueue.find((record) => record.review_id === rankedImport.record.review_id) ?? null,
    };
  }, [importReviewQueue, rankedImportedRecipes, selectedImportedRecipeId]);
  const hasPantryScopeData = Boolean(activeRecommendations);
  const scopedRecipes = useMemo(
    () => filterRankedRecipesByScope(rankedRecipes, activeScopeId, hasPantryScopeData),
    [activeScopeId, hasPantryScopeData, rankedRecipes],
  );
  const hasScopedLowResultState =
    scopedRecipes.length > 0 && scopedRecipes.length <= 2 && (hasActiveFilters || activeScopeId !== "explore_all");
  const hasPartialCatalogFailures = (catalogLoadSummary?.failedRecipeCount ?? 0) > 0;
  const scopeCounts = useMemo(
    () =>
      new Map<RecipeBrowserScopeId, number>(
        RECIPE_BROWSER_SCOPE_OPTIONS.map((scope) => [
          scope.id,
          filterRankedRecipesByScope(rankedRecipes, scope.id, hasPantryScopeData).length,
        ]),
      ),
    [hasPantryScopeData, rankedRecipes],
  );
  const latestActiveFilter = useMemo(() => {
    const activeFilterByKey = new Map<string, ActiveFilter>(
      activeFilters.map((filter) => [`${filter.familyId}:${filter.valueId}`, filter]),
    );

    for (let index = filterHistory.length - 1; index >= 0; index -= 1) {
      const historyEntry = filterHistory[index];
      const activeFilter = activeFilterByKey.get(`${historyEntry.familyId}:${historyEntry.valueId}`);

      if (activeFilter) {
        return activeFilter;
      }
    }

    return null;
  }, [activeFilters, filterHistory]);
  const clearableFamily = useMemo(() => {
    if (latestActiveFilter) {
      const activeCount = selectedFilters[latestActiveFilter.familyId].length;

      if (activeCount > 0) {
        return {
          familyId: latestActiveFilter.familyId,
          familyLabel: getImplementedFamilyLabel(latestActiveFilter.familyId),
          activeCount,
        };
      }
    }

    for (const family of RECIPE_BROWSER_MVP_FILTER_ORDER) {
      const activeCount = selectedFilters[family.id].length;

      if (activeCount > 0) {
        return {
          familyId: family.id,
          familyLabel: getImplementedFamilyLabel(family.id),
          activeCount,
        };
      }
    }

    return null;
  }, [latestActiveFilter, selectedFilters]);
  const canShowClosestEligibleMatches = activeScopeId !== "explore_all" && eligibleRecipes.length > 0;
  const activeFilterGroups = useMemo(() => {
    const groupedFilters = new Map<RecipeBrowserMvpFilterFamilyId, ActiveFilterGroup>();

    for (const filter of activeFilters) {
      const existingGroup = groupedFilters.get(filter.familyId);
      if (existingGroup) {
        existingGroup.filters.push(filter);
        continue;
      }

      groupedFilters.set(filter.familyId, {
        familyId: filter.familyId,
        familyLabel: getImplementedFamilyLabel(filter.familyId),
        filters: [filter],
      });
    }

    return Array.from(groupedFilters.values());
  }, [activeFilters]);
  const filterIntelligenceSummary = useMemo(() => {
    if (!hasSavedPantry) {
      return "Filter counts show recipe relevance; save pantry items to connect them to tonight-fit readiness.";
    }

    if (activeRecommendations) {
      const cookNowCount = scopeCounts.get("cook_now") ?? 0;
      const almostThereCount = scopeCounts.get("almost_there") ?? 0;

      return `${cookNowCount} pantry-ready option${cookNowCount === 1 ? "" : "s"} and ${almostThereCount} almost-there option${almostThereCount === 1 ? "" : "s"} remain after the current recipe filters.`;
    }

    if (pantryRankingLoading) {
      return "Filter counts are recipe-backed while pantry-fit readiness is still loading.";
    }

    return "Filter counts are recipe-backed; pantry-fit readiness is unavailable for this session.";
  }, [activeRecommendations, hasSavedPantry, pantryRankingLoading, scopeCounts]);

  const selectedSortOption =
    RECIPE_BROWSER_SORT_OPTIONS.find((option) => option.value === sortMode) ?? RECIPE_BROWSER_SORT_OPTIONS[0];

  const sortLabel = useMemo(() => {
    if (sortMode !== "best_pantry_fit") {
      return `Sorted by: ${selectedSortOption.label}`;
    }

    if (activeRecommendations) {
      return "Sorted by: Best Pantry Match";
    }

    if (pantryRankingLoading) {
      return "Sorted by: Checking saved pantry";
    }

    if (pantryRankingError) {
      return "Sorted by: Pantry match unavailable";
    }

    if (hasSavedPantry) {
      return "Sorted by: Eligible recipe order";
    }

    return "Sorted by: Add pantry items to rank";
  }, [activeRecommendations, hasSavedPantry, pantryRankingError, pantryRankingLoading, selectedSortOption.label, sortMode]);

  const sortExplanation = useMemo(() => {
    if (sortMode === "fastest") {
      return "Recipe Browser is sorting eligible rows by shortest known total time; Dinner Tonight ranking is unchanged.";
    }

    if (sortMode === "fewest_missing") {
      return "Recipe Browser is sorting eligible rows by the fewest shopping-missing ingredients.";
    }

    if (sortMode === "most_trusted") {
      return "Curated verified rows remain ahead in this browser; reviewed imports stay in their separate lane.";
    }

    if (sortMode === "recently_imported") {
      return "Recently imported applies to the reviewed-import lane; curated rows keep their current order.";
    }

    if (sortMode === "highest_confidence") {
      return "Recipe Browser is sorting eligible rows by recipe quality confidence where available.";
    }

    if (activeRecommendations) {
      return `Using ${pantryNames.length} saved pantry item${pantryNames.length === 1 ? "" : "s"} to rank the eligible set by tonight fit.`;
    }

    if (pantryRankingLoading) {
      return "Checking saved pantry items so tonight-fit ranking can load.";
    }

    if (pantryRankingError) {
      return "Pantry-fit ranking is unavailable, so the eligible set stays in its current order.";
    }

    if (hasSavedPantry) {
      return "Your pantry is saved, but live ranking did not load, so the eligible set keeps its current order.";
    }

    return "Add pantry items to unlock pantry-fit sorting and result badges.";
  }, [activeRecommendations, hasSavedPantry, pantryNames.length, pantryRankingError, pantryRankingLoading, sortMode]);

  const scopeExplanation = useMemo(() => {
    if (activeScopeId === "explore_all") {
      return "Explore All shows the full eligible set.";
    }

    if (hasPantryScopeData) {
      return `${activeScope.label} narrows the eligible set to that pantry-fit bucket.`;
    }

    if (pantryRankingLoading) {
      return `${activeScope.label} opens once pantry-fit ranking finishes loading.`;
    }

    if (pantryRankingError) {
      return `${activeScope.label} needs pantry-fit ranking, so this session stays on Explore All.`;
    }

    if (hasSavedPantry) {
      return `${activeScope.label} needs pantry-fit ranking data for this session.`;
    }

    return `${activeScope.label} needs saved pantry items.`;
  }, [activeScope.label, activeScopeId, hasPantryScopeData, hasSavedPantry, pantryRankingError, pantryRankingLoading]);

  const visibleScopedRecipes = useMemo(() => {
    const utilityFilteredRows = showOnlyMissingOneItem
      ? scopedRecipes.filter((entry) => entry.pantryFit?.shoppingMissingCount === 1)
      : scopedRecipes;

    if (sortMode === "best_pantry_fit" || sortMode === "most_trusted" || sortMode === "recently_imported") {
      return utilityFilteredRows;
    }

    return sortRecipeBrowserRows(utilityFilteredRows, sortMode);
  }, [scopedRecipes, showOnlyMissingOneItem, sortMode]);

  const resultCountLabel = useMemo(() => {
    if (loading) {
      return "Loading recipes...";
    }

    if (showReviewedImportsOnly) {
      return `${rankedImportedRecipes.length} reviewed import${rankedImportedRecipes.length === 1 ? "" : "s"}`;
    }

    if (activeScopeId === "explore_all") {
      return `${visibleScopedRecipes.length} eligible recipe${visibleScopedRecipes.length === 1 ? "" : "s"}`;
    }

    return `${visibleScopedRecipes.length} recipe${visibleScopedRecipes.length === 1 ? "" : "s"} in ${activeScope.label}`;
  }, [activeScope.label, activeScopeId, loading, rankedImportedRecipes.length, showReviewedImportsOnly, visibleScopedRecipes.length]);

  const pantryStatusLabel = useMemo(
    () => getPantryStatusLabel(activeRecommendations, pantryRankingLoading, pantryRankingError, hasSavedPantry),
    [activeRecommendations, hasSavedPantry, pantryRankingError, pantryRankingLoading],
  );
  const pantryStatusTone = useMemo(
    () => getPantryStatusTone(activeRecommendations, pantryRankingLoading, pantryRankingError, hasSavedPantry),
    [activeRecommendations, hasSavedPantry, pantryRankingError, pantryRankingLoading],
  );

  useEffect(() => {
    try {
      const rawSavedSearch = window.localStorage.getItem(SAVED_RECIPE_BROWSER_SEARCH_KEY);
      if (rawSavedSearch) {
        setSavedSearch(JSON.parse(rawSavedSearch) as SavedRecipeBrowserSearch);
      }
    } catch {
      setSavedSearch(null);
    }
  }, []);

  const showLowResultState =
    visibleScopedRecipes.length > 0 &&
    visibleScopedRecipes.length <= 2 &&
    (hasScopedLowResultState || showOnlyMissingOneItem);

  useEffect(() => {
    let cancelled = false;

    async function loadBrowserRecipes() {
      setLoading(true);
      setError("");

      try {
        const nextCatalog = await fetchRecipeBrowserCatalog();
        if (!cancelled) {
          setRecipes(nextCatalog.recipes);
          setCatalogLoadSummary(nextCatalog);
        }
      } catch (requestError: unknown) {
        if (!cancelled) {
          setCatalogLoadSummary(null);
          setError(requestError instanceof Error ? requestError.message : "Recipe Browser failed to load.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadBrowserRecipes();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadImportReviewQueue() {
      setImportReviewQueueLoading(true);
      setImportReviewQueueError("");

      try {
        const records = await fetchImportReviews();
        if (!cancelled) {
          setImportReviewQueue(records);
        }
      } catch (requestError: unknown) {
        if (!cancelled) {
          setImportReviewQueue([]);
          setImportReviewQueueError(
            requestError instanceof Error ? requestError.message : "Review queue is unavailable right now.",
          );
        }
      } finally {
        if (!cancelled) {
          setImportReviewQueueLoading(false);
        }
      }
    }

    void loadImportReviewQueue();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadImportedRecipes() {
      setImportedRecipesLoading(true);
      setImportedRecipesError("");

      try {
        const records = await fetchImportedRecipes();
        if (!cancelled) {
          setImportedRecipes(records);
        }
      } catch (requestError: unknown) {
        if (!cancelled) {
          setImportedRecipes([]);
          setImportedRecipesError(
            requestError instanceof Error ? requestError.message : "Reviewed imported recipes are unavailable right now.",
          );
        }
      } finally {
        if (!cancelled) {
          setImportedRecipesLoading(false);
        }
      }
    }

    void loadImportedRecipes();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLivingFilters() {
      if (pantryNames.length === 0) {
        setLivingFilterCounts(null);
        setLivingProviderStatus(null);
        setLivingFilterStatus("idle");
        setLivingCandidateAvailability(null);
        setInspectableLivingCandidate(null);
        setLivingCandidateInspection(null);
        setLivingCandidateInspectionError("");
        setLivingCandidateReviewFeedback("");
        return;
      }

      setLivingFilterStatus("loading");

      try {
        const response = await fetchDinnerTonightCandidates({
          ingredients: pantryNames,
          limit: 10,
          selected_filters: livingSelectedFilters,
          filter_mode: "all",
        });

        if (cancelled) {
          return;
        }

        setLivingProviderStatus(response.provider_status);
        if (response.provider_status === "configured" && response.filter_counts) {
          setLivingFilterCounts(response.filter_counts);
          setLivingCandidateAvailability({
            count: response.candidates.length,
            bestTitle: response.best?.display_title?.trim() || response.best?.title || null,
          });
          setInspectableLivingCandidate(response.best ?? response.candidates[0] ?? null);
          setLivingCandidateInspection(null);
          setLivingCandidateInspectionError("");
          setLivingCandidateReviewFeedback("");
          setLivingFilterStatus("live");
          return;
        }

        setLivingFilterCounts(null);
        setLivingCandidateAvailability(null);
        setInspectableLivingCandidate(null);
        setLivingCandidateInspection(null);
        setLivingCandidateInspectionError("");
        setLivingCandidateReviewFeedback("");
        setLivingFilterStatus("unavailable");
      } catch {
        if (!cancelled) {
          setLivingFilterCounts(null);
          setLivingCandidateAvailability(null);
          setInspectableLivingCandidate(null);
          setLivingCandidateInspection(null);
          setLivingCandidateInspectionError("");
          setLivingCandidateReviewFeedback("");
          setLivingProviderStatus("error");
          setLivingFilterStatus("unavailable");
        }
      }
    }

    void loadLivingFilters();

    return () => {
      cancelled = true;
    };
  }, [livingSelectedFilters, livingSelectedFiltersKey, pantryNames]);

  useEffect(() => {
    if (!selectedImportedRecipeId || promotionAuditsByImportId[selectedImportedRecipeId]) {
      return;
    }

    let cancelled = false;

    async function loadPromotionAudit(importId: string) {
      setPromotionAuditLoadingId(importId);
      setPromotionAuditError("");

      try {
        const audit = await fetchImportedRecipePromotionAudit(importId);
        if (!cancelled) {
          setPromotionAuditsByImportId((current) => ({
            ...current,
            [audit.import_id]: audit,
          }));
        }
      } catch (requestError: unknown) {
        if (!cancelled) {
          setPromotionAuditError(
            requestError instanceof Error ? requestError.message : "Promotion audit state is unavailable right now.",
          );
        }
      } finally {
        if (!cancelled) {
          setPromotionAuditLoadingId(null);
        }
      }
    }

    void loadPromotionAudit(selectedImportedRecipeId);

    return () => {
      cancelled = true;
    };
  }, [promotionAuditsByImportId, selectedImportedRecipeId]);

  useEffect(() => {
    if (activeScopeId !== "explore_all" && !hasPantryScopeData) {
      setActiveScopeId("explore_all");
    }
  }, [activeScopeId, hasPantryScopeData]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, familyId: RecipeBrowserRegistryFamilyId) {
    const enabledFamilies = consoleFamilies.filter((family) => family.enabled);
    const currentIndex = enabledFamilies.findIndex((family) => family.id === familyId);

    if (currentIndex < 0) {
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex =
        (currentIndex + direction + enabledFamilies.length) % enabledFamilies.length;
      setActiveFamilyId(enabledFamilies[nextIndex].id);
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveFamilyId(enabledFamilies[0].id);
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveFamilyId(enabledFamilies[enabledFamilies.length - 1].id);
    }
  }

  function toggleFilterValue(familyId: RecipeBrowserMvpFilterFamilyId, valueId: RecipeBrowserMvpFilterValueId) {
    const isSelected = (selectedFilters[familyId] as readonly RecipeBrowserMvpFilterValueId[]).includes(valueId);

    setSelectedFilters((current) => {
      const currentValues = current[familyId] as RecipeBrowserMvpFilterValueId[];
      const nextValues = currentValues.includes(valueId)
        ? currentValues.filter((currentValueId) => currentValueId !== valueId)
        : [...currentValues, valueId];

      return {
        ...current,
        [familyId]: nextValues,
      } as RecipeBrowserSelectedFilters;
    });

    setFilterHistory((current) => {
      const nextHistory = current.filter(
        (entry) => !(entry.familyId === familyId && entry.valueId === valueId),
      );

      if (isSelected) {
        return nextHistory;
      }

      return [...nextHistory, { familyId, valueId }];
    });
  }

  function addFilterValue(familyId: RecipeBrowserMvpFilterFamilyId, valueId: RecipeBrowserMvpFilterValueId) {
    if ((selectedFilters[familyId] as readonly RecipeBrowserMvpFilterValueId[]).includes(valueId)) {
      return;
    }

    setSelectedFilters((current) => ({
      ...current,
      [familyId]: [...(current[familyId] as RecipeBrowserMvpFilterValueId[]), valueId],
    }) as RecipeBrowserSelectedFilters);

    setFilterHistory((current) => [
      ...current.filter((entry) => !(entry.familyId === familyId && entry.valueId === valueId)),
      { familyId, valueId },
    ]);
  }

  function removeActiveFilter(familyId: RecipeBrowserMvpFilterFamilyId, valueId: RecipeBrowserMvpFilterValueId) {
    setSelectedFilters((current) => ({
      ...current,
      [familyId]: (current[familyId] as RecipeBrowserMvpFilterValueId[]).filter(
        (currentValueId) => currentValueId !== valueId,
      ),
    }) as RecipeBrowserSelectedFilters);
    setFilterHistory((current) =>
      current.filter((entry) => !(entry.familyId === familyId && entry.valueId === valueId)),
    );
  }

  function clearAllFilters() {
    setSelectedFilters(EMPTY_SELECTED_FILTERS);
    setFilterHistory([]);
    setActiveIngredientFamilyId(DEFAULT_ACTIVE_INGREDIENT_FAMILY_ID);
    setActiveIngredientGroupId(DEFAULT_ACTIVE_INGREDIENT_GROUP_ID);
    setActiveCuisineGroupId(DEFAULT_ACTIVE_CUISINE_GROUP_ID);
  }

  function saveCurrentSearch() {
    const nextSavedSearch = {
      selectedFilters,
      activeScopeId,
    };

    setSavedSearch(nextSavedSearch);
    setSavedSearchFeedback("Saved current search on this device.");
    window.localStorage.setItem(SAVED_RECIPE_BROWSER_SEARCH_KEY, JSON.stringify(nextSavedSearch));
  }

  function loadSavedSearch() {
    if (!savedSearch) {
      setSavedSearchFeedback("No saved Recipe Browser search is available yet.");
      return;
    }

    setSelectedFilters(savedSearch.selectedFilters);
    setActiveScopeId(savedSearch.activeScopeId);
    setFilterHistory(buildActiveFilters(savedSearch.selectedFilters).map((filter) => ({
      familyId: filter.familyId,
      valueId: filter.valueId,
    })));
    setSavedSearchFeedback("Loaded saved search from this device.");
  }

  function resetToPantryReady() {
    clearAllFilters();
    setShowOnlyMissingOneItem(false);
    setShowReviewedImportsOnly(false);
    setActiveScopeId(hasPantryScopeData ? "cook_now" : "explore_all");
  }

  function clearFilterFamily(familyId: RecipeBrowserMvpFilterFamilyId) {
    setSelectedFilters((current) => ({
      ...current,
      [familyId]: [],
    }) as RecipeBrowserSelectedFilters);
    setFilterHistory((current) => current.filter((entry) => entry.familyId !== familyId));
    setActiveFamilyId(getRegistryFamilyIdForImplementedFamily(familyId));
  }

  function widenScopeToExploreAll() {
    setActiveScopeId("explore_all");
  }

  function removeLatestFilter() {
    if (!latestActiveFilter) {
      return;
    }

    removeActiveFilter(latestActiveFilter.familyId, latestActiveFilter.valueId);
  }

  function openIngredientFamily(familyId: string) {
    setActiveIngredientFamilyId(familyId);
    setActiveIngredientGroupId((currentGroupId) => {
      const currentGroupIsInFamily = INGREDIENT_BROWSE_GROUPS_BY_FAMILY
        .find((family) => family.id === familyId)
        ?.nodeIds.some((nodeId) => nodeId === currentGroupId);

      return currentGroupIsInFamily ? currentGroupId : null;
    });
  }

  function openIngredientGroup(familyId: string, groupId: RecipeBrowserIngredientNodeId) {
    setActiveIngredientFamilyId(familyId);
    setActiveIngredientGroupId(groupId);
  }

  function toggleIngredientBrowseGroup(
    familyId: string,
    groupId: RecipeBrowserIngredientNodeId,
    filterId: RecipeBrowserMvpFilterValueId | undefined,
    childFilterIds: readonly RecipeBrowserMvpIngredientId[] = [],
  ) {
    openIngredientGroup(familyId, groupId);

    if (filterId) {
      toggleParentIngredientFilter(filterId, childFilterIds);
    }
  }

  function toggleParentIngredientFilter(
    parentFilterId: RecipeBrowserMvpFilterValueId,
    childFilterIds: readonly RecipeBrowserMvpIngredientId[] = [],
  ) {
    const parentIsSelected = isParentFilterSelected(selectedFilters, parentFilterId);

    if (!parentIsSelected) {
      toggleFilterValue("ingredients", parentFilterId);
      return;
    }

    const removableFilterIds = new Set<RecipeBrowserMvpFilterValueId>([
      parentFilterId,
      ...childFilterIds,
    ]);

    setSelectedFilters((current) => ({
      ...current,
      ingredients: current.ingredients.filter((ingredientId) => !removableFilterIds.has(ingredientId)),
    }) as RecipeBrowserSelectedFilters);
    setFilterHistory((current) =>
      current.filter((entry) => !(entry.familyId === "ingredients" && removableFilterIds.has(entry.valueId))),
    );
  }

  function toggleChildIngredientFilter(childFilter: ParentIngredientChildFilter) {
    if (!childFilter.filterId) {
      return;
    }

    toggleFilterValue("ingredients", childFilter.filterId);
  }

  function toggleCuisineGroup(cuisineGroupId: RecipeBrowserMvpCuisineId) {
    setActiveCuisineGroupId(cuisineGroupId);
    toggleFilterValue("cuisine", cuisineGroupId);
  }

  function toggleLivingFilter(familyId: LivingFilterFamilyId, value: string) {
    const mapping = getLivingFacetBrowserMapping(familyId, value);
    const mappingKey = mapping ? getLivingFacetBrowserKey(mapping) : null;
    const isLivingSelected = livingSelectedFilters[familyId]?.includes(value) ?? false;
    const browserFilterAlreadySelected = mapping
      ? (selectedFilters[mapping.familyId] as readonly RecipeBrowserMvpFilterValueId[]).includes(mapping.valueId)
      : false;

    setLivingSelectedFilters((current) => {
      const currentValues = current[familyId] ?? [];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((currentValue) => currentValue !== value)
        : [...currentValues, value];

      if (nextValues.length === 0) {
        const nextFilters = { ...current };
        delete nextFilters[familyId];
        return nextFilters;
      }

      return {
        ...current,
        [familyId]: nextValues,
      };
    });

    if (!mapping || !mappingKey) {
      return;
    }

    if (isLivingSelected) {
      if (livingAppliedBrowserFilterKeys.includes(mappingKey)) {
        removeActiveFilter(mapping.familyId, mapping.valueId);
        setLivingAppliedBrowserFilterKeys((current) => current.filter((key) => key !== mappingKey));
      }
      return;
    }

    if (!browserFilterAlreadySelected) {
      addFilterValue(mapping.familyId, mapping.valueId);
      setLivingAppliedBrowserFilterKeys((current) =>
        current.includes(mappingKey) ? current : [...current, mappingKey],
      );
    }
    setActiveFamilyId(getRegistryFamilyIdForImplementedFamily(mapping.familyId));
  }

  function clearLivingFilters() {
    for (const key of livingAppliedBrowserFilterKeys) {
      const mapping = parseLivingFacetBrowserKey(key);
      if (mapping) {
        removeActiveFilter(mapping.familyId, mapping.valueId);
      }
    }
    setLivingAppliedBrowserFilterKeys([]);
    setLivingSelectedFilters({});
  }

  async function inspectLivingCandidate() {
    if (!inspectableLivingCandidate) {
      return;
    }

    setLivingCandidateInspectionLoading(true);
    setLivingCandidateInspectionError("");

    try {
      const inspection = await inspectDinnerTonightCandidate(inspectableLivingCandidate);
      setLivingCandidateInspection(inspection);
      setLivingCandidateReviewFeedback("");
    } catch (requestError: unknown) {
      setLivingCandidateInspection(null);
      setLivingCandidateInspectionError(
        requestError instanceof Error ? requestError.message : "Live candidate details are unavailable right now.",
      );
    } finally {
      setLivingCandidateInspectionLoading(false);
    }
  }

  async function requestExternalCandidateReview() {
    if (!livingCandidateInspection) {
      return;
    }

    setLivingCandidateReviewLoading(true);
    setLivingCandidateReviewFeedback("");

    try {
      const record = await createImportReview(buildImportReviewCandidate(livingCandidateInspection));
      setImportReviewQueue((current) => [
        record,
        ...current.filter((item) => item.review_id !== record.review_id),
      ]);
      setLivingCandidateReviewFeedback(
        "Queued for review. This candidate was not imported into the verified recipe bank.",
      );
    } catch (requestError: unknown) {
      setLivingCandidateReviewFeedback(
        requestError instanceof Error
          ? requestError.message
          : "Review request could not be queued right now. This candidate was not imported.",
      );
    } finally {
      setLivingCandidateReviewLoading(false);
    }
  }

  async function updateReviewQueueStatus(reviewId: string, status: ImportReviewStatus) {
    setImportReviewUpdatingId(reviewId);
    setImportReviewQueueError("");

    try {
      const updatedRecord = await updateImportReview(reviewId, { status });
      setImportReviewQueue((current) =>
        current.map((record) => (record.review_id === reviewId ? updatedRecord : record)),
      );
    } catch (requestError: unknown) {
      setImportReviewQueueError(
        requestError instanceof Error ? requestError.message : "Review queue update failed.",
      );
    } finally {
      setImportReviewUpdatingId(null);
    }
  }

  async function importApprovedReviewRecord(reviewId: string) {
    setImportingReviewId(reviewId);
    setImportedRecipesError("");

    try {
      const imported = await importApprovedReview(reviewId);
      setImportedRecipes((current) => [
        imported,
        ...current.filter((record) => record.import_id !== imported.import_id),
      ]);
    } catch (requestError: unknown) {
      setImportedRecipesError(
        requestError instanceof Error ? requestError.message : "Approved review could not be imported right now.",
      );
    } finally {
      setImportingReviewId(null);
    }
  }

  async function saveReviewedImportCleanup(
    importId: string,
    payload: ImportedRecipeCleanupUpdateRequest,
  ) {
    setImportedRecipesError("");

    try {
      const updated = await updateImportedRecipeCleanup(importId, payload);
      setImportedRecipes((current) =>
        current.map((record) => (record.import_id === updated.import_id ? updated : record)),
      );
    } catch (requestError: unknown) {
      const message =
        requestError instanceof Error ? requestError.message : "Reviewed import cleanup could not be saved right now.";
      setImportedRecipesError(message);
      throw requestError instanceof Error ? requestError : new Error(message);
    }
  }

  async function savePromotionAudit(
    importId: string,
    payload: ImportedRecipePromotionAuditUpdateRequest,
  ) {
    setPromotionAuditSavingId(importId);
    setPromotionAuditError("");

    try {
      const audit = await updateImportedRecipePromotionAudit(importId, payload);
      setPromotionAuditsByImportId((current) => ({
        ...current,
        [audit.import_id]: audit,
      }));
    } catch (requestError: unknown) {
      const message =
        requestError instanceof Error ? requestError.message : "Promotion audit state could not be saved right now.";
      setPromotionAuditError(message);
      throw requestError instanceof Error ? requestError : new Error(message);
    } finally {
      setPromotionAuditSavingId(null);
    }
  }

  function applyIngredientSearchResult(
    valueId: RecipeBrowserMvpFilterValueId,
    browseNodeId: RecipeBrowserIngredientNodeId,
  ) {
    addFilterValue("ingredients", valueId);
    setActiveFamilyId("ingredients");
    setActiveIngredientFamilyId(getIngredientFamilyIdForNodeId(browseNodeId));
    setActiveIngredientGroupId(browseNodeId);
    setIngredientSearchQuery("");
  }

  function replaceIngredientFilter(
    sourceIngredientId: RecipeBrowserMvpFilterValueId,
    targetIngredientId: RecipeBrowserMvpFilterValueId,
  ) {
    const targetOption = RECIPE_BROWSER_MVP_FILTERS.ingredients.options.find((option) => option.id === targetIngredientId);

    setSelectedFilters((current) => ({
      ...current,
      ingredients: Array.from(
        new Set(current.ingredients.map((ingredientId) => (ingredientId === sourceIngredientId ? targetIngredientId : ingredientId))),
      ),
    }) as RecipeBrowserSelectedFilters);
    setFilterHistory((current) => {
      const nextHistory = current.filter(
        (entry) => !(entry.familyId === "ingredients" && entry.valueId === sourceIngredientId),
      );

      if (nextHistory.some((entry) => entry.familyId === "ingredients" && entry.valueId === targetIngredientId)) {
        return nextHistory;
      }

      return [...nextHistory, { familyId: "ingredients", valueId: targetIngredientId }];
    });
    setActiveFamilyId("ingredients");
    if (targetOption?.browseNodeIds[0]) {
      setActiveIngredientFamilyId(getIngredientFamilyIdForNodeId(targetOption.browseNodeIds[0]));
      setActiveIngredientGroupId(targetOption.browseNodeIds[0]);
    }
  }

  return (
    <main className="page-shell recipe-browser-page">
      <PageHero
        pageTitle="Recipe Browser"
        tagline="Browse your options. Choose what fits. Cook with confidence."
      />

      <section className="recipe-browser-utility-strip" aria-label="Recipe Browser session status">
        <div className="recipe-browser-utility-copy">
          <p className="recipe-browser-utility-kicker">Browsing session</p>
          <p className="recipe-browser-utility-note">Pantry context and filter state stay visible here while the hero stays clean.</p>
        </div>
        <div className="recipe-browser-header-status">
          <span className="recipe-browser-status-pill">
            {hasSavedPantry
              ? `${pantryNames.length} saved pantry item${pantryNames.length === 1 ? "" : "s"}`
              : "No saved pantry"}
          </span>
          <span className="recipe-browser-status-pill">
            {hasActiveFilters
              ? `${activeFilters.length} active filter${activeFilters.length === 1 ? "" : "s"}`
              : "No active filters"}
          </span>
          <span className="recipe-browser-status-pill">
            {activeScopeId === "explore_all" ? "Browsing all eligible recipes" : activeScope.label}
          </span>
        </div>
      </section>

      <section className="recipe-browser-workspace-shell" aria-label="Recipe Browser workspace">
        <aside className="recipe-browser-local-rail" aria-label="Recipe Browser local workspace rail">
          <div className="recipe-browser-local-brand">
            <span className="recipe-browser-local-brand-mark" aria-hidden="true">PTP</span>
            <span>
              <strong>Pantry to Plate</strong>
              <small>Pantry-aware recipes</small>
            </span>
          </div>
          <div className="recipe-browser-local-rail-group" aria-label="Browser workspace sections">
            <p>Browse</p>
            <span className="is-active">Recipe Browser</span>
            <span>Pantry Overview</span>
            <span>Shopping List</span>
            <span>Meal Planner</span>
          </div>
          <div className="recipe-browser-local-rail-group" aria-label="Discovery sections">
            <p>Discover</p>
            <span>What Can I Make?</span>
            <span>Use Up Leftovers</span>
            <span>Seasonal Picks</span>
          </div>
          <div className="recipe-browser-local-rail-status">
            <span>Pantry status</span>
            <strong>{hasSavedPantry ? pantryNames.length : 0}</strong>
            <small>{hasSavedPantry ? "saved items" : "no saved pantry"}</small>
          </div>
        </aside>
        <div className="recipe-browser-workspace">
          <section className="browser-shell-card browser-controls-shell" aria-labelledby="recipe-browser-filters-heading">
          <div className="browser-shell-section-heading browser-shell-section-heading--controls">
            <div>
              <p className="browser-shell-kicker">Dinner console</p>
              <h2 id="recipe-browser-filters-heading">Choose what you have</h2>
            </div>
            <p className="browser-shell-note">
              Browse recipe-backed filters. Ingredient choices filter recipes; pantry readiness stays on each card.
            </p>
          </div>

          <div className="browser-filter-matrix" role="tablist" aria-label="Recipe Browser desktop filter matrix">
            {desktopFilterMatrix.map((column) => (
              <section key={column.label} className="browser-filter-matrix-column" aria-label={`${column.label} filters`}>
                <p className="browser-filter-matrix-label">{column.label}</p>
                <div className="filter-family-tabs browser-console-row browser-console-row--top">
                  {column.families.map((family) => {
                    const isActive = family.id === activeFamilyId;
                    const implementedFamilyId = getImplementedFamilyId(family.id);
                    const selectionCount = implementedFamilyId ? selectedFilters[implementedFamilyId].length : 0;

                    return (
                      <button
                        key={family.id}
                        type="button"
                        className={`filter-family-tab${isActive ? " is-active" : ""}${family.enabled ? "" : " is-unavailable"}`}
                        role="tab"
                        aria-selected={isActive}
                        aria-controls={`filter-family-panel-${family.id}`}
                        aria-label={`${getConsoleFamilyLabel(family.id)} filters`}
                        id={`filter-family-tab-${family.id}`}
                        tabIndex={isActive && family.enabled ? 0 : -1}
                        disabled={!family.enabled}
                        data-console-depth="top"
                        data-selected={isActive ? "true" : "false"}
                        onClick={() => {
                          if (family.enabled) {
                            setActiveFamilyId(family.id);
                          }
                        }}
                        onKeyDown={(event) => handleTabKeyDown(event, family.id)}
                      >
                        <span className="filter-family-tab-label">{getConsoleFamilyLabel(family.id)}</span>
                        <span className="filter-family-tab-meta">
                          {selectionCount > 0 ? <span className="filter-family-tab-count">{selectionCount}</span> : null}
                          {!family.enabled ? <span className="filter-family-tab-status">Later</span> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="browser-command-shell">
            <div className="browser-search-scope-row">
              <section className="browser-search-shell" aria-labelledby="recipe-browser-search-heading">
                <div className="browser-search-shell-heading">
                  <div>
                    <p className="browser-filter-panel-kicker">Search</p>
                    <h3 id="recipe-browser-search-heading">Find ingredients</h3>
                  </div>
                  <p className="browser-filter-panel-note">
                    Search the full pantry catalog, including items the recipe set has not caught up to yet.
                  </p>
                </div>

                <label className="browser-search-input-shell">
                  <span className="browser-search-label">Ingredient search</span>
                  <input
                    type="search"
                    placeholder="Search ingredients like garlic or spaghetti"
                    aria-label="Search ingredient filters"
                    value={ingredientSearchQuery}
                    onChange={(event) => setIngredientSearchQuery(event.target.value)}
                    onFocus={() => setActiveFamilyId("ingredients")}
                  />
                </label>

                <div className="browser-search-results" aria-live="polite">
                  {hasIngredientSearchQuery ? (
                    ingredientSearchResults.length > 0 ? (
                      ingredientSearchResults.map((result) => {
                        const isSelected = selectedFilters.ingredients.includes(result.canonicalIngredientId);
                        const exactRecipeCount = countRecipesForIngredientCandidate(recipes, result.canonicalIngredientId);
                        const hasExactSupport = exactRecipeCount > 0;

                        return (
                          <button
                            key={result.canonicalIngredientId}
                            type="button"
                            className={`browser-search-result${isSelected ? " is-selected" : ""}${hasExactSupport ? "" : " is-unsupported"}`}
                            onClick={() => applyIngredientSearchResult(result.canonicalIngredientId, result.browseNodeId)}
                            aria-pressed={isSelected}
                            data-support={hasExactSupport ? "exact" : "search-only"}
                          >
                            <span className="browser-search-result-label">{result.label}</span>
                            <span className="browser-search-result-meta">
                              {isSelected
                                ? "Selected"
                                : hasExactSupport
                                  ? `${exactRecipeCount} match${exactRecipeCount === 1 ? "" : "es"} now`
                                  : getSearchFallbackCopy(recipes, result.browseNodeId)}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="browser-search-empty">No ingredient filters match that term yet.</p>
                    )
                  ) : (
                    <p className="browser-search-hint">Ingredient-only search. It does not search full recipe text.</p>
                  )}
                </div>
              </section>

              <section className="browser-scope-shell" aria-labelledby="recipe-browser-scope-heading">
                <div className="browser-scope-shell-heading">
                  <div>
                    <p className="browser-filter-panel-kicker">Scope</p>
                    <h3 id="recipe-browser-scope-heading">Tonight fit</h3>
                  </div>
                  <p className="browser-filter-panel-note">{scopeExplanation}</p>
                </div>

                <div className="browser-scope-row" role="group" aria-label="Recipe Browser scopes">
                  {RECIPE_BROWSER_SCOPE_OPTIONS.map((scope) => {
                    const isActive = scope.id === activeScopeId;
                    const isAvailable = scope.id === "explore_all" || hasPantryScopeData;
                    const count = scopeCounts.get(scope.id) ?? 0;

                    return (
                      <button
                        key={scope.id}
                        type="button"
                        className={`browser-scope-chip${isActive ? " is-active" : ""}${!isAvailable ? " is-disabled" : ""}`}
                        onClick={() => setActiveScopeId(scope.id)}
                        disabled={!isAvailable}
                        aria-pressed={isActive}
                      >
                        <span>{scope.label}</span>
                        <span className="browser-scope-chip-count">{isAvailable ? count : "Locked"}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            {hasActiveFilters ? (
              <section className="browser-active-filters" aria-labelledby="recipe-browser-active-filters-heading">
                <div className="browser-active-filters-header">
                  <div>
                    <p className="browser-filter-panel-kicker">Active filters</p>
                    <h3 id="recipe-browser-active-filters-heading">Current recipe search stack</h3>
                    <p className="browser-active-filters-summary">
                      Each chip is shaping the recipe list. Mapped live facets appear here too.
                    </p>
                  </div>
                  <button type="button" className="browser-active-filters-clear" onClick={clearAllFilters}>
                    Clear all
                  </button>
                </div>

                <div className="browser-active-filters-row" aria-label="Active recipe browser filters">
                  {activeFilterGroups.map((group) => (
                    <div key={group.familyId} className="browser-active-filter-group">
                      <div className="browser-active-filter-group-heading">
                        <span className="browser-active-filter-group-label">{group.familyLabel}</span>
                        <span className="browser-active-filter-group-count">
                          {group.filters.length} active
                        </span>
                      </div>
                      <div className="browser-active-filter-group-row">
                        {group.filters.map((filter) => (
                          <button
                            key={`${filter.familyId}-${filter.valueId}`}
                            type="button"
                            className="browser-active-filter-chip"
                            onClick={() => removeActiveFilter(filter.familyId, filter.valueId)}
                            aria-label={`Remove ${filter.valueLabel} from ${getImplementedFamilyLabel(filter.familyId)}`}
                          >
                            <span className="browser-active-filter-value">{filter.valueLabel}</span>
                            <span className="browser-active-filter-remove" aria-hidden="true">
                              Remove
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section className="browser-active-filters browser-active-filters--empty" aria-live="polite">
                <p className="browser-filter-panel-kicker">Active filters</p>
                <h3>No filters yet</h3>
                <p>Your recipe search stack will collect here as you choose filters.</p>
              </section>
            )}

            <section className="browser-control-utilities" aria-labelledby="recipe-browser-control-utilities-heading">
              <div className="browser-active-filters-header">
                <div>
                  <p className="browser-filter-panel-kicker">Control board</p>
                  <h3 id="recipe-browser-control-utilities-heading">Search utilities</h3>
                  <p className="browser-active-filters-summary">
                    Local controls for this browser view. Saved searches stay on this device.
                  </p>
                </div>
                {savedSearchFeedback ? (
                  <p className="browser-filter-panel-note" aria-live="polite">{savedSearchFeedback}</p>
                ) : null}
              </div>
              <div className="browser-control-utilities-row">
                <button type="button" className="browser-active-filters-clear" onClick={clearAllFilters}>
                  Clear all filters
                </button>
                <button type="button" className="browser-active-filters-clear" onClick={saveCurrentSearch}>
                  Save current search
                </button>
                <button type="button" className="browser-active-filters-clear" onClick={loadSavedSearch} disabled={!savedSearch}>
                  Load saved search
                </button>
                <button type="button" className="browser-active-filters-clear" onClick={resetToPantryReady}>
                  Reset to pantry-ready
                </button>
              </div>
              <div className="browser-control-utilities-row" role="group" aria-label="Recipe Browser utility toggles">
                <label className="browser-control-toggle">
                  <input
                    type="checkbox"
                    checked={showOnlyMissingOneItem}
                    onChange={(event) => setShowOnlyMissingOneItem(event.target.checked)}
                  />
                  <span>Show only missing one item</span>
                </label>
                <label className="browser-control-toggle">
                  <input
                    type="checkbox"
                    checked={hideExternalCandidateTools}
                    onChange={(event) => setHideExternalCandidateTools(event.target.checked)}
                  />
                  <span>Hide external candidates</span>
                </label>
                <label className="browser-control-toggle">
                  <input
                    type="checkbox"
                    checked={showReviewedImportsOnly}
                    onChange={(event) => setShowReviewedImportsOnly(event.target.checked)}
                  />
                  <span>Show reviewed imports only</span>
                </label>
              </div>
            </section>

            <section className="browser-living-filters" aria-labelledby="recipe-browser-living-filters-heading">
              <div className="browser-active-filters-header">
                <div>
                  <p className="browser-filter-panel-kicker">Living availability</p>
                  <h3 id="recipe-browser-living-filters-heading">Pantry-aware facets</h3>
                  <p className="browser-active-filters-summary">{livingFilterProviderCopy}</p>
                  <p className="browser-filter-panel-note">{livingCandidateAvailabilityCopy}</p>
                </div>
                {livingProviderStatus === "disabled" || livingProviderStatus === "missing_api_key" || livingProviderStatus === "error" ? (
                  <SourceTrustBadge state="provider_unavailable" />
                ) : null}
                {hasLivingSelectedFilters ? (
                  <button type="button" className="browser-active-filters-clear" onClick={clearLivingFilters}>
                    Clear live facets
                  </button>
                ) : null}
              </div>

              {livingFilterStatus === "loading" ? (
                <p className="browser-filter-panel-note" aria-live="polite">
                  Checking which filter choices have dinner candidates right now.
                </p>
              ) : null}

              {hasLivingSelectedFilters ? (
                <div className="browser-living-selected" aria-label="Selected dynamic Recipe Browser facets">
                  <p className="browser-filter-panel-note">
                    {livingSelectedFilterCount} live facet{livingSelectedFilterCount === 1 ? "" : "s"} shaping candidate availability.
                    Mapped facets also narrow verified recipe cards.
                  </p>
                  <div className="browser-active-filters-row">
                    {selectedLivingFilterFacets.map((facet) => {
                      const mapping = getLivingFacetBrowserMapping(facet.familyId, facet.value);

                      return (
                      <button
                        key={`selected-${facet.familyId}:${facet.value}`}
                        type="button"
                        className={`browser-active-filter-chip browser-active-filter-chip--live-${mapping ? "mapped" : "availability"}`}
                        onClick={() => toggleLivingFilter(facet.familyId, facet.value)}
                        aria-label={`Remove ${facet.label} from live ${facet.familyLabel} facets`}
                      >
                        <span className="browser-active-filter-family">{facet.familyLabel}</span>
                        <span className="browser-active-filter-value">{facet.label}</span>
                        <span className="browser-active-filter-family">{getLivingFacetScopeLabel(mapping)}</span>
                        <span className="browser-active-filter-remove" aria-hidden="true">
                          Remove
                        </span>
                      </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {livingFilterFacets.length > 0 ? (
                <div className="browser-living-filter-grid" aria-label="Recipe Browser dynamic filter counts">
                  {livingFilterFacets.map((facet) => {
                    const isSelected = livingSelectedFilters[facet.familyId]?.includes(facet.value) ?? false;
                    const mapping = getLivingFacetBrowserMapping(facet.familyId, facet.value);

                    return (
                      <button
                        key={`${facet.familyId}:${facet.value}`}
                        type="button"
                        className={`browser-filter-chip browser-living-filter-chip browser-living-filter-chip--${mapping ? "mapped" : "availability"}${isSelected ? " is-selected" : ""}`}
                        aria-pressed={isSelected}
                        onClick={() => toggleLivingFilter(facet.familyId, facet.value)}
                      >
                        <span className="browser-filter-chip-copy">
                          <span className="browser-filter-chip-title">{facet.label}</span>
                          <span className="browser-filter-chip-subtitle">
                            {facet.familyLabel} - {getLivingFacetScopeLabel(mapping)}
                          </span>
                        </span>
                        <span className="browser-filter-chip-state">{getLivingFilterCountLabel(facet.count)}</span>
                      </button>
                    );
                  })}
                </div>
              ) : livingFilterStatus === "loading" ? null : (
                <p className="browser-filter-panel-note">
                  Static recipe-backed filters remain available in the console below.
                </p>
              )}

              {!hideExternalCandidateTools && inspectableLivingCandidate ? (
                <div className="browser-live-candidate-panel" aria-label="Inspectable live candidate">
                  <div>
                    <p className="browser-filter-panel-kicker">Live candidate detail</p>
                    <h4>{inspectableLivingCandidate.display_title || inspectableLivingCandidate.title}</h4>
                    <SourceTrustBadge state="external_candidate" />
                    <p className="browser-filter-panel-note">
                      Inspect the normalized provider candidate without replacing verified recipe cards.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="browser-active-filters-clear"
                    onClick={inspectLivingCandidate}
                    disabled={livingCandidateInspectionLoading}
                  >
                    {livingCandidateInspectionLoading ? "Inspecting..." : "Inspect candidate"}
                  </button>
                  {livingCandidateInspectionError ? (
                    <p className="browser-filter-panel-note" role="alert">
                      {livingCandidateInspectionError}
                    </p>
                  ) : null}
                  {livingCandidateInspection ? (
                    <div className="browser-live-candidate-detail">
                      <div className="browser-live-candidate-status">
                        <span>{livingCandidateInspection.inspection_status}</span>
                        <span>{livingCandidateInspection.import_readiness.replace(/_/g, " ")}</span>
                      </div>
                      <div className="browser-live-candidate-groups">
                        {(["used", "missed", "unused"] as const).map((group) => {
                          const ingredients = livingCandidateInspection.ingredients.filter(
                            (ingredient) => ingredient.group === group,
                          );

                          if (ingredients.length === 0) {
                            return null;
                          }

                          return (
                            <div key={group} className="browser-live-candidate-group">
                              <strong>{group}</strong>
                              <span>
                                {ingredients
                                  .map((ingredient) =>
                                    ingredient.missing_severity
                                      ? `${ingredient.display} (${ingredient.missing_severity})`
                                      : ingredient.display,
                                  )
                                  .join(", ")}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {livingCandidateInspection.warnings.length > 0 ? (
                        <p className="browser-filter-panel-note">{livingCandidateInspection.warnings.join(" ")}</p>
                      ) : null}
                      <div className="browser-live-candidate-review">
                        <button
                          type="button"
                          className="browser-active-filters-clear"
                          onClick={requestExternalCandidateReview}
                          disabled={livingCandidateReviewLoading}
                        >
                          {livingCandidateReviewLoading ? "Marking..." : "Mark for review"}
                        </button>
                        <p className="browser-filter-panel-note">
                          Review keeps provenance and does not add this provider candidate to the verified recipe bank.
                        </p>
                      </div>
                      {livingCandidateReviewFeedback ? (
                        <p className="browser-filter-panel-note" aria-live="polite">
                          {livingCandidateReviewFeedback}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!hideExternalCandidateTools ? (
              <div className="browser-import-review-panel" aria-label="Import review queue">
                <div className="browser-import-review-heading">
                  <div>
                    <p className="browser-filter-panel-kicker">Import review queue</p>
                    <h4>External candidates under review</h4>
                  </div>
                  <p className="browser-filter-panel-note">
                    Approval here is review readiness only; it does not add a verified recipe.
                  </p>
                </div>
                {importReviewQueueError ? (
                  <p className="browser-filter-panel-note" role="alert">
                    {importReviewQueueError}
                  </p>
                ) : null}
                {importReviewQueueLoading ? (
                  <p className="browser-filter-panel-note">Loading review queue.</p>
                ) : importReviewQueue.length === 0 ? (
                  <p className="browser-filter-panel-note">
                    No candidates are queued for review yet.
                  </p>
                ) : (
                  <div className="browser-import-review-list">
                    {importReviewQueue.slice(0, 5).map((record) => (
                      <article key={record.review_id} className="browser-import-review-card">
                        <div className="browser-import-review-card-heading">
                          <div>
                            <h5>{record.edited_display_title || record.display_title || "Untitled candidate"}</h5>
                            <p className="browser-filter-panel-note">
                              {record.provider} / {record.source_id || "source pending"}
                            </p>
                          </div>
                          <span className={`browser-import-review-status browser-import-review-status--${record.status}`}>
                            {getImportReviewStatusLabel(record.status)}
                          </span>
                        </div>
                        <div className="browser-live-candidate-groups">
                          {record.display_ingredients.length > 0 ? (
                            <div className="browser-live-candidate-group">
                              <strong>ingredients</strong>
                              <span>{record.display_ingredients.slice(0, 6).join(", ")}</span>
                            </div>
                          ) : null}
                          {record.missed_ingredients.length > 0 ? (
                            <div className="browser-live-candidate-group">
                              <strong>missed</strong>
                              <span>{record.missed_ingredients.slice(0, 6).join(", ")}</span>
                            </div>
                          ) : null}
                        </div>
                        {record.safety_flags.length > 0 ? (
                          <div className="browser-import-review-flags" aria-label="Safety flags">
                            {record.safety_flags.map((flag) => (
                              <span key={flag}>{getImportReviewSafetyLabel(flag)}</span>
                            ))}
                          </div>
                        ) : (
                          <p className="browser-filter-panel-note">No safety flags returned.</p>
                        )}
                        <div className="browser-import-review-actions">
                          <button
                            type="button"
                            className="browser-active-filters-clear"
                            onClick={() => updateReviewQueueStatus(record.review_id, "needs_edit")}
                            disabled={importReviewUpdatingId === record.review_id}
                          >
                            Needs edit
                          </button>
                          <button
                            type="button"
                            className="browser-active-filters-clear"
                            onClick={() => updateReviewQueueStatus(record.review_id, "rejected")}
                            disabled={importReviewUpdatingId === record.review_id}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            className="browser-active-filters-clear"
                            onClick={() => updateReviewQueueStatus(record.review_id, "approved")}
                            disabled={importReviewUpdatingId === record.review_id}
                          >
                            Approve for import
                          </button>
                          {record.status === "approved" ? (
                            <button
                              type="button"
                              className="browser-active-filters-clear browser-active-filters-clear--import"
                              onClick={() => importApprovedReviewRecord(record.review_id)}
                              disabled={importingReviewId === record.review_id}
                            >
                              {importingReviewId === record.review_id ? "Importing..." : "Import reviewed recipe"}
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
              ) : null}

              <div className="browser-import-review-panel browser-imported-recipes-panel browser-reviewed-import-lane" aria-label="Reviewed imported recipes">
                <div className="browser-import-review-heading">
                  <div>
                    <p className="browser-filter-panel-kicker">Reviewed import lane</p>
                    <h4>Reviewed imports stay separate</h4>
                  </div>
                  <div className="browser-reviewed-import-lane-meta">
                    <SourceTrustBadge state="reviewed_import" />
                    <span>{rankedImportedRecipes.length} reviewed import{rankedImportedRecipes.length === 1 ? "" : "s"}</span>
                  </div>
                </div>
                <p className="browser-filter-panel-note">
                  Pantry fit ranks these reviewed imports separately. Preview and cleanup are local to this lane. No promotion action is available here.
                </p>
                {importedRecipesError ? (
                  <p className="browser-filter-panel-note" role="alert">
                    {importedRecipesError}
                  </p>
                ) : null}
                {importedRecipesLoading ? (
                  <p className="browser-filter-panel-note">Loading reviewed imports.</p>
                ) : rankedImportedRecipes.length === 0 ? (
                  <p className="browser-filter-panel-note">
                    No reviewed external recipes have been imported yet.
                  </p>
                ) : (
                  <div className="browser-import-review-list browser-imported-ranked-list">
                    {rankedImportedRecipes.slice(0, 5).map(({ record, pantryFit }) => {
                      const importedAtLabel = formatImportedAt(record.imported_at);
                      const review = importReviewQueue.find((reviewRecord) => reviewRecord.review_id === record.review_id) ?? null;
                      const promotionReadiness = getPromotionReadinessAssessment(record, review, pantryFit);

                      return (
                        <article key={record.import_id} className="browser-import-review-card browser-imported-recipe-card">
                          <div className="browser-import-review-card-heading">
                            <div>
                              <h5>{record.title}</h5>
                              <p className="browser-filter-panel-note">
                                {record.provider} / {record.source_id || "source pending"}
                              </p>
                            </div>
                            <SourceTrustBadge state="reviewed_import" />
                          </div>
                          <div className="browser-imported-trust-row">
                            <span>{record.origin.replace(/_/g, " ")}</span>
                            <span>{record.verification_status.replace(/_/g, " ")}</span>
                            <span>Source preserved</span>
                            {importedAtLabel ? <span>Imported {importedAtLabel}</span> : null}
                          </div>
                          <div className="browser-reviewed-import-readiness-row" aria-label={`Reviewed import readiness for ${record.title}`}>
                            <span>Cleanup status: {record.ingredients.length > 0 && record.instructions.length > 0 ? "Review text present" : "Needs cleanup"}</span>
                            <span>Promotion readiness: {promotionReadiness.label}</span>
                            <span>No promotion action</span>
                          </div>
                          <div className="browser-imported-pantry-fit" aria-label={`Pantry fit for ${record.title}`}>
                            <span>
                              Pantry fit{" "}
                              {typeof pantryFit?.pantryCoveragePct === "number"
                                ? `${pantryFit.pantryCoveragePct}%`
                                : "pending"}
                            </span>
                            <span>
                              Matches your pantry: {pantryFit?.matchedIngredients.length ?? 0}
                            </span>
                            <span>
                              Missing names: {pantryFit?.missingIngredients.length ?? record.ingredients.length}
                            </span>
                          </div>
                          <p className="browser-filter-panel-note">{getImportedPantryFitSummary(pantryFit)}</p>
                          <p className="browser-filter-panel-note">{getImportedRecipeTrustCopy(record)}</p>
                          <div className="browser-live-candidate-groups">
                            {record.ingredients.length > 0 ? (
                              <div className="browser-live-candidate-group">
                                <strong>ingredients</strong>
                                <span>{record.ingredients.slice(0, 6).join(", ")}</span>
                              </div>
                            ) : null}
                            {record.instructions.length > 0 ? (
                              <div className="browser-live-candidate-group">
                                <strong>steps</strong>
                                <span>{record.instructions.length} reviewed step{record.instructions.length === 1 ? "" : "s"}</span>
                              </div>
                            ) : null}
                          </div>
                          <div className="browser-imported-preview-actions">
                            <button
                              type="button"
                              className="browser-active-filters-clear"
                              onClick={() => setSelectedImportedRecipeId(record.import_id)}
                            >
                              Preview details
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
                {selectedImportedRecipePreview ? (
                  <ImportedRecipePreviewPanel
                    preview={selectedImportedRecipePreview}
                    promotionAudit={promotionAuditsByImportId[selectedImportedRecipePreview.record.import_id] ?? null}
                    promotionAuditLoading={promotionAuditLoadingId === selectedImportedRecipePreview.record.import_id}
                    promotionAuditSaving={promotionAuditSavingId === selectedImportedRecipePreview.record.import_id}
                    promotionAuditError={promotionAuditError}
                    onSaveCleanup={saveReviewedImportCleanup}
                    onSavePromotionAudit={savePromotionAudit}
                    onClose={() => setSelectedImportedRecipeId(null)}
                  />
                ) : null}
              </div>
            </section>

            <div
              className="browser-shell-panel"
              role="tabpanel"
              id={`filter-family-panel-${activeFamilyEntry.id}`}
              aria-labelledby={`filter-family-tab-${activeFamilyEntry.id}`}
            >
              {activeFamily ? (
                <section className="browser-filter-panel" aria-labelledby="recipe-browser-active-family-heading">
                  <div className="browser-filter-panel-heading">
                    <div>
                      <p className="browser-filter-panel-kicker">Now browsing</p>
                      <h3 id="recipe-browser-active-family-heading">{getImplementedFamilyLabel(activeFamily.id)}</h3>
                    </div>
                    <p className="browser-filter-panel-note">{getFamilySelectionNote(activeFamily.id)}</p>
                    <p className="browser-filter-panel-note browser-filter-panel-note--intelligence">
                      {filterIntelligenceSummary}
                    </p>
                  </div>

                  {activeFamily.id === "ingredients" ? (
                    <div className="browser-console-stack" aria-label="Ingredient console">
                      <div className="browser-console-row browser-console-row--family" aria-label="Ingredient categories">
                        {visibleIngredientFamilies.map((family) => {
                          const isFamilyActive = family.id === activeIngredientFamilyId;

                          return (
                            <button
                              key={family.id}
                              type="button"
                              className={getConsoleChipClass("family", `${isFamilyActive ? " is-selected" : ""}`)}
                              aria-pressed={isFamilyActive}
                              aria-expanded={isFamilyActive}
                              data-console-depth="family"
                              data-selected={isFamilyActive ? "true" : "false"}
                              onClick={() => openIngredientFamily(family.id)}
                            >
                              <span className="browser-filter-chip-title">{getIngredientFamilyLabel(family.id)}</span>
                            </button>
                          );
                        })}
                      </div>

                      {activeIngredientFamily ? (
                        <div className="browser-console-row browser-console-row--subfamily" aria-label={`${activeIngredientFamily.label} choices`}>
                          {activeIngredientFamily.nodes.map((group) => {
                            const isActive = group.id === activeIngredientGroupId;
                            const isSelected = group.filterId
                              ? selectedFilters.ingredients.includes(group.filterId)
                              : false;
                            const childFilters = getChildFiltersForParent(group.filterId, group.ingredients);
                            const childFilterIds = getChildFilterIdsForParent(group.filterId, group.ingredients);
                            const supportCount = group.filterId
                              ? countRecipesForFilterCandidate(recipes, selectedFilters, "ingredients", [group.filterId])
                              : 0;
                            const isUnavailable = Boolean(group.filterId && !isSelected && supportCount === 0);

                            return (
                              <div
                                key={group.id}
                                className={`browser-main-ingredient-slot${isSelected && childFilters.length > 0 ? " has-child-filters" : ""}`}
                              >
                                <button
                                  type="button"
                                  className={getConsoleChipClass(
                                    "subfamily",
                                    `${isSelected ? " is-selected" : ""}${isActive ? " is-expanded" : ""}${isUnavailable ? " is-unavailable" : ""}`,
                                  )}
                                  aria-pressed={isSelected}
                                  aria-expanded={isActive}
                                  data-console-depth="subfamily"
                                  data-selected={isActive ? "true" : "false"}
                                  onClick={() => toggleIngredientBrowseGroup(activeIngredientFamily.id, group.id, group.filterId, childFilterIds)}
                                >
                                  <span className="browser-filter-chip-title">{group.label}</span>
                                  <span className="browser-filter-chip-state">
                                    {group.filterId ? getFilterAvailabilityLabel(supportCount, isSelected) : "Open"}
                                  </span>
                                </button>
                                {isSelected && childFilters.length > 0 ? (
                                  <div
                                    className="browser-child-filter-chip-grid"
                                    aria-label={`${group.label} ingredient child filters`}
                                  >
                                    {childFilters.map((childFilter) => {
                                      const isChildSelected = childFilter.filterId
                                        ? selectedFilters.ingredients.includes(childFilter.filterId)
                                        : false;
                                      const childSupportCount = childFilter.filterId
                                        ? countRecipesForFilterCandidate(recipes, selectedFilters, "ingredients", [childFilter.filterId])
                                        : 0;
                                      const isChildUnavailable = Boolean(childFilter.filterId && !isChildSelected && childSupportCount === 0);

                                      return (
                                        <button
                                          key={`${group.id}-${childFilter.label}`}
                                          type="button"
                                          className={`browser-filter-chip browser-console-bubble browser-console-bubble--leaf browser-filter-chip--leaf browser-filter-chip--child${isChildSelected ? " is-selected" : ""}${childFilter.filterId ? "" : " is-disabled"}${isChildUnavailable ? " is-unavailable" : ""}`}
                                          aria-pressed={isChildSelected}
                                          aria-disabled={childFilter.filterId ? undefined : true}
                                          aria-label={
                                            childFilter.filterId
                                              ? `${childFilter.label} ingredient sub-filter`
                                              : `${childFilter.label} ingredient sub-filter planned for future taxonomy`
                                          }
                                          data-console-depth="leaf"
                                          data-selected={isChildSelected ? "true" : "false"}
                                          disabled={!childFilter.filterId}
                                          onClick={() => toggleChildIngredientFilter(childFilter)}
                                        >
                                          <span className="browser-filter-chip-title">{childFilter.label}</span>
                                          <span className="browser-filter-chip-state">
                                            {childFilter.filterId
                                              ? getFilterAvailabilityLabel(childSupportCount, isChildSelected)
                                              : "Planned"}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      {activeIngredientGroup && getChildFiltersForParent(activeIngredientGroup.filterId, activeIngredientGroup.ingredients).length === 0 ? (
                        <div className="browser-ingredient-leaf-tray browser-console-leaf-tray">
                          <div className="browser-ingredient-leaf-tray-heading">
                            <div>
                              <p className="browser-filter-panel-kicker">Narrow your dinner options</p>
                              <h5>{activeIngredientGroup.label}</h5>
                            </div>
                            {activeIngredientGroup.filterLabel ? (
                              <p className="browser-filter-panel-note">
                                The broader {activeIngredientGroup.filterLabel} choice stays available for more matches.
                              </p>
                            ) : null}
                          </div>

                          {supportedActiveIngredientLeaves.length > 0 ? (
                            <div className="browser-console-row browser-console-row--leaf" aria-label={`${activeIngredientGroup.label} ingredient options`}>
                              {supportedActiveIngredientLeaves.map((option) => {
                                const isSelected = selectedFilters.ingredients.includes(option.id);
                                const supportCount = countRecipesForFilterCandidate(recipes, selectedFilters, "ingredients", [option.id]);
                                const isUnavailable = !isSelected && supportCount === 0;

                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    className={getConsoleChipClass("leaf", ` browser-filter-chip--leaf${isSelected ? " is-selected" : ""}${isUnavailable ? " is-unavailable" : ""}`)}
                                    aria-pressed={isSelected}
                                    data-console-depth="leaf"
                                    data-selected={isSelected ? "true" : "false"}
                                    onClick={() => toggleFilterValue("ingredients", option.id)}
                                  >
                                    <span className="browser-filter-chip-title">{option.label}</span>
                                    <span className="browser-filter-chip-state">{getFilterAvailabilityLabel(supportCount, isSelected)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="browser-filter-panel-note">
                              No exact recipes yet for the narrower items here. Stay broad for better matches.
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : activeFamily.id === "cuisine" ? (
                    <div className="browser-filter-chip-grid browser-filter-chip-grid--ingredient-groups" aria-label="Cuisine families">
                      {visibleCuisineGroups.map((group) => {
                        const isExpanded = group.id === activeCuisineGroupId;
                        const isSelected = selectedFilters.cuisine.includes(group.id);
                        const supportCount = countRecipesForFilterCandidate(recipes, selectedFilters, "cuisine", [group.id]);
                        const isUnavailable = !isSelected && supportCount === 0;

                        return (
                          <div
                            key={group.id}
                            className={`browser-ingredient-group-slot${isExpanded ? " is-expanded" : ""}`}
                          >
                            <button
                              type="button"
                              className={getConsoleChipClass(
                                "family",
                                ` browser-filter-chip--browse-group${isSelected ? " is-selected" : ""}${isExpanded ? " is-expanded" : ""}${isUnavailable ? " is-unavailable" : ""}`,
                              )}
                              aria-pressed={isSelected}
                              aria-expanded={isExpanded}
                              data-console-depth="family"
                              data-selected={isExpanded ? "true" : "false"}
                              onClick={() => toggleCuisineGroup(group.id)}
                            >
                              <span className="browser-filter-chip-copy">
                                <span className="browser-filter-chip-title">{group.label}</span>
                                <span className="browser-filter-chip-subtitle">Cuisine family</span>
                              </span>
                              <span className="browser-filter-chip-state">
                                {isExpanded && !isSelected ? "Open" : getFilterAvailabilityLabel(supportCount, isSelected)}
                              </span>
                            </button>

                            {isExpanded ? (
                              <div className="browser-ingredient-leaf-tray">
                                <div className="browser-ingredient-leaf-tray-heading">
                                  <div>
                                    <p className="browser-filter-panel-kicker">Cuisine styles</p>
                                    <h5>{group.parentOption.label}</h5>
                                  </div>
                                  <p className="browser-filter-panel-note">
                                    Child styles narrow the selected cuisine family.
                                  </p>
                                </div>

                                {group.childOptions.length > 0 ? (
                                  <div
                                    className="browser-filter-chip-grid browser-filter-chip-grid--leaf-tray"
                                    aria-label={`${group.label} cuisine options`}
                                  >
                                    {group.childOptions.map((option) => {
                                      const isChildSelected = selectedFilters.cuisine.includes(option.id);
                                      const childSupportCount = countRecipesForFilterCandidate(
                                        recipes,
                                        selectedFilters,
                                        "cuisine",
                                        [group.id, option.id],
                                      );
                                      const isChildUnavailable = !isChildSelected && childSupportCount === 0;

                                      return (
                                        <button
                                          key={option.id}
                                          type="button"
                                          className={getConsoleChipClass("leaf", ` browser-filter-chip--leaf${isChildSelected ? " is-selected" : ""}${isChildUnavailable ? " is-unavailable" : ""}`)}
                                          aria-pressed={isChildSelected}
                                          data-console-depth="leaf"
                                          data-selected={isChildSelected ? "true" : "false"}
                                          onClick={() => toggleFilterValue("cuisine", option.id)}
                                        >
                                          <span className="browser-filter-chip-copy">
                                            <span className="browser-filter-chip-title">{option.label}</span>
                                            <span className="browser-filter-chip-subtitle">Cuisine style</span>
                                          </span>
                                          <span className="browser-filter-chip-state">
                                            {getFilterAvailabilityLabel(childSupportCount, isChildSelected)}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="browser-filter-panel-note">No narrower styles available yet.</p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="browser-filter-chip-grid" aria-label={`${activeFamily.label} filter options`}>
                      {activeFamily.options.map((option) => {
                        const isSelected = (selectedFilters[activeFamily.id] as readonly RecipeBrowserMvpFilterValueId[]).includes(
                          option.id,
                        );
                        const supportCount = countRecipesForFilterCandidate(recipes, selectedFilters, activeFamily.id, [option.id]);
                        const isUnavailable = !isSelected && supportCount === 0;

                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={getConsoleChipClass("leaf", ` browser-filter-chip--leaf${isSelected ? " is-selected" : ""}${isUnavailable ? " is-unavailable" : ""}`)}
                            aria-pressed={isSelected}
                            data-console-depth="leaf"
                            data-selected={isSelected ? "true" : "false"}
                            onClick={() => toggleFilterValue(activeFamily.id, option.id)}
                          >
                            <span className="browser-filter-chip-copy">
                              <span className="browser-filter-chip-title">{option.label}</span>
                              <span className="browser-filter-chip-subtitle">{activeFamily.label}</span>
                            </span>
                            <span className="browser-filter-chip-state">{getFilterAvailabilityLabel(supportCount, isSelected)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              ) : (
                <section className="browser-shell-placeholder browser-shell-placeholder--subtle" aria-live="polite">
                  <h3>{activeFamilyEntry.label} filters are not wired yet</h3>
                  <p>
                    This family is in the shared taxonomy, but it is not connected to eligibility yet.
                  </p>
                </section>
              )}
            </div>
          </div>
          </section>

          <section className="browser-shell-card browser-results-shell" aria-labelledby="recipe-browser-results-heading">
          <div className="browser-results-hero">
            <div className="browser-shell-section-heading browser-shell-section-heading--results">
              <div>
                <p className="browser-shell-kicker">Eligible recipes</p>
                <h2 id="recipe-browser-results-heading">Pantry-aware browsing</h2>
                <p className="browser-results-intro">Your strongest options stay in view while the browser keeps the wider field open.</p>
              </div>
              <div className="browser-results-toolbar" aria-label="Result count and sort">
                <div className="browser-results-count-block">
                  <span className="browser-results-count-label">Now showing</span>
                  <span className="browser-results-count">{resultCountLabel}</span>
                </div>
                <div className="browser-results-meta">
                  <span className="browser-results-sort">{sortLabel}</span>
                  <span className={`browser-results-status browser-results-status--${pantryStatusTone}`}>
                    {pantryStatusLabel}
                  </span>
                  <span className="browser-results-view">List view</span>
                </div>
                <label className="browser-results-sort-control">
                  <span>Sort</span>
                  <select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value as RecipeBrowserSortMode)}
                    aria-label="Sort Recipe Browser results"
                  >
                    {RECIPE_BROWSER_SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="browser-results-context-grid">
              <p className="browser-results-context">{scopeExplanation}</p>
              <p className="browser-results-context">{sortExplanation}</p>
              {hasPartialCatalogFailures ? (
                <p className="browser-results-context">
                  {catalogLoadSummary?.failedRecipeCount} of {catalogLoadSummary?.totalRecipeCount} browser recipes could not
                  be loaded, so these results reflect the recipes that did hydrate.
                </p>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="browser-shell-placeholder browser-shell-placeholder--results" aria-live="polite">
              <p className="browser-shell-placeholder-kicker">Loading browser</p>
              <h3>Loading recipes</h3>
              <p>Pulling the catalog and pantry-fit data for this view.</p>
            </div>
          ) : error ? (
            <div className="browser-shell-placeholder browser-shell-placeholder--results browser-shell-placeholder--error" aria-live="assertive">
              <p className="browser-shell-placeholder-kicker">Needs attention</p>
              <h3>Browser recipes are unavailable</h3>
              <p>The browser could not finish loading. Refresh and try again once.</p>
              <p className="browser-shell-placeholder-detail">{error}</p>
            </div>
          ) : showReviewedImportsOnly ? (
            <div className="browser-shell-placeholder browser-shell-placeholder--results browser-shell-placeholder--subtle" aria-live="polite">
              <p className="browser-shell-placeholder-kicker">Reviewed imports only</p>
              <h3>Curated results hidden</h3>
              <p>The reviewed import lane stays visible above. Curated verified recipe rows are hidden until this utility is turned off.</p>
            </div>
          ) : visibleScopedRecipes.length === 0 ? (
            <div className="browser-shell-placeholder browser-shell-placeholder--results browser-shell-placeholder--empty" aria-live="polite">
              <p className="browser-shell-placeholder-kicker">No matches</p>
              <h3>No recipes match this browser state</h3>
              <p>
                {activeScopeId === "explore_all"
                  ? "No recipes match this stack yet. Try one recovery step to reopen dinner options."
                  : `No recipes land in ${activeScope.label} with these filters yet. Try one recovery step to reopen dinner options.`}
              </p>
              {ingredientRecoverySuggestions.length > 0 ? (
                <>
                  <p className="browser-empty-state-note">
                    These swaps are explicit, so your exact ingredient choice stays honest until you choose a broader path.
                  </p>
                  <div className="browser-empty-state-actions" aria-label="Recipe Browser ingredient recovery suggestions">
                    {ingredientRecoverySuggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.sourceIngredientId}:${suggestion.targetIngredientId}`}
                        type="button"
                        className="browser-empty-state-action"
                        onClick={() => replaceIngredientFilter(suggestion.sourceIngredientId, suggestion.targetIngredientId)}
                      >
                        Replace {suggestion.sourceLabel} with {suggestion.strategy === "broader" ? "broader" : "nearby"}{" "}
                        {suggestion.targetLabel} ({suggestion.resultingCount})
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              <div className="browser-empty-state-actions" aria-label="Recipe Browser recovery actions">
                {latestActiveFilter ? (
                  <button type="button" className="browser-empty-state-action" onClick={removeLatestFilter}>
                    Remove latest filter: {latestActiveFilter.valueLabel}
                  </button>
                ) : null}
                {clearableFamily ? (
                  <button
                    type="button"
                    className="browser-empty-state-action"
                    onClick={() => clearFilterFamily(clearableFamily.familyId)}
                  >
                    Clear {clearableFamily.familyLabel} {clearableFamily.activeCount === 1 ? "filter" : "filters"}
                  </button>
                ) : null}
                {canShowClosestEligibleMatches ? (
                  <button type="button" className="browser-empty-state-action" onClick={widenScopeToExploreAll}>
                    Show closest eligible matches in Explore All
                  </button>
                ) : null}
                {hasActiveFilters ? (
                  <button type="button" className="browser-empty-state-action is-secondary" onClick={clearAllFilters}>
                    Clear all filters
                  </button>
                ) : null}
              </div>
              {canShowClosestEligibleMatches ? (
                <p className="browser-empty-state-note">
                  Explore All keeps the current filters and only widens the pantry-fit scope.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              {showLowResultState ? (
                <div className="browser-results-low-state" aria-live="polite">
                  <p>
                    Only {visibleScopedRecipes.length} recipe{visibleScopedRecipes.length === 1 ? "" : "s"}{" "}
                    {visibleScopedRecipes.length === 1 ? "remains" : "remain"} in this view. This is a tight match; you can keep it
                    or loosen one choice for more options.
                  </p>
                  {ingredientRecoverySuggestions.length > 0 ? (
                    <>
                      <p className="browser-empty-state-note">
                        Try an explicit ingredient swap to reopen more options while keeping the exact-match story clear.
                      </p>
                      <div className="browser-empty-state-actions" aria-label="Recipe Browser weak-result ingredient recovery">
                        {ingredientRecoverySuggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.sourceIngredientId}:${suggestion.targetIngredientId}`}
                            type="button"
                            className="browser-empty-state-action"
                            onClick={() => replaceIngredientFilter(suggestion.sourceIngredientId, suggestion.targetIngredientId)}
                          >
                            Replace {suggestion.sourceLabel} with {suggestion.strategy === "broader" ? "broader" : "nearby"}{" "}
                            {suggestion.targetLabel} ({suggestion.resultingCount})
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="browser-empty-state-note">Relax a filter or widen the scope for more variety.</p>
                  )}
                </div>
              ) : null}
              <div className="results-grid" aria-label="Recipe Browser results">
                {visibleScopedRecipes.map(({ recipe, pantryFit }) => (
                  <RecipeBrowserResultCard
                    key={recipe.id}
                    recipe={recipe}
                    pantryFit={pantryFit}
                    activeFilters={activeFilters}
                    activeScopeId={activeScopeId}
                    activeScopeLabel={activeScope.label}
                  />
                ))}
              </div>
            </>
          )}
          </section>
        </div>
      </section>
    </main>
  );
}

function ImportedRecipePreviewPanel({
  preview,
  promotionAudit,
  promotionAuditLoading,
  promotionAuditSaving,
  promotionAuditError,
  onSaveCleanup,
  onSavePromotionAudit,
  onClose,
}: {
  preview: ImportedRecipePreview;
  promotionAudit: ImportedRecipePromotionAuditRecord | null;
  promotionAuditLoading: boolean;
  promotionAuditSaving: boolean;
  promotionAuditError: string;
  onSaveCleanup: (importId: string, payload: ImportedRecipeCleanupUpdateRequest) => Promise<void>;
  onSavePromotionAudit: (importId: string, payload: ImportedRecipePromotionAuditUpdateRequest) => Promise<void>;
  onClose: () => void;
}) {
  const { record, pantryFit, review } = preview;
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(record.title);
  const [editIngredients, setEditIngredients] = useState(formatEditableList(record.ingredients));
  const [editInstructions, setEditInstructions] = useState(formatEditableList(record.instructions));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [auditDraft, setAuditDraft] = useState<ImportedRecipePromotionAuditUpdateRequest>({});
  const [auditSaveError, setAuditSaveError] = useState("");
  const sourceUrl = getImportedRecipeSourceUrl(record);
  const readyTimeLabel = formatMinutes(review?.display_ready_minutes);
  const servingsLabel =
    typeof review?.display_servings === "number" ? `${review.display_servings} serving${review.display_servings === 1 ? "" : "s"}` : null;
  const usedIngredients = review?.used_ingredients ?? [];
  const missedIngredients = review?.missed_ingredients ?? [];
  const reviewStatusLabel = review ? getImportReviewStatusLabel(review.status) : "Imported from review";
  const parsedIngredients = parseEditableList(editIngredients);
  const parsedInstructions = parseEditableList(editInstructions);
  const canSaveCleanup = editTitle.trim().length > 0 && parsedIngredients.length > 0 && parsedInstructions.length > 0;
  const promotionReadiness = getPromotionReadinessAssessment(record, review, pantryFit);
  const auditStatusCopy = promotionAudit ? getPersistedAuditReadinessLabel(promotionAudit.promotion_readiness) : "Audit state loading";

  useEffect(() => {
    setIsEditing(false);
    setEditTitle(record.title);
    setEditIngredients(formatEditableList(record.ingredients));
    setEditInstructions(formatEditableList(record.instructions));
    setIsSaving(false);
    setSaveError("");
  }, [record.import_id, record.ingredients, record.instructions, record.title]);

  useEffect(() => {
    if (!promotionAudit) {
      setAuditDraft({});
      return;
    }

    setAuditDraft({
      provenance_status: promotionAudit.provenance_status,
      cleanup_status: promotionAudit.cleanup_status,
      safety_status: promotionAudit.safety_status,
      feasibility_status: promotionAudit.feasibility_status,
      quality_status: promotionAudit.quality_status,
      duplicate_status: promotionAudit.duplicate_status,
      reviewer_notes: promotionAudit.reviewer_notes ?? "",
    });
    setAuditSaveError("");
  }, [promotionAudit]);

  function cancelCleanup() {
    setEditTitle(record.title);
    setEditIngredients(formatEditableList(record.ingredients));
    setEditInstructions(formatEditableList(record.instructions));
    setSaveError("");
    setIsEditing(false);
  }

  async function saveCleanup() {
    if (!canSaveCleanup) {
      setSaveError("Reviewed import cleanup needs a title, at least one ingredient, and at least one instruction.");
      return;
    }

    setIsSaving(true);
    setSaveError("");

    try {
      await onSaveCleanup(record.import_id, {
        title: editTitle,
        ingredients: parsedIngredients,
        instructions: parsedInstructions,
      });
      setIsEditing(false);
    } catch (requestError: unknown) {
      setSaveError(
        requestError instanceof Error
          ? requestError.message
          : "Reviewed import cleanup could not be saved right now. Your edits are still in the form.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function saveAudit() {
    if (!promotionAudit) {
      setAuditSaveError("Promotion audit state is not ready yet.");
      return;
    }

    setAuditSaveError("");

    try {
      await onSavePromotionAudit(record.import_id, auditDraft);
    } catch (requestError: unknown) {
      setAuditSaveError(
        requestError instanceof Error
          ? requestError.message
          : "Promotion audit state could not be saved right now.",
      );
    }
  }

  return (
    <aside className="browser-imported-preview-panel" aria-label="Reviewed import details">
      <div className="browser-imported-preview-heading">
        <div>
          <p className="browser-filter-panel-kicker">
            {isEditing ? "Reviewed import cleanup" : "Reviewed import details"}
          </p>
          <h4>{record.title}</h4>
          <p className="browser-filter-panel-note">
            This is a reviewed imported recipe. Source preserved. Separate from curated verified recipes. Cleanup only. Does not promote this recipe.
          </p>
        </div>
        <div className="browser-imported-preview-heading-actions">
          {isEditing ? (
            <button type="button" className="browser-active-filters-clear" onClick={cancelCleanup} disabled={isSaving}>
              Cancel cleanup
            </button>
          ) : (
            <button type="button" className="browser-active-filters-clear" onClick={() => setIsEditing(true)}>
              Edit reviewed import
            </button>
          )}
          <button type="button" className="browser-active-filters-clear" onClick={onClose} disabled={isSaving}>
            Close preview
          </button>
        </div>
      </div>

      <div className="browser-imported-trust-row" aria-label="Reviewed import trust and provenance">
        <SourceTrustBadge state="reviewed_import" />
        <span>Imported from review</span>
        <span>{reviewStatusLabel}</span>
        <span>{getImportedRecipeSourceLabel(record)}</span>
        <span>Source preserved</span>
        <span>Cleanup only</span>
        <span>Does not promote this recipe</span>
      </div>

      <div className="browser-imported-pantry-fit" aria-label="Pantry fit details">
        <span>
          Pantry fit{" "}
          {typeof pantryFit?.pantryCoveragePct === "number" ? `${pantryFit.pantryCoveragePct}%` : "pending"}
        </span>
        <span>Matched names: {pantryFit?.matchedIngredients.length ?? 0}</span>
        <span>Missed names: {pantryFit?.missingIngredients.length ?? record.ingredients.length}</span>
      </div>

      <div className="browser-imported-preview-meta">
        {readyTimeLabel ? (
          <span>
            <strong>Ready time</strong> {readyTimeLabel}
          </span>
        ) : null}
        {servingsLabel ? (
          <span>
            <strong>Servings</strong> {servingsLabel}
          </span>
        ) : null}
        <span>
          <strong>Review status</strong> {reviewStatusLabel}
        </span>
        {sourceUrl ? (
          <span>
            <strong>Source URL</strong>{" "}
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              {sourceUrl}
            </a>
          </span>
        ) : (
          <span>
            <strong>Source URL</strong> Source preserved in provenance
          </span>
        )}
      </div>

      <section className="browser-imported-promotion-readiness" aria-label="Promotion readiness audit">
        <div className="browser-imported-promotion-readiness-heading">
          <div>
            <p className="browser-filter-panel-kicker">Promotion readiness</p>
            <h5>{promotionReadiness.label}</h5>
            <p className="browser-filter-panel-note">{promotionReadiness.summary}</p>
          </div>
          <span className={`browser-imported-promotion-readiness-status browser-imported-promotion-readiness-status--${promotionReadiness.status}`}>
            Readiness only
          </span>
        </div>
        <p className="browser-filter-panel-note">
          Cleanup does not promote this recipe. No promotion action is available here.
        </p>
        <ul className="browser-imported-promotion-checklist">
          {promotionReadiness.items.map((item) => (
            <li key={item.id} className={`browser-imported-promotion-check browser-imported-promotion-check--${item.status}`}>
              <span>{getPromotionReadinessStatusLabel(item.status)}</span>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </li>
          ))}
        </ul>
      </section>

      <section className="browser-imported-promotion-audit-editor" aria-label="Persisted promotion audit state">
        <div className="browser-imported-promotion-readiness-heading">
          <div>
            <p className="browser-filter-panel-kicker">Promotion audit state</p>
            <h5>{auditStatusCopy}</h5>
            <p className="browser-filter-panel-note">
              Persist checklist state only. Still a reviewed import. Not added to curated verified recipes yet.
            </p>
          </div>
          <span className="browser-imported-promotion-readiness-status">No promotion action</span>
        </div>
        {promotionAuditLoading ? (
          <p className="browser-filter-panel-note">Loading promotion audit state.</p>
        ) : promotionAudit ? (
          <>
            <div className="browser-imported-promotion-audit-grid">
              {PROMOTION_AUDIT_FIELDS.map((field) => (
                <label key={field.id} className="browser-imported-cleanup-field">
                  <span>{field.label}</span>
                  <select
                    value={auditDraft[field.id] ?? promotionAudit[field.id]}
                    onChange={(event) =>
                      setAuditDraft((current) => ({
                        ...current,
                        [field.id]: event.target.value as ImportedRecipePromotionAuditRecord[PromotionAuditFieldId],
                      }))
                    }
                    disabled={promotionAuditSaving}
                  >
                    {PROMOTION_AUDIT_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <label className="browser-imported-cleanup-field">
              <span>Audit notes</span>
              <textarea
                value={auditDraft.reviewer_notes ?? ""}
                onChange={(event) =>
                  setAuditDraft((current) => ({
                    ...current,
                    reviewer_notes: event.target.value,
                  }))
                }
                disabled={promotionAuditSaving}
                rows={3}
              />
            </label>
            <div className="browser-imported-promotion-audit-summary" aria-label="Saved promotion audit summary">
              {PROMOTION_AUDIT_FIELDS.map((field) => (
                <span key={field.id}>
                  {field.label}: {getPersistedAuditStatusLabel(promotionAudit[field.id])}
                </span>
              ))}
            </div>
            {promotionAuditError || auditSaveError ? (
              <p className="browser-filter-panel-note browser-imported-cleanup-error" role="alert">
                {auditSaveError || promotionAuditError}
              </p>
            ) : null}
            <div className="browser-imported-cleanup-actions">
              <button
                type="button"
                className="browser-active-filters-clear browser-active-filters-clear--import"
                onClick={saveAudit}
                disabled={promotionAuditSaving}
              >
                {promotionAuditSaving ? "Saving audit state..." : "Save audit state"}
              </button>
            </div>
          </>
        ) : (
          <p className="browser-filter-panel-note browser-imported-cleanup-error" role="alert">
            {promotionAuditError || "Promotion audit state is unavailable right now."}
          </p>
        )}
      </section>

      {isEditing ? (
        <div className="browser-imported-cleanup-editor" aria-label="Reviewed import cleanup editor">
          <div className="browser-imported-cleanup-copy">
            <p className="browser-filter-panel-kicker">Reviewed import cleanup</p>
            <p className="browser-filter-panel-note">
              Edit title, ingredients, and instructions only. Source preserved. Separate from curated verified recipes. Does not promote this recipe.
            </p>
          </div>
          {saveError ? (
            <p className="browser-filter-panel-note browser-imported-cleanup-error" role="alert">
              {saveError}
            </p>
          ) : null}
          <label className="browser-imported-cleanup-field">
            <span>Title</span>
            <input
              type="text"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              disabled={isSaving}
            />
          </label>
          <label className="browser-imported-cleanup-field">
            <span>Ingredients</span>
            <textarea
              value={editIngredients}
              onChange={(event) => setEditIngredients(event.target.value)}
              disabled={isSaving}
              rows={Math.max(4, record.ingredients.length)}
            />
          </label>
          <label className="browser-imported-cleanup-field">
            <span>Instructions</span>
            <textarea
              value={editInstructions}
              onChange={(event) => setEditInstructions(event.target.value)}
              disabled={isSaving}
              rows={Math.max(4, record.instructions.length)}
            />
          </label>
          <div className="browser-imported-cleanup-actions">
            <button
              type="button"
              className="browser-active-filters-clear browser-active-filters-clear--import"
              onClick={saveCleanup}
              disabled={isSaving || !canSaveCleanup}
            >
              {isSaving ? "Saving reviewed import..." : "Save reviewed import"}
            </button>
            <button type="button" className="browser-active-filters-clear" onClick={cancelCleanup} disabled={isSaving}>
              Cancel cleanup
            </button>
          </div>
        </div>
      ) : null}

      <div className="browser-imported-preview-grid">
        <section aria-label="Imported recipe ingredients">
          <h5>Ingredients</h5>
          {record.ingredients.length > 0 ? (
            <ul>
              {record.ingredients.map((ingredient) => (
                <li key={ingredient}>{ingredient}</li>
              ))}
            </ul>
          ) : (
            <p className="browser-filter-panel-note">No reviewed ingredients were preserved for this import.</p>
          )}
        </section>

        <section aria-label="Imported recipe instructions">
          <h5>Instructions</h5>
          {record.instructions.length > 0 ? (
            <ol>
              {record.instructions.map((instruction) => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ol>
          ) : (
            <p className="browser-filter-panel-note">No reviewed instructions were preserved for this import.</p>
          )}
        </section>
      </div>

      {(usedIngredients.length > 0 || missedIngredients.length > 0 || pantryFit) ? (
        <div className="browser-imported-preview-grid browser-imported-preview-grid--compact">
          <section aria-label="Used ingredients">
            <h5>Used ingredients</h5>
            {(usedIngredients.length > 0 ? usedIngredients : pantryFit?.matchedIngredients ?? []).length > 0 ? (
              <ul>
                {(usedIngredients.length > 0 ? usedIngredients : pantryFit?.matchedIngredients ?? []).map((ingredient) => (
                  <li key={ingredient}>{ingredient}</li>
                ))}
              </ul>
            ) : (
              <p className="browser-filter-panel-note">No used ingredients are available for this reviewed import.</p>
            )}
          </section>
          <section aria-label="Missed ingredients">
            <h5>Missed ingredients</h5>
            {(missedIngredients.length > 0 ? missedIngredients : pantryFit?.missingIngredients ?? []).length > 0 ? (
              <ul>
                {(missedIngredients.length > 0 ? missedIngredients : pantryFit?.missingIngredients ?? []).map((ingredient) => (
                  <li key={ingredient}>{ingredient}</li>
                ))}
              </ul>
            ) : (
              <p className="browser-filter-panel-note">No missed ingredients are available for this reviewed import.</p>
            )}
          </section>
        </div>
      ) : null}
    </aside>
  );
}

function RecipeBrowserResultCard({
  recipe,
  pantryFit,
  activeFilters,
  activeScopeId,
  activeScopeLabel,
}: {
  recipe: RecipeDetail;
  pantryFit: RecipeBrowserPantryFit | null;
  activeFilters: ActiveFilter[];
  activeScopeId: RecipeBrowserScopeId;
  activeScopeLabel: string;
}) {
  const timeLabel = formatMinutes(recipe.total_time_minutes);
  const detailPills = [
    recipe.cuisine ? `${formatDisplayLabel(recipe.cuisine)} cuisine` : null,
    recipe.primary_protein ? `${formatDisplayLabel(recipe.primary_protein)} protein` : null,
    timeLabel,
    recipe.difficulty ? `${formatDisplayLabel(recipe.difficulty)} effort` : null,
    recipe.cook_method ? `${formatDisplayLabel(recipe.cook_method)} method` : null,
  ].filter(Boolean);
  const whyItMatches = buildWhyItMatches(activeFilters, activeScopeId, activeScopeLabel, pantryFit);
  const pantryCoverageLine = getPantryCoverageLine(pantryFit);
  const missingCoverageLine = getMissingCoverageLine(pantryFit);
  const pantryMatchLabel =
    typeof pantryFit?.pantryCoveragePct === "number"
      ? pantryFit.pantryCoveragePct === 100 && pantryFit.quantityConfirmationCount > 0
        ? "Ingredients found - confirm amounts"
        : `${pantryFit.pantryCoveragePct}% ingredient coverage`
      : "Pantry fit pending";
  const missingShortLabel = pantryFit
    ? pantryFit.quantityConfirmationCount > 0 && pantryFit.shoppingMissingCount === 0
      ? "Confirm amounts"
      : `${pantryFit.shoppingMissingCount} missing`
    : "Coverage unavailable";
  const statusLabel = pantryFit?.badgeLabel ?? "Eligible";

  return (
    <article className="results-card browser-result-row browser-result-row--curated">
      <div className="browser-result-table-grid" aria-label={`${recipe.name} browser result summary`}>
        <div className="browser-result-table-cell browser-result-table-cell--name">
          <span className="browser-result-column-label">Recipe name</span>
          <h3>{recipe.name}</h3>
          {recipe.short_description && <p className="status-line">{recipe.short_description}</p>}
        </div>
        <div className="browser-result-table-cell">
          <span className="browser-result-column-label">Pantry fit</span>
          {pantryFit ? (
            <span className={`browser-result-badge browser-result-badge--${pantryFit.state}`}>{pantryFit.badgeLabel}</span>
          ) : (
            <span className="browser-result-badge browser-result-badge--unranked">Eligible</span>
          )}
          <span className="browser-result-metric">{pantryMatchLabel}</span>
        </div>
        <div className="browser-result-table-cell">
          <span className="browser-result-column-label">Missing items</span>
          <span className="browser-result-metric">{missingShortLabel}</span>
        </div>
        <div className="browser-result-table-cell">
          <span className="browser-result-column-label">Time</span>
          <span className="browser-result-metric">{timeLabel ?? "Time pending"}</span>
        </div>
        <div className="browser-result-table-cell">
          <span className="browser-result-column-label">Source / trust</span>
          <SourceTrustBadge state="curated_verified" />
        </div>
        <div className="browser-result-table-cell">
          <span className="browser-result-column-label">Status</span>
          <span className="browser-result-metric">{statusLabel}</span>
        </div>
      </div>

      <div className="browser-result-hero">
        <div className="browser-result-heading">
          <p className="browser-result-decision">{getPantryDecisionLabel(pantryFit)}</p>
        </div>
        {pantryFit ? <p className="browser-result-summary">{pantryFit.summary}</p> : null}
      </div>
      <div className="browser-result-support">
        {pantryCoverageLine ? (
          <p className="browser-result-support-line">
            <strong>Coverage:</strong> {pantryCoverageLine}
          </p>
        ) : null}
        {missingCoverageLine ? (
          <p className="browser-result-support-line">
            <strong>Missing:</strong> {missingCoverageLine}
          </p>
        ) : null}
      </div>
      {detailPills.length > 0 ? (
        <div className="browser-result-detail-pills" aria-label="Recipe Browser result details">
          {detailPills.map((detail) => (
            <span key={detail} className="browser-result-detail-pill">
              {detail}
            </span>
          ))}
        </div>
      ) : null}
      <div className="browser-result-actions">
        <p className="browser-result-why">{whyItMatches}</p>
        <Link className="browser-result-link" to={`/recipes/${recipe.id}`}>
          Open recipe
        </Link>
      </div>
    </article>
  );
}

export default RecipeBrowserPage;
