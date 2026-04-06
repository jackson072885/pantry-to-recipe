import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import RecommendationGroups from "../components/RecommendationGroups";
import type { RecommendationEntry } from "../lib/mvpApi";
import { getCookTonightHref, isExternalCookTonightHref } from "../lib/shoppingLinks";
import { trackCtaClicked, trackCtaRendered, trackEvent, trackOutboundLinkOpened } from "../lib/tracking";
import { useSavedPantryRecommendations } from "../lib/useSavedPantryRecommendations";

function bestActionLabel(entry: RecommendationEntry): string {
  const href = getCookTonightHref(entry);
  const isExternal = isExternalCookTonightHref(href);

  if (entry.missing.count === 0) {
    return "Cook This Tonight";
  }

  if (isExternal) {
    return "Get Missing Ingredients";
  }

  return entry.cta.label;
}

function BestOptionAction({ entry }: { entry: RecommendationEntry }) {
  const href = getCookTonightHref(entry);
  const isExternal = isExternalCookTonightHref(href);
  const renderTracked = useRef(false);
  const actionStyle = {
    display: "inline-block",
    marginTop: "0.9rem",
    padding: "0.8rem 1.05rem",
    borderRadius: 12,
    background: isExternal ? "#92400e" : "#166534",
    color: "#ffffff",
    fontWeight: 700,
    textDecoration: "none",
  } as const;

  useEffect(() => {
    if (renderTracked.current) return;
    renderTracked.current = true;
    void trackCtaRendered(entry.recipe.recipe_id, {
      source: "home_best_option",
      destination: isExternal ? "outbound" : "recipe_detail",
      missing_count: entry.missing.count,
    });
  }, [entry.missing.count, entry.recipe.recipe_id, isExternal]);

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        style={actionStyle}
        onClick={() => {
          void trackCtaClicked(entry.recipe.recipe_id, {
            source: "home_best_option:cta",
            destination: "outbound",
          });
          void trackEvent("ingredients_requested", {
            recipeId: entry.recipe.recipe_id,
            metadata: {
              source: "home_best_option:cta",
              missing_count: entry.missing.count,
              missing_ingredients: entry.missing.ingredients,
            },
          });
          void trackOutboundLinkOpened(entry.recipe.recipe_id, {
            source: "home_best_option:cta",
            href,
            missing_count: entry.missing.count,
            missing_ingredients: entry.missing.ingredients,
          });
        }}
      >
        {bestActionLabel(entry)}
      </a>
    );
  }

  return (
    <Link
      to={href}
      style={actionStyle}
      onClick={() => {
        void trackCtaClicked(entry.recipe.recipe_id, {
          source: "home_best_option:cta",
          destination: "recipe_detail",
        });
        void trackEvent("recipe_selected", {
          recipeId: entry.recipe.recipe_id,
          metadata: { source: "home_best_option:cta" },
        });
      }}
    >
      {bestActionLabel(entry)}
    </Link>
  );
}

