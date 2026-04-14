import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";

import {
  RECIPE_BROWSER_MVP_FILTER_ORDER,
  RECIPE_BROWSER_MVP_FILTERS,
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
  RECIPE_BROWSER_FILTER_FAMILY_REGISTRY,
  RECIPE_BROWSER_SCOPE_OPTIONS,
  type RecipeBrowserScopeId,
} from "../lib/recipeTaxonomy";
import { useSavedPantryRecommendations } from "../lib/useSavedPantryRecommendations";

type ActiveFilter = {
  familyId: RecipeBrowserMvpFilterFamilyId;
  familyLabel: string;
  valueId: RecipeBrowserMvpFilterValueId;
  valueLabel: string;
};

type RecipeBrowserRegistryFamilyId = (typeof RECIPE_BROWSER_FILTER_FAMILY_REGISTRY)[number]["id"];

const REGISTRY_TO_IMPLEMENTED_FAMILY_ID: Partial<
  Record<RecipeBrowserRegistryFamilyId, RecipeBrowserMvpFilterFamilyId>
> = {
  ingredients: "ingredients",
  cuisine: "cuisine",
  time: "time",
  effort: "difficulty",
  method: "method",
};
const DEFAULT_ACTIVE_FAMILY_ID: RecipeBrowserRegistryFamilyId = RECIPE_BROWSER_FILTER_FAMILY_REGISTRY[0].id;
const DEFAULT_ACTIVE_SCOPE_ID: RecipeBrowserScopeId = "explore_all";

