import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import RecommendationGroups from "../components/RecommendationGroups";
import { fetchPantry, fetchRecommendations, parsePantryInput, type RecommendationEntry, type RecommendationsResponse } from "../lib/mvpApi";
import { getCookTonightHref, isExternalCookTonightHref } from "../lib/shoppingLinks";
import { trackCtaClicked, trackCtaRendered, trackEvent, trackOutboundLinkOpened } from "../lib/tracking";

function BestOptionAction({ entry }: { entry: RecommendationEntry }) {
  const href = getCookTonightHref(entry);
  const isExternal = isExternalCookTonightHref(href);
  const renderTracked = useRef(false);
  const actionStyle = {
    display: "inline-block",
    marginTop: "0.75rem",
    padding: "0.65rem 1rem",
    borderRadius: 10,
    background: "#166534",
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
      missing_count: entry.recipe.missing_count,
    });
  }, [entry.recipe.missing_count, entry.recipe.recipe_id, isExternal]);

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
              missing_count: entry.recipe.missing_count,
              missing_ingredients: entry.recipe.missing_ingredients,
            },
          });
          void trackOutboundLinkOpened(entry.recipe.recipe_id, {
            source: "home_best_option:cta",
            href,
            missing_count: entry.recipe.missing_count,
            missing_ingredients: entry.recipe.missing_ingredients,
          });
        }}
      >
        Cook This Tonight
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
      Cook This Tonight
    </Link>
  );
}

function HomePage() {
  const [raw, setRaw] = useState("chicken, rice, salt");
  const [result, setResult] = useState<RecommendationsResponse | null>(null);
  const [error, setError] = useState("");
  const [hasPantryItems, setHasPantryItems] = useState(false);
  const [viewedRecommendations, setViewedRecommendations] = useState(false);
  const [cookedOnce, setCookedOnce] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadChecklist = async () => {
      try {
        const data = await fetchPantry();
        setHasPantryItems((data.items ?? []).length > 0);
      } catch {
        setHasPantryItems(false);
      }

      setViewedRecommendations(localStorage.getItem("onboarding_recommendations_viewed") === "1");
      setCookedOnce(localStorage.getItem("onboarding_cooked_recipe") === "1");
    };

    void loadChecklist();
  }, []);

  const completedCount = useMemo(() => {
    return Number(hasPantryItems) + Number(viewedRecommendations) + Number(cookedOnce);
  }, [cookedOnce, hasPantryItems, viewedRecommendations]);

  const bestEntry = useMemo(() => {
    if (!result) return null;
    return result.best_tonight ?? result.cook_now[0] ?? result.almost_there[0] ?? result.not_worth_it[0] ?? null;
  }, [result]);

  const loadRecommendations = async () => {
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const pantry = parsePantryInput(raw);
      const recommendations = await fetchRecommendations(pantry);
      setResult(recommendations);
      setViewedRecommendations(true);
      localStorage.setItem("onboarding_recommendations_viewed", "1");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900 }}>
      <h1>Pantry-to-Recipe</h1>
      <p style={{ color: "#475569", marginTop: "0.35rem", marginBottom: "1rem" }}>
        Decide what to cook tonight from what you already have, then take one clear next step.
      </p>
      <div style={{ marginTop: "1rem", border: "1px solid #e2e8f0", borderRadius: 12, padding: "1rem" }}>
        <h2 style={{ marginTop: 0, marginBottom: "0.4rem" }}>Dinner Decision Checklist</h2>
        <div style={{ color: "#64748b", marginBottom: "0.7rem" }}>{completedCount}/3 complete</div>
        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
          <li style={{ marginBottom: "0.35rem" }}>
            {hasPantryItems ? "Done" : "Todo"}: Add at least one pantry item
          </li>
          <li style={{ marginBottom: "0.35rem" }}>
            {viewedRecommendations ? "Done" : "Todo"}: Review tonight's recommendations
          </li>
          <li>{cookedOnce ? "Done" : "Todo"}: Cook one recipe tonight</li>
        </ul>
      </div>

      <label style={{ display: "block", marginTop: "1rem", fontWeight: 600 }}>
        What is in your pantry tonight?
      </label>

      <input
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        style={{ width: "100%", padding: "0.75rem", fontSize: "1rem", marginTop: "0.5rem" }}
        placeholder="e.g. chicken, rice, salt"
      />

      <button
        onClick={() => {
          void loadRecommendations();
        }}
        style={{ marginTop: "1rem", padding: "0.75rem 1rem" }}
        disabled={loading}
      >
        {loading ? "Loading..." : "See Tonight's Recommendations"}
      </button>

      <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link
          to="/pantry"
          style={{
            display: "inline-block",
            padding: "0.6rem 1rem",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            textDecoration: "none",
            color: "#1f2937",
          }}
        >
          Update Pantry
        </Link>
        <Link
          to="/recommendations"
          style={{
            display: "inline-block",
            padding: "0.6rem 1rem",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            textDecoration: "none",
            color: "#1f2937",
          }}
        >
          Open Tonight's Recommendations
        </Link>
      </div>

      {error && <div style={{ marginTop: "1rem", color: "#b00020", whiteSpace: "pre-wrap" }}>{error}</div>}

      {result && (
        <section style={{ marginTop: "1.5rem", display: "grid", gap: "1rem" }}>
          <div style={{ border: "1px solid #dbe4ef", borderRadius: 14, padding: "1rem", background: "#f0fdf4" }}>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Best Dinner Option Tonight</h2>
            {bestEntry ? (
              <div style={{ marginTop: "0.5rem" }}>
                <Link
                  to={`/recipes/${bestEntry.recipe.recipe_id}`}
                  style={{ fontWeight: 700, color: "#166534" }}
                  onClick={() => {
                    void trackEvent("recipe_selected", {
                      recipeId: bestEntry.recipe.recipe_id,
                      metadata: { source: "home_best_option:title" },
                    });
                  }}
                >
                  {bestEntry.recipe.recipe_name}
                </Link>
                <div style={{ marginTop: "0.35rem", color: "#475569" }}>{bestEntry.explanation}</div>
                <BestOptionAction entry={bestEntry} />
              </div>
            ) : (
              <div style={{ marginTop: "0.5rem", color: "#475569" }}>
                No strong dinner option yet. Check the recommendation groups below.
              </div>
            )}
          </div>

          <RecommendationGroups recommendations={result} />
        </section>
      )}
    </div>
  );
}

export default HomePage;
