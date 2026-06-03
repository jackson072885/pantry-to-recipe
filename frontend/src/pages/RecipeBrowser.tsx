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
  fetchDinnerTonightCandidates,
  fetchRecipeBrowserCatalog,
  inspectDinnerTonightCandidate,
  type DinnerTonightCandidate,
  type DinnerTonightCandidateInspection,
  type DinnerTonightFilterCounts,
  type DinnerTonightProviderStatus,
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

type LivingCandidateAvailability = {
  count: number;
  bestTitle: string | null;
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
  const hasPantryScopeData = Boolean(activeRecommendations);
  const scopedRecipes = useMemo(
    () => filterRankedRecipesByScope(rankedRecipes, activeScopeId, hasPantryScopeData),
    [activeScopeId, hasPantryScopeData, rankedRecipes],
  );
  const showLowResultState =
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

  const sortLabel = useMemo(() => {
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
  }, [activeRecommendations, hasSavedPantry, pantryRankingError, pantryRankingLoading]);

  const sortExplanation = useMemo(() => {
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
  }, [activeRecommendations, hasSavedPantry, pantryNames.length, pantryRankingError, pantryRankingLoading]);

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

  const resultCountLabel = useMemo(() => {
    if (loading) {
      return "Loading recipes...";
    }

    if (activeScopeId === "explore_all") {
      return `${scopedRecipes.length} eligible recipe${scopedRecipes.length === 1 ? "" : "s"}`;
    }

    return `${scopedRecipes.length} recipe${scopedRecipes.length === 1 ? "" : "s"} in ${activeScope.label}`;
  }, [activeScope.label, activeScopeId, loading, scopedRecipes.length]);
  const pantryStatusLabel = useMemo(
    () => getPantryStatusLabel(activeRecommendations, pantryRankingLoading, pantryRankingError, hasSavedPantry),
    [activeRecommendations, hasSavedPantry, pantryRankingError, pantryRankingLoading],
  );
  const pantryStatusTone = useMemo(
    () => getPantryStatusTone(activeRecommendations, pantryRankingLoading, pantryRankingError, hasSavedPantry),
    [activeRecommendations, hasSavedPantry, pantryRankingError, pantryRankingLoading],
  );

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

    async function loadLivingFilters() {
      if (pantryNames.length === 0) {
        setLivingFilterCounts(null);
        setLivingProviderStatus(null);
        setLivingFilterStatus("idle");
        setLivingCandidateAvailability(null);
        setInspectableLivingCandidate(null);
        setLivingCandidateInspection(null);
        setLivingCandidateInspectionError("");
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
          setLivingFilterStatus("live");
          return;
        }

        setLivingFilterCounts(null);
        setLivingCandidateAvailability(null);
        setInspectableLivingCandidate(null);
        setLivingCandidateInspection(null);
        setLivingCandidateInspectionError("");
        setLivingFilterStatus("unavailable");
      } catch {
        if (!cancelled) {
          setLivingFilterCounts(null);
          setLivingCandidateAvailability(null);
          setInspectableLivingCandidate(null);
          setLivingCandidateInspection(null);
          setLivingCandidateInspectionError("");
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
  ) {
    openIngredientGroup(familyId, groupId);

    if (filterId) {
      toggleFilterValue("ingredients", filterId);
    }
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
    } catch (requestError: unknown) {
      setLivingCandidateInspection(null);
      setLivingCandidateInspectionError(
        requestError instanceof Error ? requestError.message : "Live candidate details are unavailable right now.",
      );
    } finally {
      setLivingCandidateInspectionLoading(false);
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
    <main className="page-shell recipe-browser-page" style={{ maxWidth: 1180 }}>
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

            <section className="browser-living-filters" aria-labelledby="recipe-browser-living-filters-heading">
              <div className="browser-active-filters-header">
                <div>
                  <p className="browser-filter-panel-kicker">Living availability</p>
                  <h3 id="recipe-browser-living-filters-heading">Pantry-aware facets</h3>
                  <p className="browser-active-filters-summary">{livingFilterProviderCopy}</p>
                  <p className="browser-filter-panel-note">{livingCandidateAvailabilityCopy}</p>
                </div>
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

              {inspectableLivingCandidate ? (
                <div className="browser-live-candidate-panel" aria-label="Inspectable live candidate">
                  <div>
                    <p className="browser-filter-panel-kicker">Live candidate detail</p>
                    <h4>{inspectableLivingCandidate.display_title || inspectableLivingCandidate.title}</h4>
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
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <div className="filter-family-tabs browser-console-row browser-console-row--top" role="tablist" aria-label="Recipe Browser filter families">
              {consoleFamilies.map((family) => {
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
                            const supportCount = group.filterId
                              ? countRecipesForIngredientCandidate(recipes, group.filterId)
                              : 0;

                            return (
                              <button
                                key={group.id}
                                type="button"
                                className={getConsoleChipClass("subfamily", `${isSelected ? " is-selected" : ""}${isActive ? " is-expanded" : ""}`)}
                                aria-pressed={isSelected}
                                aria-expanded={isActive}
                                data-console-depth="subfamily"
                                data-selected={isActive ? "true" : "false"}
                                onClick={() => toggleIngredientBrowseGroup(activeIngredientFamily.id, group.id, group.filterId)}
                              >
                                <span className="browser-filter-chip-title">{group.label}</span>
                                <span className="browser-filter-chip-state">
                                  {isSelected ? "Selected" : supportCount > 0 ? `${supportCount}` : "Open"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}

                      {activeIngredientGroup ? (
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
                                const supportCount = countRecipesForIngredientCandidate(recipes, option.id);

                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    className={getConsoleChipClass("leaf", ` browser-filter-chip--leaf${isSelected ? " is-selected" : ""}`)}
                                    aria-pressed={isSelected}
                                    data-console-depth="leaf"
                                    data-selected={isSelected ? "true" : "false"}
                                    onClick={() => toggleFilterValue("ingredients", option.id)}
                                  >
                                    <span className="browser-filter-chip-title">{option.label}</span>
                                    <span className="browser-filter-chip-state">{supportCount}</span>
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

                        return (
                          <div
                            key={group.id}
                            className={`browser-ingredient-group-slot${isExpanded ? " is-expanded" : ""}`}
                          >
                            <button
                              type="button"
                              className={getConsoleChipClass("family", ` browser-filter-chip--browse-group${isSelected ? " is-selected" : ""}${isExpanded ? " is-expanded" : ""}`)}
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
                              <span className="browser-filter-chip-state">{isSelected ? "Selected" : isExpanded ? "Open" : "Filter"}</span>
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

                                      return (
                                        <button
                                          key={option.id}
                                          type="button"
                                          className={getConsoleChipClass("leaf", ` browser-filter-chip--leaf${isChildSelected ? " is-selected" : ""}`)}
                                          aria-pressed={isChildSelected}
                                          data-console-depth="leaf"
                                          data-selected={isChildSelected ? "true" : "false"}
                                          onClick={() => toggleFilterValue("cuisine", option.id)}
                                        >
                                          <span className="browser-filter-chip-copy">
                                            <span className="browser-filter-chip-title">{option.label}</span>
                                            <span className="browser-filter-chip-subtitle">Cuisine style</span>
                                          </span>
                                          <span className="browser-filter-chip-state">{isChildSelected ? "Selected" : "Add"}</span>
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

                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={getConsoleChipClass("leaf", ` browser-filter-chip--leaf${isSelected ? " is-selected" : ""}`)}
                            aria-pressed={isSelected}
                            data-console-depth="leaf"
                            data-selected={isSelected ? "true" : "false"}
                            onClick={() => toggleFilterValue(activeFamily.id, option.id)}
                          >
                            <span className="browser-filter-chip-copy">
                              <span className="browser-filter-chip-title">{option.label}</span>
                              <span className="browser-filter-chip-subtitle">{activeFamily.label}</span>
                            </span>
                            <span className="browser-filter-chip-state">{isSelected ? "Selected" : "Add"}</span>
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
          ) : scopedRecipes.length === 0 ? (
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
                    Only {scopedRecipes.length} recipe{scopedRecipes.length === 1 ? "" : "s"}{" "}
                    {scopedRecipes.length === 1 ? "remains" : "remain"} in this view. This is a tight match; you can keep it
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
                {scopedRecipes.map(({ recipe, pantryFit }) => (
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

  return (
    <article className="results-card">
      <div className="browser-result-hero">
        <div className="browser-result-topline">
          {pantryFit ? (
            <span className={`browser-result-badge browser-result-badge--${pantryFit.state}`}>{pantryFit.badgeLabel}</span>
          ) : (
            <span className="browser-result-badge browser-result-badge--unranked">Eligible</span>
          )}
          <span className="browser-result-metric">{pantryMatchLabel}</span>
          <span className="browser-result-metric">{missingShortLabel}</span>
        </div>
        <div className="browser-result-heading">
          <h3>{recipe.name}</h3>
          <p className="browser-result-decision">{getPantryDecisionLabel(pantryFit)}</p>
          {recipe.short_description && <p className="status-line">{recipe.short_description}</p>}
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