const EMPTY_SELECTED_FILTERS: RecipeBrowserSelectedFilters = {
  ingredients: [],
  cuisine: [],
  time: [],
  difficulty: [],
  method: [],
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

function getFamilySelectionNote(familyId: RecipeBrowserMvpFilterFamilyId): string {
  if (familyId === "ingredients") {
    return "Ingredient bubbles stack with AND inside Ingredients, while different families still combine with AND across the full filter stack.";
  }

  if (familyId === "cuisine") {
    return "Cuisine bubbles use OR inside this family, and parent selections still include recipes tagged to descendant branches.";
  }

  return "These values use OR inside this family and still combine with AND across different families.";
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
  const [selectedFilters, setSelectedFilters] = useState<RecipeBrowserSelectedFilters>(EMPTY_SELECTED_FILTERS);
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
  }

  function removeActiveFilter(familyId: RecipeBrowserMvpFilterFamilyId, valueId: RecipeBrowserMvpFilterValueId) {
    setSelectedFilters((current) => ({
      ...current,
      [familyId]: (current[familyId] as RecipeBrowserMvpFilterValueId[]).filter(
        (currentValueId) => currentValueId !== valueId,
      ),
    }) as RecipeBrowserSelectedFilters);
  }

  function clearAllFilters() {
    setSelectedFilters(EMPTY_SELECTED_FILTERS);
  }

  return (
    <main className="page-shell recipe-browser-page">
      <header className="recipe-browser-header">
        <p className="recipe-browser-eyebrow">Explore with pantry context</p>
        <h1>Recipe Browser</h1>
        <p className="recipe-browser-subtitle">
          Browse dinner ideas by filter family first, then let pantry fit keep the results grounded in what you can
          realistically cook.
        </p>
      </header>

      <section className="browser-shell-card" aria-labelledby="recipe-browser-filters-heading">
        <div className="browser-shell-section-heading">
          <div>
            <p className="browser-shell-kicker">Browser contract</p>
            <h2 id="recipe-browser-filters-heading">Filter families</h2>
          </div>
          <p className="browser-shell-note">
            Filters decide eligibility first. Pantry-aware ranking only reorders recipes that already match the current
            filter stack.
          </p>
        </div>

        <div className="browser-search-scope-row">
          <section className="browser-search-shell" aria-labelledby="recipe-browser-search-heading">
            <div className="browser-search-shell-heading">
              <div>
                <p className="browser-filter-panel-kicker">Search</p>
                <h3 id="recipe-browser-search-heading">Direct ingredient search</h3>
              </div>
              <p className="browser-filter-panel-note">
                The row is in place for the single-surface browser, but live ingredient search is landing in the next
                browser phase.
              </p>
            </div>

            <label className="browser-search-input-shell">
              <span className="browser-search-label">Ingredient search</span>
              <input
                type="search"
                placeholder="Direct ingredient search arrives next phase"
                disabled
                aria-label="Direct ingredient search coming next phase"
              />
            </label>
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
                <span>{family.label}</span>
                {selectionCount > 0 ? <span className="filter-family-tab-count">{selectionCount}</span> : null}
                {!family.enabled ? <span className="filter-family-tab-status">Later</span> : null}
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

              <div className="browser-filter-chip-grid" aria-label={`${activeFamily.label} filter options`}>
                {activeFamily.options.map((option) => {
                  const isSelected = (selectedFilters[activeFamily.id] as readonly RecipeBrowserMvpFilterValueId[]).includes(
                    option.id,
                  );

                  return (
                  <button
                    key={option.id}
                    type="button"
                    className={`browser-filter-chip${isSelected ? " is-selected" : ""}`}
                    aria-pressed={isSelected}
                      onClick={() => toggleFilterValue(activeFamily.id, option.id)}
                    >
                      <span>{option.label}</span>
                      <span className="browser-filter-chip-state">{isSelected ? "Selected" : "Add"}</span>
                    </button>
                  );
                })}
              </div>
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

        {hasActiveFilters ? (
          <section className="browser-active-filters" aria-labelledby="recipe-browser-active-filters-heading">
            <div className="browser-active-filters-header">
              <div>
                <p className="browser-filter-panel-kicker">Active filters</p>
                <h3 id="recipe-browser-active-filters-heading">Current selections</h3>
              </div>
              <button type="button" className="browser-active-filters-clear" onClick={clearAllFilters}>
                Clear all
              </button>
            </div>

            <div className="browser-active-filters-row" aria-label="Active recipe browser filters">
              {activeFilters.map((filter) => (
                <button
                  key={`${filter.familyId}-${filter.valueId}`}
                  type="button"
                  className="browser-active-filter-chip"
                  onClick={() => removeActiveFilter(filter.familyId, filter.valueId)}
                  aria-label={`Remove ${filter.valueLabel} from ${getImplementedFamilyLabel(filter.familyId)}`}
                >
                  <span className="browser-active-filter-family">{getImplementedFamilyLabel(filter.familyId)}</span>
                  <span className="browser-active-filter-value">{filter.valueLabel}</span>
                  <span className="browser-active-filter-remove" aria-hidden="true">
                    x
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <section className="browser-active-filters browser-active-filters--empty" aria-live="polite">
            <h3>Active Filters</h3>
            <p>Your selected bubbles will collect here so it stays easy to scan what is shaping the browser.</p>
          </section>
        )}
      </section>

      <section className="browser-shell-card browser-results-shell" aria-labelledby="recipe-browser-results-heading">
        <div className="browser-shell-section-heading">
          <div>
            <p className="browser-shell-kicker">Eligible recipes</p>
            <h2 id="recipe-browser-results-heading">Pantry-aware browsing</h2>
          </div>
          <div className="browser-results-meta" aria-label="Result count and sort">
            <span className="browser-results-count">{resultCountLabel}</span>
            <span className="browser-results-sort">{sortLabel}</span>
          </div>
        </div>
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

        {loading ? (
          <div className="browser-shell-placeholder browser-shell-placeholder--results" aria-live="polite">
            <h3>Loading Browser recipes</h3>
            <p>Pulling the live production recipe set so filter eligibility can run against real Browser-safe metadata.</p>
          </div>
        ) : error ? (
          <div className="browser-shell-placeholder browser-shell-placeholder--results" aria-live="assertive">
            <h3>Browser recipes are unavailable</h3>
            <p>{error}</p>
          </div>
        ) : scopedRecipes.length === 0 ? (
          <div className="browser-shell-placeholder browser-shell-placeholder--results" aria-live="polite">
            <h3>No eligible recipes</h3>
            <p>
              {activeScopeId === "explore_all"
                ? "None of the live recipes match this filter stack. Remove a bubble or clear the current selections to widen the Browser back out."
                : `No recipes currently land in ${activeScope.label} after the active filter stack is applied. Try Explore All or relax one of the current filters.`}
            </p>
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
                <RecipeBrowserResultCard key={recipe.id} recipe={recipe} pantryFit={pantryFit} />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function RecipeBrowserResultCard({
  recipe,
  pantryFit,
}: {
  recipe: RecipeDetail;
  pantryFit: RecipeBrowserPantryFit | null;
}) {
  const timeLabel = formatMinutes(recipe.total_time_minutes);
  const detailLine = [
    recipe.cuisine ? `Cuisine: ${recipe.cuisine}` : null,
    recipe.primary_protein ? `Primary protein: ${recipe.primary_protein}` : null,
    timeLabel ? `Time: ${timeLabel}` : null,
    recipe.difficulty ? `Difficulty: ${recipe.difficulty}` : null,
    recipe.cook_method ? `Method: ${recipe.cook_method}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <article className="results-card">
      {pantryFit ? (
        <div className="browser-result-topline">
          <span className={`browser-result-badge browser-result-badge--${pantryFit.state}`}>{pantryFit.badgeLabel}</span>
          {typeof pantryFit.pantryCoveragePct === "number" ? (
            <span className="browser-result-metric">{pantryFit.pantryCoveragePct}% pantry match</span>
          ) : null}
          <span className="browser-result-metric">
            {pantryFit.missingCount === 0
              ? "No missing items"
              : `Needs ${pantryFit.missingCount} item${pantryFit.missingCount === 1 ? "" : "s"}`}
          </span>
        </div>
      ) : null}
      <h3>{recipe.name}</h3>
      {recipe.short_description && <p className="status-line">{recipe.short_description}</p>}
      {pantryFit ? <p className="browser-result-summary">{pantryFit.summary}</p> : null}
      {detailLine ? <p className="status-line">{detailLine}</p> : null}
      <Link to={`/recipes/${recipe.id}`}>Open recipe</Link>
    </article>
  );
}

export default RecipeBrowserPage;