function HomePage() {
  const {
    bestEntry,
    error,
    loading,
    pantryNames,
    recommendations: result,
    reload: loadSavedPantry,
  } = useSavedPantryRecommendations({
    genericErrorMessage: "Failed to load tonight's dinner options.",
    resetStateOnError: true,
  });

  const alternatives = result?.alternatives ?? [];
  const closestOptions = result?.closest_options ?? alternatives;
  const generatedFrom = result?.generated_from;
  const snapshotPreview = (generatedFrom?.pantry_items ?? pantryNames).slice(0, 8);
  const isWeakResult = bestEntry ? bestEntry.missing.count > 0 || bestEntry.recommendation_type !== "cook_now" : false;
  const pantryCoverage = bestEntry ? Math.round(bestEntry.recipe.pantry_coverage_pct) : null;

  return (
    <div className="page-shell" style={{ maxWidth: 1100 }}>
      <section
        style={{
          padding: "1.4rem",
          border: "1px solid #dbe4ef",
          borderRadius: 22,
          background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(240,249,255,0.96) 100%)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ color: "#0f766e", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.76rem" }}>
          Tonight
        </div>
        <h1 style={{ margin: "0.45rem 0 0.6rem", fontSize: "2.45rem", lineHeight: 1.05, fontFamily: '"Space Grotesk", sans-serif' }}>
          Dinner from what you already have
        </h1>
        <p style={{ color: "#475569", margin: 0, fontSize: "1.02rem", maxWidth: 640 }}>
          See your strongest dinner pick first, based on your saved pantry. Extra options stay below if you want a backup plan.
        </p>

        {error && !loading && (
          <div
            style={{
              marginTop: "1rem",
              color: "#991b1b",
              whiteSpace: "pre-wrap",
              border: "1px solid #fecaca",
              background: "#fff1f2",
              borderRadius: 16,
              padding: "0.95rem",
              display: "grid",
              gap: "0.7rem",
            }}
          >
            <div style={{ fontWeight: 700 }}>We couldn&apos;t load your dinner picks.</div>
            <div>{error}</div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  void loadSavedPantry();
                }}
                style={{
                  padding: "0.75rem 0.95rem",
                  borderRadius: 12,
                  border: "1px solid #ef4444",
                  background: "#ffffff",
                  color: "#991b1b",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </section>

      <section style={{ marginTop: "1rem", border: "1px solid #dbe4ef", borderRadius: 20, padding: "1.1rem", background: "#ffffff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Your Pantry Tonight</h2>
            <p style={{ color: "#64748b", margin: "0.3rem 0 0" }}>
              {pantryNames.length > 0
                ? `${pantryNames.length} saved item${pantryNames.length === 1 ? "" : "s"} powering tonight's dinner picks.`
                : "No saved pantry yet. Add a few ingredients once so Home can suggest dinner right away."}
            </p>
          </div>
          <Link
            to="/pantry"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.65rem 0.95rem",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              fontWeight: 600,
              background: "#ffffff",
            }}
          >
            Edit Pantry
          </Link>
        </div>

        {snapshotPreview.length > 0 ? (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.9rem" }}>
            {snapshotPreview.map((item) => (
              <span
                key={item}
                style={{
                  borderRadius: 999,
                  padding: "0.35rem 0.7rem",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  color: "#334155",
                  fontSize: "0.88rem",
                }}
              >
                {item}
              </span>
            ))}
            {(generatedFrom?.pantry_count ?? pantryNames.length) > snapshotPreview.length && (
              <span style={{ color: "#64748b", alignSelf: "center", fontSize: "0.88rem" }}>
                +{(generatedFrom?.pantry_count ?? pantryNames.length) - snapshotPreview.length} more
              </span>
            )}
          </div>
        ) : (
          <div style={{ marginTop: "0.85rem", color: "#64748b" }}>
            Start with a simple list like <strong>eggs, rice, onion</strong>.
          </div>
        )}
      </section>

      {loading ? (
        <section
          style={{
            marginTop: "1.4rem",
            border: "1px solid #dbe4ef",
            borderRadius: 22,
            padding: "1.25rem",
            color: "#475569",
            background: "#ffffff",
            display: "grid",
            gap: "1rem",
          }}
        >
          <div>
            <div style={{ color: "#0f766e", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Building Tonight&apos;s Pick
            </div>
            <div style={{ marginTop: "0.35rem", fontSize: "1.45rem", fontWeight: 700, color: "#0f172a" }}>
              We&apos;re picking the best dinner from your pantry.
            </div>
            <div style={{ marginTop: "0.35rem", maxWidth: 680 }}>
              We&apos;re checking what you already have so your best option shows up first, with backups underneath.
            </div>
          </div>
          <div
            aria-hidden="true"
            style={{
              display: "grid",
              gap: "0.75rem",
            }}
          >
            <div style={{ height: 18, width: "24%", borderRadius: 999, background: "#dbeafe" }} />
            <div style={{ height: 38, width: "58%", borderRadius: 14, background: "#e2e8f0" }} />
            <div style={{ height: 16, width: "88%", borderRadius: 999, background: "#e2e8f0" }} />
            <div style={{ height: 16, width: "72%", borderRadius: 999, background: "#f1f5f9" }} />
            <div style={{ height: 44, width: 220, borderRadius: 14, background: "#99f6e4" }} />
          </div>
        </section>
      ) : pantryNames.length === 0 ? (
        <section
          style={{
            marginTop: "1.4rem",
            display: "grid",
            gap: "0.9rem",
            border: "1px solid #dbe4ef",
            borderRadius: 22,
            padding: "1.2rem",
            background: "#ffffff",
          }}
        >
          <div style={{ color: "#0f766e", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Start Here
          </div>
          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "1.45rem" }}>Add a few ingredients and get a dinner pick in seconds.</div>
          <div style={{ color: "#475569", maxWidth: 640 }}>
            Save a few pantry items once, then Home can keep surfacing your best dinner option first.
          </div>
          <div>
            <Link
              to="/pantry"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.8rem 1rem",
                borderRadius: 12,
                background: "#0f766e",
                color: "#ffffff",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Add Ingredients
            </Link>
          </div>
        </section>
      ) : result && bestEntry ? (
        <section style={{ marginTop: "1.5rem", display: "grid", gap: "1rem" }}>
          <div
            style={{
              border: `1px solid ${isWeakResult ? "#fdba74" : "#86efac"}`,
              borderRadius: 24,
              padding: "1.4rem",
              background: isWeakResult
                ? "linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%)"
                : "linear-gradient(180deg, #f0fdf4 0%, #ecfeff 100%)",
              boxShadow: "0 20px 44px rgba(15, 23, 42, 0.08)",
            }}
          >
            <div
              style={{
                color: isWeakResult ? "#9a3412" : "#166534",
                fontWeight: 700,
                fontSize: "0.8rem",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {isWeakResult ? "Closest Match Tonight" : "Best Dinner Option Tonight"}
            </div>
            <div style={{ marginTop: "0.75rem", display: "grid", gap: "1rem" }}>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", alignItems: "center" }}>
                <span
                  style={{
                    borderRadius: 999,
                    padding: "0.35rem 0.7rem",
                    background: "#ffffff",
                    color: isWeakResult ? "#9a3412" : "#166534",
                    border: `1px solid ${isWeakResult ? "#fdba74" : "#86efac"}`,
                    fontWeight: 700,
                    fontSize: "0.82rem",
                  }}
                >
                  {bestEntry.missing.count === 0 ? "Ready to cook now" : bestEntry.missing.summary}
                </span>
                {pantryCoverage !== null && (
                  <span style={{ borderRadius: 999, padding: "0.35rem 0.7rem", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: "0.82rem" }}>
                    {pantryCoverage}% pantry coverage
                  </span>
                )}
                {typeof bestEntry.recipe.estimated_time_minutes === "number" && (
                  <span style={{ borderRadius: 999, padding: "0.35rem 0.7rem", background: "#ffffff", color: "#475569", border: "1px solid #cbd5e1", fontWeight: 600, fontSize: "0.82rem" }}>
                    {bestEntry.recipe.estimated_time_minutes} minutes
                  </span>
                )}
              </div>
              <div>
                <Link
                  to={`/recipes/${bestEntry.recipe.recipe_id}`}
                  style={{
                    fontWeight: 700,
                    color: "#0f172a",
                    fontSize: "2rem",
                    lineHeight: 1.05,
                    textDecoration: "none",
                    display: "inline-block",
                  }}
                  onClick={() => {
                    void trackEvent("recipe_selected", {
                      recipeId: bestEntry.recipe.recipe_id,
                      metadata: { source: "home_best_option:title" },
                    });
                  }}
                >
                  {bestEntry.recipe.recipe_name}
                </Link>
                <div style={{ marginTop: "0.7rem", color: "#0f172a", fontWeight: 700, fontSize: "1.08rem" }}>
                  {bestEntry.why_best ?? (isWeakResult ? "This is the closest match from what you have on hand." : "This is your strongest dinner match for tonight.")}
                </div>
                <div style={{ marginTop: "0.45rem", color: "#475569", maxWidth: 720, fontSize: "1rem" }}>{bestEntry.explanation}</div>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: "0.65rem",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                }}
              >
                <div style={{ borderRadius: 16, background: "#ffffff", padding: "0.9rem", border: "1px solid rgba(148, 163, 184, 0.25)" }}>
                  <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Why it works</div>
                  <div style={{ marginTop: "0.35rem", color: "#0f172a", fontWeight: 700 }}>
                    {bestEntry.missing.count === 0 ? "You already have everything you need." : `${bestEntry.missing.count} ingredient${bestEntry.missing.count === 1 ? "" : "s"} still needed`}
                  </div>
                </div>
                <div style={{ borderRadius: 16, background: "#ffffff", padding: "0.9rem", border: "1px solid rgba(148, 163, 184, 0.25)" }}>
                  <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Next step</div>
                  <div style={{ marginTop: "0.35rem", color: "#0f172a", fontWeight: 700 }}>
                    {bestEntry.missing.count === 0 ? "Open the recipe and start cooking." : "Check the recipe and fill the last gaps."}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", alignItems: "center" }}>
                <BestOptionAction entry={bestEntry} />
                <Link
                  to={`/recipes/${bestEntry.recipe.recipe_id}`}
                  style={{ color: "#0f172a", fontWeight: 700 }}
                  onClick={() => {
                    void trackEvent("recipe_selected", {
                      recipeId: bestEntry.recipe.recipe_id,
                      metadata: { source: "home_best_option:secondary_cta" },
                    });
                  }}
                >
                  View Full Recipe
                </Link>
              </div>
            </div>
          </div>

          {alternatives.length > 0 && (
            <section style={{ border: "1px solid #dbe4ef", borderRadius: 18, padding: "1rem", background: "#ffffff" }}>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>More Good Options</div>
              <div style={{ marginTop: "0.2rem", color: "#64748b", fontSize: "0.92rem" }}>
                These come from the same pantry check, but your top pick above is still the best place to start.
              </div>
              <div style={{ display: "grid", gap: "0.65rem", marginTop: "0.8rem" }}>
                {alternatives.map((entry) => (
                  <Link
                    key={entry.recipe.recipe_id}
                    to={`/recipes/${entry.recipe.recipe_id}`}
                    style={{
                      color: "#0f766e",
                      fontWeight: 600,
                      textDecoration: "none",
                      padding: "0.8rem 0.9rem",
                      borderRadius: 14,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {entry.recipe.recipe_name} · {entry.why_best}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <RecommendationGroups recommendations={result} emptyMessage="No dinner recommendations are available from this pantry yet." />
        </section>
      ) : result ? (
        <section style={{ marginTop: "1.4rem", display: "grid", gap: "1rem" }}>
          <section style={{ display: "grid", gap: "0.8rem", border: "1px solid #fdba74", borderRadius: 18, padding: "1rem", background: "#fff7ed" }}>
            <div style={{ fontWeight: 700, color: "#9a3412", fontSize: "1.08rem" }}>No strong match tonight.</div>
            <div style={{ color: "#7c2d12", maxWidth: 700 }}>
              Your pantry loaded correctly, but none of the current recipes are a confident top pick. Here are the closest options instead of forcing a winner.
            </div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link to="/pantry" style={{ color: "#9a3412", fontWeight: 700 }}>
                Edit Pantry
              </Link>
              <button
                type="button"
                onClick={() => {
                  void loadSavedPantry();
                }}
                style={{
                  border: "1px solid #fdba74",
                  background: "#ffffff",
                  color: "#7c2d12",
                  fontWeight: 700,
                  borderRadius: 10,
                  padding: "0.65rem 0.9rem",
                  cursor: "pointer",
                }}
              >
                Check Saved Pantry Again
              </button>
            </div>
          </section>

          {closestOptions.length > 0 && (
            <section style={{ border: "1px solid #dbe4ef", borderRadius: 18, padding: "1rem", background: "#ffffff" }}>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>Closest Options From Your Pantry</div>
              <div style={{ marginTop: "0.2rem", color: "#64748b", fontSize: "0.92rem" }}>
                These are the nearest fits right now, but each still has meaningful gaps.
              </div>
              <div style={{ display: "grid", gap: "0.65rem", marginTop: "0.8rem" }}>
                {closestOptions.map((entry) => (
                  <Link
                    key={entry.recipe.recipe_id}
                    to={`/recipes/${entry.recipe.recipe_id}`}
                    style={{
                      color: "#0f766e",
                      fontWeight: 600,
                      textDecoration: "none",
                      padding: "0.8rem 0.9rem",
                      borderRadius: 14,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {entry.recipe.recipe_name} · {entry.missing.summary}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <RecommendationGroups recommendations={result} emptyMessage="No dinner recommendations are available from this pantry yet." />
        </section>
      ) : (
        <section style={{ marginTop: "1.4rem", display: "grid", gap: "0.8rem", border: "1px solid #dbe4ef", borderRadius: 18, padding: "1rem", background: "#ffffff" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "1.08rem" }}>We need a little more to find a strong dinner pick.</div>
          <div style={{ color: "#475569", maxWidth: 640 }}>
            Your pantry loaded, but there isn&apos;t a clear match yet. Add a few more ingredients to your saved pantry and check again for a stronger recommendation.
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link to="/pantry" style={{ color: "#0f766e", fontWeight: 700 }}>
              Edit Pantry
            </Link>
            <button
              type="button"
              onClick={() => {
                void loadSavedPantry();
              }}
              style={{
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontWeight: 700,
                borderRadius: 10,
                padding: "0.65rem 0.9rem",
                cursor: "pointer",
              }}
            >
              Check Saved Pantry Again
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default HomePage;
