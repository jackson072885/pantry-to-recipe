import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import RecommendationGroups from "../components/RecommendationGroups";
import { selectBestDinnerOption } from "../lib/homeRecommendations";
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
  const [loading, setLoading] = useState(false);

  const pantryNames = useMemo(
    () => pantryItems.map((item) => getPantryDisplayName(item)).filter(Boolean),
    [pantryItems],
  );

  const bestEntry = useMemo(() => {
    return selectBestDinnerOption(result);
  }, [result]);

  const alternatives = result?.alternatives ?? [];
  const selectedPantry = useMemo(() => parsePantryInput(raw), [raw]);
  const generatedFrom = result?.generated_from;
  const snapshotPreview = (generatedFrom?.pantry_items ?? pantryNames).slice(0, 8);
  const isWeakResult = bestEntry ? bestEntry.missing.count > 0 || bestEntry.recommendation_type !== "cook_now" : false;
  const pantryCoverage = bestEntry ? Math.round(bestEntry.recipe.pantry_coverage_pct) : null;

  const loadRecommendations = async (pantrySource: string[]) => {
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const recommendations = await fetchRecommendations(pantrySource);
      setResult(recommendations);
      localStorage.setItem("onboarding_recommendations_viewed", "1");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadHome = async () => {
      setError("");
      setLoading(true);

      try {
        const pantry = await fetchPantry();
        const nextItems = pantry.items ?? [];
        setPantryItems(nextItems);

        const names = nextItems
          .map((item) => getPantryDisplayName(item))
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0);

        if (names.length === 0) {
          setResult(null);
          return;
        }

        setRaw(names.join(", "));

        const recommendations = await fetchRecommendations(names);
        setResult(recommendations);
        localStorage.setItem("onboarding_recommendations_viewed", "1");
      } catch (requestError: unknown) {
        setPantryItems([]);
        setResult(null);
        setError(requestError instanceof Error ? requestError.message : "Failed to load tonight's dinner options.");
      } finally {
        setLoading(false);
      }
    };

    void loadHome();
  }, []);

  const runTypedPantry = async () => {
    const nextPantry = parsePantryInput(raw);
    if (nextPantry.length === 0) {
      setError("Add a few pantry items here or update your pantry first.");
      return;
    }
    await loadRecommendations(nextPantry);
  };

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
          Open the app, scan your pantry snapshot, and get one clear best option first. Backup groups stay below if you want a second look.
        </p>

        {error && (
          <div style={{ marginTop: "1rem", color: "#b91c1c", whiteSpace: "pre-wrap", border: "1px solid #fecaca", background: "#fff1f2", borderRadius: 12, padding: "0.8rem" }}>
            {error}
          </div>
        )}
      </section>

      <section style={{ marginTop: "1rem", border: "1px solid #dbe4ef", borderRadius: 20, padding: "1.1rem", background: "#ffffff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Your Pantry Tonight</h2>
            <p style={{ color: "#64748b", margin: "0.3rem 0 0" }}>
              {pantryNames.length > 0
                ? `${pantryNames.length} saved item${pantryNames.length === 1 ? "" : "s"} driving tonight's recommendation run.`
                : "No saved pantry yet. Add a few ingredients so Home can pick a dinner for you immediately."}
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
            Update Pantry
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
            Try a simple starter list like <strong>eggs, rice, onion</strong>.
          </div>
        )}
      </section>

      {loading ? (
        <section style={{ marginTop: "1.4rem", border: "1px solid #dbe4ef", borderRadius: 18, padding: "1rem", color: "#475569", background: "#ffffff" }}>
          Ranking tonight&apos;s options from your saved pantry...
        </section>
      ) : pantryNames.length === 0 ? (
        <section style={{ marginTop: "1.4rem", display: "grid", gap: "0.8rem", border: "1px solid #dbe4ef", borderRadius: 18, padding: "1rem", background: "#ffffff" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "1.08rem" }}>Your pantry is empty.</div>
          <div style={{ color: "#475569", maxWidth: 640 }}>
            Add a few ingredients first and Home will automatically surface the best dinner to cook tonight.
          </div>
          <div>
            <Link to="/pantry" style={{ color: "#0f766e", fontWeight: 700 }}>
              Add pantry items
            </Link>
          </div>
        </section>
      ) : result && bestEntry ? (
        <section style={{ marginTop: "1.5rem", display: "grid", gap: "1rem" }}>
          <div
            style={{
              border: `1px solid ${isWeakResult ? "#fed7aa" : "#bbf7d0"}`,
              borderRadius: 18,
              padding: "1.15rem",
              background: isWeakResult ? "#fff7ed" : "#f0fdf4",
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
            <div style={{ marginTop: "0.55rem" }}>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", alignItems: "center" }}>
                <Link
                  to={`/recipes/${bestEntry.recipe.recipe_id}`}
                  style={{ fontWeight: 700, color: isWeakResult ? "#9a3412" : "#166534", fontSize: "1.3rem" }}
                  onClick={() => {
                    void trackEvent("recipe_selected", {
                      recipeId: bestEntry.recipe.recipe_id,
                      metadata: { source: "home_best_option:title" },
                    });
                  }}
                >
                  {bestEntry.recipe.recipe_name}
                </Link>
                <span
                  style={{
                    borderRadius: 999,
                    padding: "0.18rem 0.55rem",
                    background: bestEntry.missing.count === 0 ? "#dcfce7" : "#ffedd5",
                    color: bestEntry.missing.count === 0 ? "#166534" : "#9a3412",
                    fontWeight: 700,
                    fontSize: "0.8rem",
                  }}
                >
                  {bestEntry.missing.count === 0 ? "Ready now" : `Needs ${bestEntry.missing.count} item${bestEntry.missing.count === 1 ? "" : "s"}`}
                </span>
                {pantryCoverage !== null && (
                  <span style={{ borderRadius: 999, padding: "0.18rem 0.55rem", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: "0.8rem" }}>
                    {pantryCoverage}% pantry coverage
                  </span>
                )}
                {typeof bestEntry.recipe.estimated_time_minutes === "number" && (
                  <span style={{ color: "#475569", fontSize: "0.9rem" }}>{bestEntry.recipe.estimated_time_minutes} min</span>
                )}
              </div>
              <div style={{ marginTop: "0.45rem", color: "#0f172a", fontWeight: 700 }}>
                {bestEntry.why_best ?? (isWeakResult ? "This is the closest fit from your current pantry." : "This is your strongest match for tonight.")}
              </div>
              <div style={{ marginTop: "0.3rem", color: "#475569", maxWidth: 720 }}>{bestEntry.explanation}</div>
              <div style={{ marginTop: "0.45rem", color: "#334155", fontSize: "0.92rem" }}>
                {bestEntry.missing.count === 0 ? "You have what you need to start cooking right away." : bestEntry.missing.summary}
              </div>
              <BestOptionAction entry={bestEntry} />
            </div>
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
      ) : (
        <section style={{ marginTop: "1.4rem", display: "grid", gap: "0.8rem", border: "1px solid #dbe4ef", borderRadius: 18, padding: "1rem", background: "#ffffff" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "1.08rem" }}>No strong dinner pick yet.</div>
          <div style={{ color: "#475569", maxWidth: 640 }}>
            Your pantry loaded, but there isn&apos;t a clear recommendation from the current set of recipes. Try adjusting your pantry or test a one-off list below.
          </div>
        </section>
      )}

      <section style={{ marginTop: "1rem", border: "1px solid #dbe4ef", borderRadius: 20, padding: "1.1rem", background: "#ffffff" }}>
        <h2 style={{ margin: 0, fontSize: "1.02rem" }}>Try a different pantry list</h2>
        <p style={{ color: "#64748b", margin: "0.35rem 0 0.8rem" }}>
          Optional: paste a quick one-off pantry list if you want to test tonight&apos;s options without editing your saved pantry.
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
              void runTypedPantry();
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
            {loading ? "Ranking tonight's options..." : "Try This Pantry"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
