import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";

import {
  RECIPE_BROWSER_MVP_FILTER_ORDER,
  type RecipeBrowserMvpFilterFamilyId,
  type RecipeBrowserMvpFilterValueId,
} from "../lib/recipeBrowserMvp";
import { fetchRecipeBrowserCatalog, type RecipeDetail } from "../lib/mvpApi";
import { filterRecipeBrowserRecipes, type RecipeBrowserSelectedFilters } from "../lib/recipeBrowserEligibility";

type ActiveFilter = {
  familyId: RecipeBrowserMvpFilterFamilyId;
  familyLabel: string;
  valueId: RecipeBrowserMvpFilterValueId;
  valueLabel: string;
};

const DEFAULT_ACTIVE_FAMILY_ID = RECIPE_BROWSER_MVP_FILTER_ORDER[0].id;

const EMPTY_SELECTED_FILTERS: RecipeBrowserSelectedFilters = {
  protein: [],
  cuisine: [],
  time: [],
  difficulty: [],
  method: [],
};

function buildActiveFilters(selectedFilters: RecipeBrowserSelectedFilters): ActiveFilter[] {
  return RECIPE_BROWSER_MVP_FILTER_ORDER.flatMap((family) =>
    family.options
      .filter((option) => selectedFilters[family.id].includes(option.id))
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

function RecipeBrowserPage() {
  const [activeFamilyId, setActiveFamilyId] = useState<RecipeBrowserMvpFilterFamilyId>(DEFAULT_ACTIVE_FAMILY_ID);
  const [selectedFilters, setSelectedFilters] = useState<RecipeBrowserSelectedFilters>(EMPTY_SELECTED_FILTERS);
  const [recipes, setRecipes] = useState<RecipeDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeFamily =
    RECIPE_BROWSER_MVP_FILTER_ORDER.find((family) => family.id === activeFamilyId) ?? RECIPE_BROWSER_MVP_FILTER_ORDER[0];
  const activeFilters = buildActiveFilters(selectedFilters);
  const hasActiveFilters = activeFilters.length > 0;
  const eligibleRecipes = useMemo(
    () => filterRecipeBrowserRecipes(recipes, selectedFilters),
    [recipes, selectedFilters],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadBrowserRecipes() {
      setLoading(true);
      setError("");

      try {
        const nextRecipes = await fetchRecipeBrowserCatalog();
        if (!cancelled) {
          setRecipes(nextRecipes);
        }
      } catch (requestError: unknown) {
        if (!cancelled) {
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

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, familyId: RecipeBrowserMvpFilterFamilyId) {
    const currentIndex = RECIPE_BROWSER_MVP_FILTER_ORDER.findIndex((family) => family.id === familyId);

    if (currentIndex < 0) {
      return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex =
        (currentIndex + direction + RECIPE_BROWSER_MVP_FILTER_ORDER.length) % RECIPE_BROWSER_MVP_FILTER_ORDER.length;
      setActiveFamilyId(RECIPE_BROWSER_MVP_FILTER_ORDER[nextIndex].id);
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveFamilyId(RECIPE_BROWSER_MVP_FILTER_ORDER[0].id);
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveFamilyId(RECIPE_BROWSER_MVP_FILTER_ORDER[RECIPE_BROWSER_MVP_FILTER_ORDER.length - 1].id);
    }
  }

  function toggleFilterValue(familyId: RecipeBrowserMvpFilterFamilyId, valueId: RecipeBrowserMvpFilterValueId) {
    setSelectedFilters((current) => {
      const currentValues = current[familyId];
      const nextValues = currentValues.includes(valueId)
        ? currentValues.filter((currentValueId) => currentValueId !== valueId)
        : [...currentValues, valueId];

      return {
        ...current,
        [familyId]: nextValues,
      };
    });
  }

  function removeActiveFilter(familyId: RecipeBrowserMvpFilterFamilyId, valueId: RecipeBrowserMvpFilterValueId) {
    setSelectedFilters((current) => ({
      ...current,
      [familyId]: current[familyId].filter((currentValueId) => currentValueId !== valueId),
    }));
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
            <p className="browser-shell-kicker">Phase 5 eligibility logic</p>
            <h2 id="recipe-browser-filters-heading">Filter families</h2>
          </div>
          <p className="browser-shell-note">
            Filters now narrow the live Browser recipe set. Pantry-aware ranking still waits for Phase 6.
          </p>
        </div>

        <div className="filter-family-tabs" role="tablist" aria-label="Recipe Browser filter families">
          {RECIPE_BROWSER_MVP_FILTER_ORDER.map((family) => {
            const isActive = family.id === activeFamilyId;

            return (
              <button
                key={family.id}
                type="button"
                className={`filter-family-tab${isActive ? " is-active" : ""}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`filter-family-panel-${family.id}`}
                aria-label={`${family.label} filters`}
                id={`filter-family-tab-${family.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveFamilyId(family.id)}
                onKeyDown={(event) => handleTabKeyDown(event, family.id)}
              >
                {family.label}
              </button>
            );
          })}
        </div>

        <div
          className="browser-shell-panel"
          role="tabpanel"
          id={`filter-family-panel-${activeFamily.id}`}
          aria-labelledby={`filter-family-tab-${activeFamily.id}`}
        >
          <section className="browser-filter-panel" aria-labelledby="recipe-browser-active-family-heading">
            <div className="browser-filter-panel-heading">
              <div>
                <p className="browser-filter-panel-kicker">Now browsing</p>
                <h3 id="recipe-browser-active-family-heading">{activeFamily.label}</h3>
              </div>
              <p className="browser-filter-panel-note">
                Select as many bubbles as you want in this family. Matches use OR inside the family and AND across
                different families.
              </p>
            </div>

            <div className="browser-filter-chip-grid" aria-label={`${activeFamily.label} filter options`}>
              {activeFamily.options.map((option) => {
                const isSelected = selectedFilters[activeFamily.id].includes(option.id);

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
                    aria-label={`Remove ${filter.valueLabel} from ${filter.familyLabel}`}
                  >
                    <span className="browser-active-filter-family">{filter.familyLabel}</span>
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
        </div>
      </section>

      <section className="browser-shell-card browser-results-shell" aria-labelledby="recipe-browser-results-heading">
        <div className="browser-shell-section-heading">
          <div>
            <p className="browser-shell-kicker">Eligible recipes</p>
            <h2 id="recipe-browser-results-heading">Pantry-aware browsing</h2>
          </div>
          <div className="browser-results-meta" aria-label="Result count and sort">
            <span className="browser-results-count">
              {loading ? "Loading recipes..." : `${eligibleRecipes.length} eligible recipe${eligibleRecipes.length === 1 ? "" : "s"}`}
            </span>
            <span className="browser-results-sort">Order: Current recipe order</span>
          </div>
        </div>

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
        ) : eligibleRecipes.length === 0 ? (
          <div className="browser-shell-placeholder browser-shell-placeholder--results" aria-live="polite">
            <h3>No eligible recipes</h3>
            <p>None of the live recipes match the current filter combination. Remove a bubble to broaden the Browser set.</p>
          </div>
        ) : (
          <div className="results-grid" aria-label="Recipe Browser results">
            {eligibleRecipes.map((recipe) => (
              <RecipeBrowserResultCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function RecipeBrowserResultCard({ recipe }: { recipe: RecipeDetail }) {
  const timeLabel = formatMinutes(recipe.total_time_minutes);

  return (
    <article className="results-card">
      <h3>{recipe.name}</h3>
      {recipe.short_description && <p className="status-line">{recipe.short_description}</p>}
      <p className="status-line">
        {[
          recipe.cuisine ? `Cuisine: ${recipe.cuisine}` : null,
          recipe.primary_protein ? `Protein: ${recipe.primary_protein}` : null,
          timeLabel ? `Time: ${timeLabel}` : null,
          recipe.difficulty ? `Difficulty: ${recipe.difficulty}` : null,
          recipe.cook_method ? `Method: ${recipe.cook_method}` : null,
        ]
          .filter(Boolean)
          .join(" • ")}
      </p>
      <Link to={`/recipes/${recipe.id}`}>Open recipe</Link>
    </article>
  );
}

export default RecipeBrowserPage;
