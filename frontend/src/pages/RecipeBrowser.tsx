import { RECIPE_BROWSER_MVP_FILTER_ORDER } from "../lib/recipeBrowserMvp";

const UPCOMING_BROWSER_CAPABILITIES = [
  "Bubble filters arrive in the next phase.",
  "Active filters and clear states will appear here once selection behavior is wired.",
  "Results will stay pantry-aware when ranking and eligibility logic land.",
] as const;

function RecipeBrowserPage() {
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
            <p className="browser-shell-kicker">Phase 2 shell</p>
            <h2 id="recipe-browser-filters-heading">Filter families</h2>
          </div>
          <p className="browser-shell-note">Selection behavior is intentionally parked until the next filter UI phase.</p>
        </div>

        <div className="filter-family-tabs" role="tablist" aria-label="Recipe Browser filter families">
          {RECIPE_BROWSER_MVP_FILTER_ORDER.map((family, index) => (
            <button
              key={family.id}
              type="button"
              className={`filter-family-tab${index === 0 ? " is-active" : ""}`}
              role="tab"
              aria-selected={index === 0}
              aria-controls={`filter-family-panel-${family.id}`}
              id={`filter-family-tab-${family.id}`}
              disabled={index !== 0}
            >
              {family.label}
            </button>
          ))}
        </div>

        <div
          className="browser-shell-panel"
          role="tabpanel"
          id="filter-family-panel-protein"
          aria-labelledby="filter-family-tab-protein"
        >
          <div className="browser-shell-placeholder">
            <h3>Filter bubble area</h3>
            <p>The active family will show bubble-style choices here in the next phase. This shell is holding the layout only.</p>
          </div>

          <div className="browser-shell-placeholder browser-shell-placeholder--subtle">
            <h3>Active filters</h3>
            <p>No active filter chips yet. This row stays visible later so users can always see what is shaping results.</p>
          </div>
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
            Recipe cards, pantry-readiness badges, and empty states are still to come. This page shell keeps room for those
            pieces without pretending they already work.
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
