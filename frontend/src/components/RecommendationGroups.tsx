import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { RecommendationEntry, RecommendationsResponse } from "../lib/mvpApi";
import { getCookTonightHref, isExternalCookTonightHref } from "../lib/shoppingLinks";
import { trackCtaClicked, trackCtaRendered, trackEvent, trackOutboundLinkOpened } from "../lib/tracking";

type RecommendationGroupsProps = {
  recommendations: RecommendationsResponse;
  emptyMessage?: string;
};

function trackRecipeSelected(entry: RecommendationEntry, source: string) {
  void trackEvent("recipe_selected", {
    recipeId: entry.recipe.recipe_id,
    metadata: { source },
  });
}

function trackIngredientsRequested(entry: RecommendationEntry, source: string) {
  void trackEvent("ingredients_requested", {
    recipeId: entry.recipe.recipe_id,
    metadata: {
      source,
      missing_count: entry.recipe.missing_count,
      missing_ingredients: entry.recipe.missing_ingredients,
    },
  });
}

function CookTonightAction({ entry, source }: { entry: RecommendationEntry; source: string }) {
  const href = getCookTonightHref(entry);
  const isExternal = isExternalCookTonightHref(href);
  const renderTracked = useRef(false);
  const actionStyle = {
    display: "inline-block",
    marginTop: "0.75rem",
    padding: "0.55rem 0.9rem",
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
      source,
      destination: isExternal ? "outbound" : "recipe_detail",
      missing_count: entry.recipe.missing_count,
    });
  }, [entry.recipe.missing_count, entry.recipe.recipe_id, isExternal, source]);

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        style={actionStyle}
        onClick={() => {
          void trackCtaClicked(entry.recipe.recipe_id, {
            source: `${source}:cta`,
            destination: "outbound",
          });
          trackIngredientsRequested(entry, `${source}:cta`);
          void trackOutboundLinkOpened(entry.recipe.recipe_id, {
            source: `${source}:cta`,
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
          source: `${source}:cta`,
          destination: "recipe_detail",
        });
        trackRecipeSelected(entry, `${source}:cta`);
      }}
    >
      Cook This Tonight
    </Link>
  );
}

function GroupSection({
  title,
  accent,
  source,
  items,
}: {
  title: string;
  accent: string;
  source: string;
  items: RecommendationEntry[];
}) {
  return (
    <section style={{ border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", background: "#ffffff" }}>
      <div style={{ padding: "0.8rem 1rem", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
        <strong>{title}</strong> <span style={{ color: "#64748b" }}>({items.length})</span>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: "0.9rem 1rem", color: "#64748b" }}>No recipes in this group.</div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((entry) => (
            <li
              key={entry.recipe.recipe_id}
              style={{
                display: "grid",
                gridTemplateColumns: "8px 1fr",
                gap: "0.8rem",
                padding: "0.85rem 1rem",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <span style={{ background: accent, borderRadius: 999 }} />
              <div>
                <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
                  <Link
                    to={`/recipes/${entry.recipe.recipe_id}`}
                    style={{ color: "#0f172a", fontWeight: 700 }}
                    onClick={() => {
                      trackRecipeSelected(entry, `${source}:title`);
                    }}
                  >
                    {entry.recipe.recipe_name}
                  </Link>
                  <span style={{ color: "#475569", fontSize: "0.88rem" }}>
                    {entry.recipe.pantry_coverage_pct}% pantry match
                  </span>
                  {entry.recipe.missing_count > 0 && (
                    <span
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        border: "1px solid #cbd5e1",
                        borderRadius: 999,
                        padding: "0.15rem 0.5rem",
                        color: "#475569",
                        background: "#ffffff",
                      }}
                    >
                      Missing {entry.recipe.missing_count}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: "0.3rem", color: "#475569", fontSize: "0.92rem" }}>{entry.explanation}</div>
                <CookTonightAction entry={entry} source={source} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecommendationGroups({
  recommendations,
  emptyMessage = "No recommendations yet.",
}: RecommendationGroupsProps) {
  const hasAnyItems =
    recommendations.cook_now.length > 0 ||
    recommendations.almost_there.length > 0 ||
    recommendations.not_worth_it.length > 0;

  if (!hasAnyItems) {
    return <div style={{ color: "#64748b" }}>{emptyMessage}</div>;
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <GroupSection title="Cook Tonight" accent="#15803d" source="cook_now" items={recommendations.cook_now} />
      <GroupSection title="One Quick Store Stop" accent="#b45309" source="almost_there" items={recommendations.almost_there} />
      <GroupSection title="Skip Tonight" accent="#991b1b" source="not_worth_it" items={recommendations.not_worth_it} />
    </div>
  );
}

export default RecommendationGroups;
