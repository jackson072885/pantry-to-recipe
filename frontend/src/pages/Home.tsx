import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import RecommendationGroups from "../components/RecommendationGroups";
import { getPantryDisplayName } from "../lib/pantryDisplay";
import { fetchPantry, fetchRecommendations, parsePantryInput, type PantryItem, type RecommendationEntry, type RecommendationsResponse } from "../lib/mvpApi";
import { getCookTonightHref, isExternalCookTonightHref } from "../lib/shoppingLinks";
import { trackCtaClicked, trackCtaRendered, trackEvent, trackOutboundLinkOpened } from "../lib/tracking";

function bestActionLabel(entry: RecommendationEntry): string {
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
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<RecommendationsResponse | null>(null);
  const [error, setError] = useState("");
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [viewedRecommendations, setViewedRecommendations] = useState(false);
  const [cookedOnce, setCookedOnce] = useState(false);
  const [loading, setLoading] = useState(false);

  const pantryNames = useMemo(
    () => pantryItems.map((item) => getPantryDisplayName(item)).filter(Boolean),
    [pantryItems],
  );

  useEffect(() => {
    const loadChecklist = async () => {
      try {
        const data = await fetchPantry();
        setPantryItems(data.items ?? []);
      } catch {
        setPantryItems([]);
      }

      setViewedRecommendations(localStorage.getItem("onboarding_recommendations_viewed") === "1");
      setCookedOnce(localStorage.getItem("onboarding_cooked_recipe") === "1");
    };

    void loadChecklist();
  }, []);

  const completedCount = useMemo(() => {
    return Number(pantryNames.length > 0) + Number(viewedRecommendations) + Number(cookedOnce);
  }, [cookedOnce, pantryNames.length, viewedRecommendations]);

  const bestEntry = useMemo(() => {
    if (!result) return null;
    return result.best_tonight ?? result.cook_now[0] ?? result.almost_there[0] ?? result.not_worth_it[0] ?? null;
  }, [result]);

  const alternatives = result?.alternatives ?? [];
  const selectedPantry = useMemo(() => parsePantryInput(raw), [raw]);

  const loadRecommendations = async (pantrySource: string[]) => {
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const recommendations = await fetchRecommendations(pantrySource);
      setResult(recommendations);
      setViewedRecommendations(true);
      localStorage.setItem("onboarding_recommendations_viewed", "1");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  const useTypedPantry = async () => {
    const nextPantry = parsePantryInput(raw);
    if (nextPantry.length === 0) {
      setError("Add a few pantry items here or open Pantry to save them first.");
      return;
    }
    await loadRecommendations(nextPantry);
  };

  const useSavedPantry = async () => {
    if (pantryNames.length === 0) {
      setError("Your saved pantry is empty. Add a few items first.");
      return;
    }
    if (!raw.trim()) {
      setRaw(pantryNames.join(", "));
    }
    await loadRecommendations(pantryNames);
  };

  const snapshotPreview = pantryNames.slice(0, 8);

  return (
    <div className="page-shell" style={{ maxWidth: 1100 }}>
      <section
        style={{
          display: "grid",
          gap: "1.5rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          alignItems: "start",
        }}
      >
        <div
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
            What should you cook tonight?
          </h1>
          <p style={{ color: "#475569", margin: 0, fontSize: "1.02rem", maxWidth: 580 }}>
            Start from what you already have, get one clear dinner recommendation first, and keep a couple of realistic backups in view.
          </p>

          <div
            style={{
              marginTop: "1.2rem",
              border: "1px solid #dbe4ef",
              borderRadius: 18,
              padding: "1rem",
              background: "rgba(255,255,255,0.82)",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.08rem" }}>Dinner Decision Checklist</h2>
            <div style={{ color: "#64748b", marginTop: "0.25rem", marginBottom: "0.7rem" }}>{completedCount}/3 complete</div>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#334155" }}>
              <li>{pantryNames.length > 0 ? "Done" : "Todo"}: add pantry items</li>
              <li>{viewedRecommendations ? "Done" : "Todo"}: review tonight&apos;s recommendations</li>
              <li>{cookedOnce ? "Done" : "Todo"}: cook one recipe tonight</li>
            </ul>
          </div>
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          <section style={{ border: "1px solid #dbe4ef", borderRadius: 20, padding: "1.1rem", background: "#ffffff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Your Pantry Tonight</h2>
                <p style={{ color: "#64748b", margin: "0.3rem 0 0" }}>
                  {pantryNames.length > 0
                    ? `${pantryNames.length} saved item${pantryNames.length === 1 ? "" : "s"} ready to use.`
                    : "No saved pantry yet. Paste a quick list here or open Pantry for full editing."}
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
                Open Pantry
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
                {pantryNames.length > snapshotPreview.length && (
                  <span style={{ color: "#64748b", alignSelf: "center", fontSize: "0.88rem" }}>
                    +{pantryNames.length - snapshotPreview.length} more
                  </span>
                )}
              </div>
            ) : (
              <div style={{ marginTop: "0.85rem", color: "#64748b" }}>
                Try a simple starter list like <strong>eggs, rice, onion</strong>.
              </div>
            )}
          </section>

          <section style={{ border: "1px solid #dbe4ef", borderRadius: 20, padding: "1.1rem", background: "#ffffff" }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Get Tonight&apos;s Recommendations</h2>
            <p style={{ color: "#64748b", margin: "0.35rem 0 0.8rem" }}>
              Paste a quick pantry list here, or use your saved pantry to get the best dinner option and grouped backups immediately.
            </p>

            <label style={{ display: "block", fontWeight: 600 }}>What do you already have?</label>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={4}
              style={{ width: "100%", padding: "0.8rem", fontSize: "1rem", marginTop: "0.5rem", borderRadius: 12, border: "1px solid #cbd5e1" }}
              placeholder="e.g. chicken, rice, onion, soy sauce"
            />
            <div style={{ color: "#64748b", fontSize: "0.9rem", marginTop: "0.45rem" }}>
              Use commas or one ingredient per line. {selectedPantry.length > 0 ? `${selectedPantry.length} item${selectedPantry.length === 1 ? "" : "s"} ready.` : ""}
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
              <button
                onClick={() => {
                  void useTypedPantry();
                }}
                style={{
                  padding: "0.8rem 1rem",
                  borderRadius: 12,
                  border: "1px solid #0f766e",
                  background: "#0f766e",
                  color: "#ffffff",
                  fontWeight: 700,
                }}
                disabled={loading}
              >
                {loading ? "Ranking tonight's options..." : "See Tonight's Best Options"}
              </button>
              <button
                onClick={() => {
                  void useSavedPantry();
                }}
                style={{
                  padding: "0.8rem 1rem",
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#0f172a",
                  fontWeight: 600,
                }}
                disabled={loading || pantryNames.length === 0}
              >
                Use Saved Pantry
              </button>
            </div>

            {error && (
              <div style={{ marginTop: "0.9rem", color: "#b91c1c", whiteSpace: "pre-wrap", border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 12, padding: "0.8rem" }}>
                {error}
              </div>
            )}
          </section>
        </div>
      </section>

      {loading && (
        <section style={{ marginTop: "1.4rem", border: "1px solid #dbe4ef", borderRadius: 18, padding: "1rem", color: "#475569", background: "#ffffff" }}>
          Ranking tonight&apos;s options from your pantry...
        </section>
      )}

      {!result && !loading && (
        <section style={{ marginTop: "1.4rem", border: "1px dashed #cbd5e1", borderRadius: 18, padding: "1rem", color: "#475569", background: "rgba(255,255,255,0.55)" }}>
          Your best dinner option will appear here once you generate tonight&apos;s recommendations.
        </section>
      )}

      {result && (
        <section style={{ marginTop: "1.5rem", display: "grid", gap: "1rem" }}>
          <div style={{ border: "1px solid #bbf7d0", borderRadius: 18, padding: "1.15rem", background: "#f0fdf4" }}>
            <div style={{ color: "#166534", fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Best Dinner Option Tonight
            </div>
            {bestEntry ? (
              <div style={{ marginTop: "0.55rem" }}>
                <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", alignItems: "center" }}>
                  <Link
                    to={`/recipes/${bestEntry.recipe.recipe_id}`}
                    style={{ fontWeight: 700, color: "#166534", fontSize: "1.15rem" }}
                    onClick={() => {
                      void trackEvent("recipe_selected", {
                        recipeId: bestEntry.recipe.recipe_id,
                        metadata: { source: "home_best_option:title" },
                      });
                    }}
                  >
                    {bestEntry.recipe.recipe_name}
                  </Link>
                  <span style={{ borderRadius: 999, padding: "0.18rem 0.55rem", background: "#dcfce7", color: "#166534", fontWeight: 700, fontSize: "0.8rem" }}>
                    {bestEntry.missing.count === 0 ? "Ready now" : `Needs ${bestEntry.missing.count} item${bestEntry.missing.count === 1 ? "" : "s"}`}
                  </span>
                  <span style={{ borderRadius: 999, padding: "0.18rem 0.55rem", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: "0.8rem", textTransform: "capitalize" }}>
                    {bestEntry.confidence_label} confidence
                  </span>
                  {typeof bestEntry.recipe.estimated_time_minutes === "number" && (
                    <span style={{ color: "#166534", fontSize: "0.9rem" }}>{bestEntry.recipe.estimated_time_minutes} min</span>
                  )}
                </div>
                <div style={{ marginTop: "0.45rem", color: "#166534", fontWeight: 700 }}>{bestEntry.why_best}</div>
                <div style={{ marginTop: "0.3rem", color: "#475569" }}>{bestEntry.explanation}</div>
                <div style={{ marginTop: "0.45rem", color: "#334155", fontSize: "0.92rem" }}>
                  {bestEntry.missing.count === 0 ? "You can go straight to the recipe and start cooking." : bestEntry.missing.summary}
                </div>
                <BestOptionAction entry={bestEntry} />
              </div>
            ) : (
              <div style={{ marginTop: "0.5rem", color: "#475569" }}>
                No strong dinner option yet. Check the recommendation groups below.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link
              to="/recommendations"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0.7rem 0.95rem",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontWeight: 600,
              }}
            >
              Open Full Recommendations View
            </Link>
            <Link
              to="/pantry"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0.7rem 0.95rem",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontWeight: 600,
              }}
            >
              Update Pantry
            </Link>
          </div>

          {alternatives.length > 0 && (
            <section style={{ border: "1px solid #dbe4ef", borderRadius: 18, padding: "1rem", background: "#ffffff" }}>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>Backup Options</div>
              <div style={{ marginTop: "0.2rem", color: "#64748b", fontSize: "0.92rem" }}>
                These are the next best dinner decisions from the same pantry run.
              </div>
              <div style={{ display: "grid", gap: "0.65rem", marginTop: "0.8rem" }}>
                {alternatives.map((entry) => (
                  <Link key={entry.recipe.recipe_id} to={`/recipes/${entry.recipe.recipe_id}`} style={{ color: "#0f766e", fontWeight: 600 }}>
                    {entry.recipe.recipe_name} · {entry.why_best}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <RecommendationGroups recommendations={result} emptyMessage="No dinner recommendations are available from this pantry yet." />
        </section>
      )}
    </div>
  );
}

export default HomePage;
