import { Link } from "react-router-dom";
import BestOptionAction from "../components/BestOptionAction";
import RecommendationGroups from "../components/RecommendationGroups";
import { buildBehaviorTrustNote, buildBestOptionComparison, buildEffortSummary, buildHeroTrustExplanation } from "../lib/homeRecommendations";
import { trackEvent } from "../lib/tracking";
import { useSavedPantryRecommendations } from "../lib/useSavedPantryRecommendations";

function RecommendationsPage() {
  const {
    bestEntry,
    error,
    loading,
    pantryItems,
    pantryNames,
    recommendations,
    reload: load,
  } = useSavedPantryRecommendations({
    genericErrorMessage: "Failed to load recommendations.",
    initialLoading: true,
  });

  const alternatives = recommendations?.alternatives ?? [];
  const closestOptions = recommendations?.closest_options ?? alternatives;
  const generatedFrom = recommendations?.generated_from;
  const runnerUpEntry = alternatives[0] ?? closestOptions[0] ?? null;
  const trustExplanation = bestEntry ? buildHeroTrustExplanation(bestEntry, runnerUpEntry) : "";
  const behaviorApplied = Boolean(bestEntry?.score_breakdown?.behavior_applied);
  const comparisonNote = bestEntry ? buildBestOptionComparison(bestEntry, runnerUpEntry) : null;
  const behaviorNote = bestEntry ? buildBehaviorTrustNote(bestEntry) : null;

  return (
    <div className="page-shell" style={{ maxWidth: 1100 }}>
      <header style={{ marginBottom: "1.25rem", display: "grid", gap: "0.9rem" }}>
        <div>
          <div style={{ color: "#0f766e", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.76rem" }}>
            Tonight&apos;s Recommendations
          </div>
          <h1 style={{ margin: "0.35rem 0 0.35rem", fontFamily: '"Space Grotesk", sans-serif', fontSize: "2rem" }}>
            A clear dinner decision from your current pantry
          </h1>
          <p style={{ color: "#64748b", margin: 0, maxWidth: 760 }}>
            Pantry fit leads this ranking. Recent activity can only nudge close calls between similarly strong dinner options.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              void load();
            }}
            style={{ padding: "0.7rem 0.95rem", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: 600 }}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh Recommendations"}
          </button>
          <Link
            to="/pantry"
            style={{ display: "inline-flex", alignItems: "center", padding: "0.7rem 0.95rem", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: 600 }}
          >
            Update Pantry
          </Link>
          <Link
            to="/"
            style={{ display: "inline-flex", alignItems: "center", padding: "0.7rem 0.95rem", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: 600 }}
          >
            Back to Tonight
          </Link>
        </div>
      </header>

      {error && <div style={{ color: "#b91c1c", marginBottom: "1rem", border: "1px solid #fecaca", background: "#fff1f2", padding: "0.85rem", borderRadius: 12 }}>{error}</div>}

      {loading ? (
        <div style={{ border: "1px solid #dbe4ef", borderRadius: 18, background: "#ffffff", padding: "1rem", color: "#475569" }}>
          Loading tonight&apos;s recommendations from your pantry...
        </div>
      ) : pantryItems.length === 0 ? (
        <div style={{ display: "grid", gap: "0.9rem", border: "1px solid #dbe4ef", borderRadius: 18, background: "#ffffff", padding: "1rem" }}>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>Your pantry is empty.</div>
          <div style={{ color: "#475569" }}>Add a few ingredients first so Pantry-to-Recipe can tell you what is realistic for tonight.</div>
          <div>
            <Link to="/pantry" style={{ color: "#0f766e", fontWeight: 700 }}>Go to Pantry</Link>
          </div>
        </div>
      ) : recommendations ? (
        <div style={{ display: "grid", gap: "1rem" }}>
          <section style={{ border: "1px solid #dbe4ef", borderRadius: 18, padding: "1rem", background: "#ffffff" }}>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>Pantry snapshot</div>
            <div style={{ color: "#64748b", fontSize: "0.92rem", marginTop: "0.2rem" }}>
              Using {generatedFrom?.pantry_count ?? pantryNames.length} pantry item{(generatedFrom?.pantry_count ?? pantryNames.length) === 1 ? "" : "s"} for this ranking run.
            </div>
            <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", marginTop: "0.8rem" }}>
              {(generatedFrom?.pantry_items ?? pantryNames).slice(0, 10).map((item) => (
                <span key={item} style={{ borderRadius: 999, border: "1px solid #e2e8f0", background: "#f8fafc", padding: "0.28rem 0.65rem", fontSize: "0.86rem", color: "#334155" }}>
                  {item}
                </span>
              ))}
            </div>
          </section>

          <section style={{ border: "1px solid #dbe4ef", borderRadius: 18, padding: "1rem", background: "#f8fafc" }}>
            <h2 style={{ margin: 0, fontSize: "1.08rem" }}>
              {bestEntry ? "Best Dinner Option Tonight" : "No Strong Match Tonight"}
            </h2>
            {bestEntry ? (
              <div style={{ marginTop: "0.55rem" }}>
                <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", alignItems: "center" }}>
                  <Link
                    to={`/recipes/${bestEntry.recipe.recipe_id}`}
                    style={{ fontWeight: 700, color: "#0f172a", fontSize: "1.15rem" }}
                    onClick={() => {
                      void trackEvent("recipe_selected", {
                        recipeId: bestEntry.recipe.recipe_id,
                        metadata: { source: "best_option:title" },
                      });
                    }}
                  >
                    {bestEntry.recipe.recipe_name}
                  </Link>
                  <span style={{ borderRadius: 999, padding: "0.18rem 0.55rem", background: bestEntry.missing.count === 0 ? "#dcfce7" : "#ffedd5", color: bestEntry.missing.count === 0 ? "#166534" : "#9a3412", fontWeight: 700, fontSize: "0.8rem" }}>
                    {bestEntry.missing.count === 0 ? "Ready now" : `Needs ${bestEntry.missing.count} item${bestEntry.missing.count === 1 ? "" : "s"}`}
                  </span>
                  <span style={{ borderRadius: 999, padding: "0.18rem 0.55rem", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: "0.8rem", textTransform: "capitalize" }}>
                    {bestEntry.confidence_label} confidence
                  </span>
                  {behaviorApplied && (
                    <span style={{ borderRadius: 999, padding: "0.18rem 0.55rem", background: "#f5f3ff", color: "#6d28d9", fontWeight: 700, fontSize: "0.8rem" }}>
                      History broke a close call
                    </span>
                  )}
                  {typeof bestEntry.recipe.estimated_time_minutes === "number" && (
                    <span style={{ color: "#475569", fontSize: "0.9rem" }}>{bestEntry.recipe.estimated_time_minutes} min</span>
                  )}
                </div>
                <div style={{ marginTop: "0.35rem", color: "#0f172a", fontWeight: 700 }}>{bestEntry.why_best}</div>
                <div style={{ marginTop: "0.3rem", color: "#475569" }}>{bestEntry.explanation}</div>
                <div style={{ marginTop: "0.45rem", color: "#0f172a", fontSize: "0.95rem", fontWeight: 600 }}>{trustExplanation}</div>
                <div style={{ marginTop: "0.4rem", color: "#334155", fontSize: "0.92rem" }}>
                  {comparisonNote ?? behaviorNote ?? buildEffortSummary(bestEntry)}
                </div>
                {bestEntry.missing.ingredients.length > 0 && (
                  <div style={{ marginTop: "0.45rem", color: "#92400e", fontSize: "0.92rem" }}>
                    {bestEntry.missing.summary}
                  </div>
                )}
                <BestOptionAction
                  entry={bestEntry}
                  source="recommendations_best_option"
                  linkDestinationSource="best_option"
                  externalBackground="#92400e"
                  internalBackground="#0f172a"
                  marginTop="0.75rem"
                  padding="0.7rem 1rem"
                  hintFontSize="0.86rem"
                  borderRadius={10}
                />
              </div>
            ) : (
              <div style={{ marginTop: "0.55rem", color: "#475569" }}>
                This pantry does not produce a confident top pick right now, so we are showing closest options instead of forcing a winner.
              </div>
            )}
          </section>

          {closestOptions.length > 0 && (
            <section style={{ border: "1px solid #dbe4ef", borderRadius: 18, padding: "1rem", background: "#ffffff" }}>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>
                {bestEntry ? "Backup Options" : "Closest Options"}
              </div>
              <div style={{ marginTop: "0.2rem", color: "#64748b", fontSize: "0.92rem" }}>
                {bestEntry
                  ? "Two or three nearby options in case the first pick is not your mood tonight."
                  : "These are the nearest pantry fits, but each still has enough gaps that none qualifies as a strong winner."}
              </div>
              <div style={{ display: "grid", gap: "0.65rem", marginTop: "0.8rem" }}>
                {closestOptions.map((entry) => (
                  <Link key={entry.recipe.recipe_id} to={`/recipes/${entry.recipe.recipe_id}`} style={{ color: "#0f766e", fontWeight: 600 }}>
                    {entry.recipe.recipe_name} · {entry.why_best}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section style={{ display: "grid", gap: "0.55rem" }}>
            <div style={{ color: "#0f172a", fontWeight: 700 }}>Browse backup buckets</div>
            <div style={{ color: "#64748b", fontSize: "0.92rem" }}>
              The top card above is the primary dinner decision. These grouped buckets are here to help if you want a backup, a quick store-stop option, or a clear pass for tonight.
            </div>
            <RecommendationGroups recommendations={recommendations} emptyMessage="No dinner recommendations are available from your current pantry." />
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default RecommendationsPage;
