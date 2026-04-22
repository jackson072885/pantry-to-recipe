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
    return "Ingredient groups act like browse containers. Open a group, then add real ingredient leaves that stack with AND inside Ingredients while different families still combine with AND across the full filter stack.";
  }

  if (familyId === "cuisine") {
    return "Cuisine bubbles use OR inside this family, and parent selections still include recipes tagged to descendant branches.";
  }

  if (familyId === "protein") {
    return "Protein bubbles use OR inside this family and reflect the recipe's current protein browse-node mapping, not a deeper nutrition or diet model.";
  }

  if (familyId === "cost") {
    return "Cost bubbles use OR inside this family and only reflect the recipe's current coarse cost tag, not precise pricing or budget math.";
  }

  if (familyId === "cleanup") {
    return "Cleanup bubbles use OR inside this family and only reflect the recipe's current coarse cleanup tag, not exact dish count, cookware prediction, or kitchen effort scoring.";
  }

  if (familyId === "diet") {
    return "Diet bubbles use OR inside this family and only reflect explicit dataset-backed diet labels currently present on the recipe. They are browsing cues, not medical, allergy, or nutrition guarantees.";
  }

  if (familyId === "household") {
    return "Household bubbles use OR inside this family and only reflect explicit weeknight, meal-prep, or kid-friendly recipe metadata already present on the recipe. They are browsing cues, not family-size, nutrition, or preference guarantees.";
  }

  return "These values use OR inside this family and still combine with AND across different families.";
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
    return "Saved pantry ranking is unavailable right now, so missing-ingredient coverage is not shown.";
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
    return "Showing because it stays eligible in the current browser view and can still be ranked against your saved pantry.";
  }

  return "Showing because it stays eligible in the current browser view.";
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
  const rankedRecipes = useMemo(
    () => rankRecipeBrowserRecipes(eligibleRecipes, recommendations),
    [eligibleRecipes, recommendations],
  );
  const hasSavedPantry = pantryNames.length > 0;
  const hasPantryScopeData = Boolean(recommendations);
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
    if (recommendations) {
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
  }, [hasSavedPantry, pantryRankingError, pantryRankingLoading, recommendations]);

  const sortExplanation = useMemo(() => {
    if (recommendations) {
      return `Using ${pantryNames.length} saved pantry item${pantryNames.length === 1 ? "" : "s"} to lift Cook Now recipes above Almost There and Pantry Stretch results inside this already-eligible set.`;
    }

    if (pantryRankingLoading) {
      return "Loading your saved pantry so these eligible recipes can be reordered by realistic tonight fit.";
    }

    if (pantryRankingError) {
      return "Pantry-aware ranking could not be loaded, so the eligible Browser results stay in their current order for now.";
    }

    if (hasSavedPantry) {
      return "Your pantry is saved, but the live ranking data did not come through, so the Browser is keeping the current eligible order instead of guessing.";
    }

    return "Add pantry items to unlock Best Pantry Match sorting and result badges grounded in what you can actually cook.";
  }, [hasSavedPantry, pantryNames.length, pantryRankingError, pantryRankingLoading, recommendations]);

  const scopeExplanation = useMemo(() => {
    if (activeScopeId === "explore_all") {
      return "Explore All keeps the full eligible browser set visible while pantry-aware ranking still lifts the best tonight options first when saved pantry data is available.";
    }

    if (hasPantryScopeData) {
      return `${activeScope.label} narrows the live eligible result set to recipes already mapped to that pantry-fit bucket. Filters still apply before this scope cut is made.`;
    }

    if (pantryRankingLoading) {
      return `${activeScope.label} will open as soon as saved pantry ranking finishes loading.`;
    }

    if (pantryRankingError) {
      return `${activeScope.label} needs pantry-aware ranking, so this browser session stays on Explore All instead of guessing which recipes belong in that bucket.`;
    }

    if (hasSavedPantry) {
      return `${activeScope.label} needs pantry-aware ranking data, and that data is not available yet for this session.`;
    }

    return `${activeScope.label} needs saved pantry context. Add pantry items to unlock pantry-fit scopes beyond Explore All.`;
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
    () => getPantryStatusLabel(recommendations, pantryRankingLoading, pantryRankingError, hasSavedPantry),
    [hasSavedPantry, pantryRankingError, pantryRankingLoading, recommendations],
  );
  const pantryStatusTone = useMemo(
    () => getPantryStatusTone(recommendations, pantryRankingLoading, pantryRankingError, hasSavedPantry),
    [hasSavedPantry, pantryRankingError, pantryRankingLoading, recommendations],
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
    toggleFilterValue("ingredients", valueId);
    setActiveFamilyId("ingredients");
    setActiveIngredientGroupId(browseNodeId);
    setIngredientSearchQuery("");
  }

  return (
    <main className="page-shell recipe-browser-page">
      <header className="recipe-browser-header">
        <div className="recipe-browser-header-main">
          <div>
            <p className="recipe-browser-eyebrow">Explore with pantry context</p>
            <h1>Recipe Browser</h1>
            <p className="recipe-browser-subtitle">
              Browse dinner ideas by filter family first, then let pantry fit keep the results grounded in what you can
              realistically cook.
            </p>
          </div>
          <div className="recipe-browser-header-status" aria-label="Recipe Browser session status">
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
        </div>
      </header>

      <div className="recipe-browser-workspace">
        <section className="browser-shell-card browser-controls-shell" aria-labelledby="recipe-browser-filters-heading">
          <div className="browser-shell-section-heading browser-shell-section-heading--controls">
            <div>
              <p className="browser-shell-kicker">Browser contract</p>
              <h2 id="recipe-browser-filters-heading">Filter families</h2>
            </div>
            <p className="browser-shell-note">
              Filters decide eligibility first. Pantry-aware ranking only reorders recipes that already match the current
              filter stack.
            </p>
          </div>

          <div className="browser-command-shell">
            <div className="browser-search-scope-row">
              <section className="browser-search-shell" aria-labelledby="recipe-browser-search-heading">
                <div className="browser-search-shell-heading">
                  <div>
                    <p className="browser-filter-panel-kicker">Search</p>
                    <h3 id="recipe-browser-search-heading">Direct ingredient search</h3>
                  </div>
                  <p className="browser-filter-panel-note">
                    Search ingredient groups, ingredient names, or aliases. Selecting a result adds a real ingredient leaf
                    filter and jumps the Ingredients browser to that group.
                  </p>
                </div>

                <label className="browser-search-input-shell">
                  <span className="browser-search-label">Ingredient search</span>
                  <input
                    type="search"
                    placeholder="Search ingredient filters like garlic or spaghetti"
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
                    <p className="browser-search-hint">
                      Search stays scoped to the Ingredients family so it helps you add ingredient filters without implying
                      full recipe-text search.
                    </p>
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
                      Remove a chip to widen results or clear the full tray to reopen the browser.
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
                <h3>Nothing shaping the result set yet</h3>
                <p>Your selected leaves and filter values will collect here so the browser stays easy to scan and unwind.</p>
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
                                <span className="browser-filter-chip-subtitle">Browse ingredient family</span>
                              </span>
                              <span className="browser-filter-chip-state">{isActive ? "Open" : "Browse group"}</span>
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
                          <p className="browser-filter-panel-note">
                            Only leaf ingredients become active filters. Group labels stay browse-only.
                          </p>
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
                                  <span className="browser-filter-chip-subtitle">Ingredient leaf</span>
                                </span>
                                <span className="browser-filter-chip-state">{isSelected ? "Selected" : "Add leaf"}</span>
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
                              <span className="browser-filter-chip-subtitle">{activeFamily.label} filter</span>
                            </span>
                            <span className="browser-filter-chip-state">{isSelected ? "Selected" : "Add filter"}</span>
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
                    This family is part of the shared browser taxonomy foundation, but this reconstruction phase has not
                    connected it to recipe eligibility yet. The shell stays visible so later phases can add the behavior
                    without reshaping the browser again.
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
              <p className="browser-results-context">
                Eligibility stays strict: taxonomy selections use OR inside a branch-aware family, ingredient selections use
                AND by default, and families still combine with AND across the browser.
              </p>
              {hasPartialCatalogFailures ? (
                <p className="browser-results-context">
                  {catalogLoadSummary?.failedRecipeCount} of {catalogLoadSummary?.totalRecipeCount} Browser recipes could not
                  be loaded, so this result set is grounded in the successfully hydrated catalog only.
                </p>
              ) : null}
            </div>
          </div>

          {loading ? (
            <div className="browser-shell-placeholder browser-shell-placeholder--results" aria-live="polite">
              <p className="browser-shell-placeholder-kicker">Loading browser</p>
              <h3>Loading Browser recipes</h3>
              <p>Pulling the live production recipe set so filter eligibility can run against real Browser-safe metadata.</p>
            </div>
          ) : error ? (
            <div className="browser-shell-placeholder browser-shell-placeholder--results browser-shell-placeholder--error" aria-live="assertive">
              <p className="browser-shell-placeholder-kicker">Needs attention</p>
              <h3>Browser recipes are unavailable</h3>
              <p>The recipe browser could not finish loading this session. Try refreshing the page and retrying once before assuming the catalog is down.</p>
              <p className="browser-shell-placeholder-detail">{error}</p>
            </div>
          ) : scopedRecipes.length === 0 ? (
            <div className="browser-shell-placeholder browser-shell-placeholder--results browser-shell-placeholder--empty" aria-live="polite">
              <p className="browser-shell-placeholder-kicker">No matches</p>
              <h3>No recipes match this browser state</h3>
              <p>
                {activeScopeId === "explore_all"
                  ? "No live recipes match the current filter stack. Try a small recovery step to reopen the live Browser result set without guessing."
                  : `No recipes currently land in ${activeScope.label} after the current filter stack is applied. Try a small recovery step to widen the Browser safely.`}
              </p>
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
                  Closest eligible matches means recipes that still match the current filters once this scope is widened
                  back to Explore All.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              {showLowResultState ? (
                <div className="browser-results-low-state" aria-live="polite">
                  Only {scopedRecipes.length} recipe{scopedRecipes.length === 1 ? "" : "s"}{" "}
                  {scopedRecipes.length === 1 ? "remains" : "remain"} in this browser view. That tight result set is
                  intentional, but relaxing one bubble or widening the scope will open up more variety.
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
