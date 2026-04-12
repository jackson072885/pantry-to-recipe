import { useState, type KeyboardEvent } from "react";

import {
  RECIPE_BROWSER_MVP_FILTER_ORDER,
  type RecipeBrowserMvpFilterFamilyId,
  type RecipeBrowserMvpFilterValueId,
} from "../lib/recipeBrowserMvp";

const UPCOMING_BROWSER_CAPABILITIES = [
  "Recipe eligibility and pantry-aware ranking wire up in the next phases.",
  "This filter surface already preserves your selections so the browser feels real before results catch up.",
  "Result counts, badges, and empty states still land separately once browser logic is connected.",
] as const;

type SelectedFiltersByFamily = Record<RecipeBrowserMvpFilterFamilyId, RecipeBrowserMvpFilterValueId[]>;

type ActiveFilter = {
  familyId: RecipeBrowserMvpFilterFamilyId;
  familyLabel: string;
  valueId: RecipeBrowserMvpFilterValueId;
  valueLabel: string;
};

const DEFAULT_ACTIVE_FAMILY_ID = RECIPE_BROWSER_MVP_FILTER_ORDER[0].id;

const EMPTY_SELECTED_FILTERS: SelectedFiltersByFamily = {
  protein: [],
  cuisine: [],
  time: [],
  difficulty: [],
  method: [],
};

function buildActiveFilters(selectedFilters: SelectedFiltersByFamily): ActiveFilter[] {
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

function RecipeBrowserPage() {
  const [activeFamilyId, setActiveFamilyId] = useState<RecipeBrowserMvpFilterFamilyId>(DEFAULT_ACTIVE_FAMILY_ID);
  const [selectedFilters, setSelectedFilters] = useState<SelectedFiltersByFamily>(EMPTY_SELECTED_FILTERS);

  const activeFamily =
    RECIPE_BROWSER_MVP_FILTER_ORDER.find((family) => family.id === activeFamilyId) ?? RECIPE_BROWSER_MVP_FILTER_ORDER[0];
  const activeFilters = buildActiveFilters(selectedFilters);
  const hasActiveFilters = activeFilters.length > 0;

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
            <p className="browser-shell-kicker">Phase 3 and 4 UI wave</p>
            <h2 id="recipe-browser-filters-heading">Filter families</h2>
          </div>
          <p className="browser-shell-note">
            Filters are interactive now, while recipe eligibility and pantry ranking still connect in the next wave.
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
                Select as many bubbles as you want in this family. Results stay unchanged until eligibility logic lands.
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
            <p className="browser-shell-kicker">Results shell</p>
            <h2 id="recipe-browser-results-heading">Pantry-aware browsing</h2>
          </div>
          <div className="browser-results-meta" aria-label="Result count and sort">
            <span className="browser-results-count">Result count coming in Phase 7</span>
            <span className="browser-results-sort">Sorted by: Best Pantry Match</span>
          </div>
        </div>

        <div className="browser-shell-placeholder browser-shell-placeholder--results">
          <h3>Results list</h3>
          <p>
            Filter tabs and selections are live at the UI layer now. Recipe eligibility, result counts, and pantry-aware
            ranking are intentionally still unimplemented so this page does not pretend results are filtered yet.
          </p>
        </div>

        <ul className="browser-upcoming-list" aria-label="Upcoming recipe browser capabilities">
          {UPCOMING_BROWSER_CAPABILITIES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default RecipeBrowserPage;
