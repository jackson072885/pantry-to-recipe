import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";

import {
  RECIPE_BROWSER_MVP_INGREDIENT_GROUPS,
  RECIPE_BROWSER_MVP_FILTER_ORDER,
  RECIPE_BROWSER_MVP_FILTERS,
  getRecipeBrowserIngredientOptionsForBrowseNode,
  type RecipeBrowserMvpFilterFamilyId,
  type RecipeBrowserMvpFilterValueId,
} from "../lib/recipeBrowserMvp";
import { fetchRecipeBrowserCatalog, type RecipeBrowserCatalog, type RecipeDetail } from "../lib/mvpApi";
import { filterRecipeBrowserRecipes, type RecipeBrowserSelectedFilters } from "../lib/recipeBrowserEligibility";
import {
  rankRecipeBrowserRecipes,
  type RankedRecipeBrowserRecipe,
  type RecipeBrowserPantryFit,
} from "../lib/recipeBrowserRanking";
import { getRecipeBrowserIngredientRecoverySuggestions } from "../lib/recipeBrowserRecovery";
import {
  INGREDIENT_BROWSE_NODE_BY_ID,
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

const REGISTRY_TO_IMPLEMENTED_FAMILY_ID: Partial<
  Record<RecipeBrowserRegistryFamilyId, RecipeBrowserMvpFilterFamilyId>
> = {
  ingredients: "ingredients",
  protein: "protein",
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
const DEFAULT_ACTIVE_INGREDIENT_GROUP_ID: RecipeBrowserIngredientNodeId =
  RECIPE_BROWSER_MVP_INGREDIENT_GROUPS[0].id;

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

function getImplementedFamilyId(
  familyId: RecipeBrowserRegistryFamilyId,
): RecipeBrowserMvpFilterFamilyId | null {
  return REGISTRY_TO_IMPLEMENTED_FAMILY_ID[familyId] ?? null;
}

function getImplementedFamilyLabel(familyId: RecipeBrowserMvpFilterFamilyId): string {
  if (familyId === "difficulty") {
    return "Effort";
  }

  return RECIPE_BROWSER_MVP_FILTERS[familyId].label;
}

function getRegistryFamilyIdForImplementedFamily(
  familyId: RecipeBrowserMvpFilterFamilyId,
): RecipeBrowserRegistryFamilyId {
  const registryEntry = RECIPE_BROWSER_FILTER_FAMILY_REGISTRY.find(
    (family) => REGISTRY_TO_IMPLEMENTED_FAMILY_ID[family.id] === familyId,
  );

  return registryEntry?.id ?? "ingredients";
}

function getFamilySelectionNote(familyId: RecipeBrowserMvpFilterFamilyId): string {
  if (familyId === "ingredients") {
    return "Open a group, then add leaf ingredients. Ingredients stack with AND; other families still combine across the browser.";
  }

  if (familyId === "cuisine") {
    return "Cuisine uses OR within the family, and parent picks still include child cuisines.";
  }

  if (familyId === "protein") {
    return "Protein uses OR within the family and follows the current browse-node mapping.";
  }

  if (familyId === "cost") {
    return "Cost uses OR within the family and reflects coarse cost tags only.";
  }

  if (familyId === "cleanup") {
    return "Cleanup uses OR within the family and reflects coarse cleanup tags only.";
  }

  if (familyId === "diet") {
    return "Diet uses OR within the family and only reflects explicit dataset labels on the recipe.";
  }

  if (familyId === "household") {
    return "Household uses OR within the family and reflects explicit weeknight, meal-prep, or kid-friendly tags.";
  }

  return "These values use OR within the family and AND across families.";
}

function getPantryDecisionLabel(pantryFit: RecipeBrowserPantryFit | null): string {
  if (!pantryFit) {
    return "Pantry fit unavailable for this browser session";
  }

  if (pantryFit.state === "cook_now") {
    return "Cook now with what you have";
  }

  if (pantryFit.state === "almost_there") {
    return `Almost there${pantryFit.missingCount > 0 ? ` - missing ${pantryFit.missingCount} ingredient${pantryFit.missingCount === 1 ? "" : "s"}` : ""}`;
  }

  return `Pantry stretch${pantryFit.missingCount > 0 ? ` - missing ${pantryFit.missingCount} ingredient${pantryFit.missingCount === 1 ? "" : "s"}` : ""}`;
}

function getPantryCoverageLine(pantryFit: RecipeBrowserPantryFit | null): string | null {
  if (!pantryFit || typeof pantryFit.pantryCoveragePct !== "number") {
    return null;
  }

  return `Saved pantry covers ${pantryFit.pantryCoveragePct}% of required ingredients`;
}

function getMissingCoverageLine(pantryFit: RecipeBrowserPantryFit | null): string | null {
  if (!pantryFit) {
    return "Missing-ingredient coverage is unavailable right now.";
  }

  if (pantryFit.missingCount === 0) {
    return "Nothing missing from required ingredients";
  }

  return `Missing ${pantryFit.missingCount} required ingredient${pantryFit.missingCount === 1 ? "" : "s"}`;
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

function RecipeBrowserPage() {
  const [activeFamilyId, setActiveFamilyId] = useState<RecipeBrowserRegistryFamilyId>(DEFAULT_ACTIVE_FAMILY_ID);
  const [activeScopeId, setActiveScopeId] = useState<RecipeBrowserScopeId>(DEFAULT_ACTIVE_SCOPE_ID);
  const [activeIngredientGroupId, setActiveIngredientGroupId] = useState<RecipeBrowserIngredientNodeId>(
    DEFAULT_ACTIVE_INGREDIENT_GROUP_ID,
  );
  const [selectedFilters, setSelectedFilters] = useState<RecipeBrowserSelectedFilters>(EMPTY_SELECTED_FILTERS);
  const [filterHistory, setFilterHistory] = useState<FilterHistoryEntry[]>([]);
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState("");
  const [recipes, setRecipes] = useState<RecipeDetail[]>([]);
  const [catalogLoadSummary, setCatalogLoadSummary] = useState<RecipeBrowserCatalog | null>(null);
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
  const ingredientSearchResults = useMemo(
    () => searchIngredientBrowseNodes(ingredientSearchQuery),
    [ingredientSearchQuery],
  );
  const activeIngredientGroup = INGREDIENT_BROWSE_NODE_BY_ID.get(activeIngredientGroupId) ?? RECIPE_BROWSER_MVP_INGREDIENT_GROUPS[0];
  const activeIngredientOptions = useMemo(
    () => getRecipeBrowserIngredientOptionsForBrowseNode(activeIngredientGroupId),
    [activeIngredientGroupId],
  );
  const hasIngredientSearchQuery = ingredientSearchQuery.trim().length > 0;
  const eligibleRecipes = useMemo(
    () => filterRecipeBrowserRecipes(recipes, selectedFilters),
    [recipes, selectedFilters],
  );
  const ingredientRecoverySuggestions = useMemo(
    () =>
      activeScopeId === "explore_all"
        ? getRecipeBrowserIngredientRecoverySuggestions(recipes, selectedFilters)
        : [],
    [activeScopeId, recipes, selectedFilters],
  );
  const activeRecommendations = pantryRankingError ? null : recommendations;
  const rankedRecipes = useMemo(
    () => rankRecipeBrowserRecipes(eligibleRecipes, activeRecommendations),
    [activeRecommendations, eligibleRecipes],
  );
  const hasSavedPantry = pantryNames.length > 0;
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
    if (activeScopeId !== "explore_all" && !hasPantryScopeData) {
      setActiveScopeId("explore_all");
    }
  }, [activeScopeId, hasPantryScopeData]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, familyId: RecipeBrowserRegistryFamilyId) {
    const currentIndex = RECIPE_BROWSER_FILTER_FAMILY_REGISTRY.findIndex((family) => family.id === familyId);

    if (currentIndex < 0) {
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex =
        (currentIndex + direction + RECIPE_BROWSER_FILTER_FAMILY_REGISTRY.length) % RECIPE_BROWSER_FILTER_FAMILY_REGISTRY.length;
      setActiveFamilyId(RECIPE_BROWSER_FILTER_FAMILY_REGISTRY[nextIndex].id);
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveFamilyId(RECIPE_BROWSER_FILTER_FAMILY_REGISTRY[0].id);
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveFamilyId(RECIPE_BROWSER_FILTER_FAMILY_REGISTRY[RECIPE_BROWSER_FILTER_FAMILY_REGISTRY.length - 1].id);
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

  function applyIngredientSearchResult(
    valueId: RecipeBrowserMvpFilterValueId,
    browseNodeId: RecipeBrowserIngredientNodeId,
  ) {
    addFilterValue("ingredients", valueId);
    setActiveFamilyId("ingredients");
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
      setActiveIngredientGroupId(targetOption.browseNodeIds[0]);
    }
  }

  return (
    <main className="page-shell recipe-browser-page">
      <header className="recipe-browser-header">
        <img
          src="/welcome-left-garnish.svg"
          alt=""
          aria-hidden="true"
          className="recipe-browser-header-garnish recipe-browser-header-garnish--left"
        />
        <img
          src="/welcome-right-garnish.svg"
          alt=""
          aria-hidden="true"
          className="recipe-browser-header-garnish recipe-browser-header-garnish--right"
        />
        <div className="recipe-browser-header-art" aria-hidden="true">
          <span className="recipe-browser-header-orb recipe-browser-header-orb--soft" />
          <span className="recipe-browser-header-orb recipe-browser-header-orb--leaf" />
        </div>
        <div className="recipe-browser-header-main">
          <div className="recipe-browser-header-intro">
            <div className="recipe-browser-brand-lockup" aria-hidden="true">
              <span className="recipe-browser-brand">Pantry to Plate</span>
            </div>
            <h1>Recipe Browser</h1>
            <svg
              className="recipe-browser-title-swoosh"
              width="170"
              height="24"
              viewBox="0 0 170 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M6 13C32 7 52 6 82 12C103 16 125 18 164 11" stroke="#CBE86B" strokeWidth="4" strokeLinecap="round" />
              <path d="M104 16C118 18 129 18 144 16" stroke="#B8D85A" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="recipe-browser-subtitle">
              Browse your options. Choose what fits. Cook with confidence.
            </p>
          </div>
        </div>
      </header>

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
              <p className="browser-shell-kicker">Refine the browse</p>
              <h2 id="recipe-browser-filters-heading">Filter families</h2>
            </div>
            <p className="browser-shell-note">
              Filters set eligibility. Pantry fit only changes order.
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
                    Search groups, ingredients, or aliases. Choosing a result adds that leaf and opens its group.
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

                        return (
                          <button
                            key={result.canonicalIngredientId}
                            type="button"
                            className={`browser-search-result${isSelected ? " is-selected" : ""}`}
                            onClick={() => applyIngredientSearchResult(result.canonicalIngredientId, result.browseNodeId)}
                            aria-pressed={isSelected}
                          >
                            <span className="browser-search-result-label">{result.label}</span>
                            <span className="browser-search-result-meta">
                              {isSelected ? "Selected" : `${result.browseNodeLabel} • Matches ${result.matchedTerm}`}
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
                    <h3 id="recipe-browser-active-filters-heading">Current selections</h3>
                    <p className="browser-active-filters-summary">
                      Remove a chip or clear the tray to widen results.
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
                <p>Selections collect here for quick cleanup.</p>
              </section>
            )}

            <div className="filter-family-tabs" role="tablist" aria-label="Recipe Browser filter families">
              {RECIPE_BROWSER_FILTER_FAMILY_REGISTRY.map((family) => {
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
                    aria-label={`${family.label} filters`}
                    id={`filter-family-tab-${family.id}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveFamilyId(family.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, family.id)}
                  >
                    <span className="filter-family-tab-label">{family.label}</span>
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
                      <h3 id="recipe-browser-active-family-heading">{activeFamily.label}</h3>
                    </div>
                    <p className="browser-filter-panel-note">{getFamilySelectionNote(activeFamily.id)}</p>
                  </div>

                  {activeFamily.id === "ingredients" ? (
                    <>
                      <div className="browser-filter-chip-grid" aria-label="Ingredient groups">
                        {RECIPE_BROWSER_MVP_INGREDIENT_GROUPS.map((group) => {
                          const isActive = group.id === activeIngredientGroupId;
                          return (
                            <button
                              key={group.id}
                              type="button"
                              className={`browser-filter-chip browser-filter-chip--browse-group${isActive ? " is-selected" : ""}`}
                              aria-pressed={isActive}
                              onClick={() => setActiveIngredientGroupId(group.id)}
                            >
                              <span className="browser-filter-chip-copy">
                                <span className="browser-filter-chip-title">{group.label}</span>
                                <span className="browser-filter-chip-subtitle">Browse group</span>
                              </span>
                              <span className="browser-filter-chip-state">{isActive ? "Open" : "Browse"}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="browser-filter-subsection">
                        <div className="browser-filter-panel-heading">
                          <div>
                            <p className="browser-filter-panel-kicker">Ingredient leaves</p>
                            <h3>{activeIngredientGroup.label}</h3>
                          </div>
                          <p className="browser-filter-panel-note">Only leaves become active filters.</p>
                        </div>

                        <div className="browser-filter-chip-grid" aria-label={`${activeIngredientGroup.label} ingredient options`}>
                          {activeIngredientOptions.map((option) => {
                            const isSelected = selectedFilters.ingredients.includes(option.id);

                            return (
                              <button
                                key={option.id}
                                type="button"
                                className={`browser-filter-chip browser-filter-chip--leaf${isSelected ? " is-selected" : ""}`}
                                aria-pressed={isSelected}
                                onClick={() => toggleFilterValue("ingredients", option.id)}
                              >
                                <span className="browser-filter-chip-copy">
                                  <span className="browser-filter-chip-title">{option.label}</span>
                                  <span className="browser-filter-chip-subtitle">Ingredient</span>
                                </span>
                                <span className="browser-filter-chip-state">{isSelected ? "Selected" : "Add"}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
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
                            className={`browser-filter-chip browser-filter-chip--leaf${isSelected ? " is-selected" : ""}`}
                            aria-pressed={isSelected}
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
                  ? "No recipes match the current filter stack. Try a quick recovery step."
                  : `No recipes land in ${activeScope.label} with the current filters. Try a quick recovery step.`}
              </p>
              {ingredientRecoverySuggestions.length > 0 ? (
                <>
                  <p className="browser-empty-state-note">
                    These swaps are explicit. The Browser is not widening your exact ingredient behind the scenes.
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
                    {scopedRecipes.length === 1 ? "remains" : "remain"} in this view. That exact result is honest, but it
                    should still feel recoverable instead of brittle.
                  </p>
                  {ingredientRecoverySuggestions.length > 0 ? (
                    <>
                      <p className="browser-empty-state-note">
                        Try an explicit ingredient swap to reopen more options without pretending this leaf matched more
                        recipes than it really did.
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
    typeof pantryFit?.pantryCoveragePct === "number" ? `${pantryFit.pantryCoveragePct}% pantry match` : "Pantry fit pending";
  const missingShortLabel = pantryFit ? `${pantryFit.missingCount} missing` : "Coverage unavailable";

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
