import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import RecommendationGroups from "../components/RecommendationGroups";
import { fetchPantry, fetchRecommendations, type PantryItem, type RecommendationEntry, type RecommendationsResponse } from "../lib/mvpApi";
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
    background: "#0f172a",
    color: "#ffffff",
    fontWeight: 700,
    textDecoration: "none",
  } as const;

  useEffect(() => {
    if (renderTracked.current) return;
    renderTracked.current = true;
    void trackCtaRendered(entry.recipe.recipe_id, {
      source: "recommendations_best_option",
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
            source: "recommendations_best_option:cta",
            destination: "outbound",
          });
          void trackEvent("ingredients_requested", {
            recipeId: entry.recipe.recipe_id,
            metadata: {
              source: "best_option:cta",
              missing_count: entry.recipe.missing_count,
              missing_ingredients: entry.recipe.missing_ingredients,
            },
          });
          void trackOutboundLinkOpened(entry.recipe.recipe_id, {
            source: "recommendations_best_option:cta",
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
          source: "recommendations_best_option:cta",
          destination: "recipe_detail",
        });
        void trackEvent("recipe_selected", {
          recipeId: entry.recipe.recipe_id,
          metadata: { source: "best_option:cta" },
        });
      }}
    >
      Cook This Tonight
    </Link>
  );
}

function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setError("");
      setLoading(true);

      try {
        const pantry = await fetchPantry();
        setPantryItems(pantry.items ?? []);

        const names = (pantry.items ?? [])
          .map((item) => item.ingredient ?? item.name ?? "")
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0);

        if (names.length === 0) {
          setRecommendations(null);
          return;
        }

        const data = await fetchRecommendations(names);
        setRecommendations(data);
        localStorage.setItem("onboarding_recommendations_viewed", "1");
      } catch (requestError: unknown) {
        setError(requestError instanceof Error ? requestError.message : "Failed to load recommendations.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const bestEntry = useMemo(() => {
    if (!recommendations) return null;
    return (
      recommendations.best_tonight ??
      recommendations.cook_now[0] ??
      recommendations.almost_there[0] ??
      recommendations.not_worth_it[0] ??
      null
    );
  }, [recommendations]);

  return (
    <div className="page-shell">
      <header style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ marginBottom: "0.35rem" }}>Tonight&apos;s Recommendations</h1>
        <p style={{ color: "#64748b", margin: 0 }}>
          These are the fastest dinner decisions from your current pantry, ordered so the most actionable option shows up first.
        </p>
      </header>

      {error && <div style={{ color: "#b91c1c", marginBottom: "1rem" }}>{error}</div>}

      {loading ? (
        <div>Loading tonight&apos;s recommendations...</div>
      ) : pantryItems.length === 0 ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div>Your pantry is empty. Add pantry items first to get tonight&apos;s dinner options.</div>
          <div>
            <Link to="/pantry">Go to Pantry</Link>
          </div>
        </div>
      ) : recommendations ? (
        <div style={{ display: "grid", gap: "1rem" }}>
          <section style={{ border: "1px solid #dbe4ef", borderRadius: 14, padding: "1rem", background: "#f8fafc" }}>
            <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Best Dinner Option Tonight</h2>
            {bestEntry ? (
              <div style={{ marginTop: "0.55rem" }}>
                <Link
                  to={`/recipes/${bestEntry.recipe.recipe_id}`}
                  style={{ fontWeight: 700, color: "#0f172a" }}
                  onClick={() => {
                    void trackEvent("recipe_selected", {
                      recipeId: bestEntry.recipe.recipe_id,
                      metadata: { source: "best_option:title" },
                    });
                  }}
                >
                  {bestEntry.recipe.recipe_name}
                </Link>
                <div style={{ marginTop: "0.3rem", color: "#475569" }}>{bestEntry.explanation}</div>
                <BestOptionAction entry={bestEntry} />
              </div>
            ) : (
              <div style={{ marginTop: "0.55rem", color: "#475569" }}>
                No dinner recommendation is available from the current pantry.
              </div>
            )}
          </section>

          <RecommendationGroups recommendations={recommendations} />
        </div>
      ) : null}
    </div>
  );
}

export default RecommendationsPage;
