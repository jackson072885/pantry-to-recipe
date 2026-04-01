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
  const missing = entry.missing ?? {
    count: entry.recipe.missing_count,
    ingredients: entry.recipe.missing_ingredients,
    summary: entry.recipe.missing_ingredients.length > 0 ? `Missing: ${entry.recipe.missing_ingredients.join(", ")}` : "",
  };
  void trackEvent("ingredients_requested", {
    recipeId: entry.recipe.recipe_id,
    metadata: {
      source,
      missing_count: missing.count,
      missing_ingredients: missing.ingredients,
    },
  });
}

function ctaLabel(entry: RecommendationEntry): string {
  return entry.cta?.label ?? (entry.recipe.missing_count > 0 ? "Get Missing Ingredients" : "Cook This Tonight");
}

function readinessLabel(entry: RecommendationEntry): string {
  const missingCount = entry.missing?.count ?? entry.recipe.missing_count;
  if (missingCount === 0) return "Ready now";
  if (missingCount === 1) return "Needs 1 item";
  return `Needs ${missingCount} items`;
}

function timeLabel(entry: RecommendationEntry): string | null {
  if (typeof entry.recipe.estimated_time_minutes !== "number") return null;
  return `${entry.recipe.estimated_time_minutes} min`;
}

function metaSummary(entry: RecommendationEntry): string[] {
  const parts: string[] = [];
  if (entry.recipe.servings) parts.push(`${entry.recipe.servings} servings`);
  if (entry.recipe.difficulty) parts.push(entry.recipe.difficulty);
  if (entry.recipe.meal_type) parts.push(entry.recipe.meal_type.replace("_", " "));
  if (typeof entry.recipe.present_required_count === "number" && typeof entry.recipe.required_count === "number") {
    parts.push(`${entry.recipe.present_required_count}/${entry.recipe.required_count} required on hand`);
  }
  return parts;
}

function CookTonightAction({ entry, source }: { entry: RecommendationEntry; source: string }) {
  const href = getCookTonightHref(entry);
  const isExternal = isExternalCookTonightHref(href);
  const missing = entry.missing ?? {
    count: entry.recipe.missing_count,
    ingredients: entry.recipe.missing_ingredients,
    summary: entry.recipe.missing_ingredients.length > 0 ? `Missing: ${entry.recipe.missing_ingredients.join(", ")}` : "",
  };
  const renderTracked = useRef(false);
  const actionStyle = {
    display: "inline-block",
    marginTop: "0.75rem",
    padding: "0.65rem 0.95rem",
    borderRadius: 10,
    background: missing.count > 0 ? "#92400e" : "#0f172a",
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
      missing_count: missing.count,
    });
  }, [entry.recipe.missing_count, entry.recipe.recipe_id, isExternal, missing.count, source]);

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
            missing_count: missing.count,
            missing_ingredients: missing.ingredients,
          });
        }}
      >
        {ctaLabel(entry)}
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
      {ctaLabel(entry)}
    </Link>
  );
}

function GroupSection({
  title,
  subtitle,
  accent,
  source,
  items,
}: {
  title: string;
  subtitle: string;
  accent: string;
  source: string;
  items: RecommendationEntry[];
}) {
  return (
    <section style={{ border: "1px solid #e2e8f0", borderRadius: 18, overflow: "hidden", background: "#ffffff" }}>
      <div style={{ padding: "0.95rem 1rem", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
        <div style={{ fontWeight: 700, color: "#0f172a" }}>{title}</div>
        <div style={{ color: "#64748b", fontSize: "0.92rem", marginTop: "0.15rem" }}>{subtitle}</div>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: "0.95rem 1rem", color: "#64748b" }}>Nothing in this group right now.</div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((entry) => (
            <li
              key={entry.recipe.recipe_id}
              style={{
                display: "grid",
                gridTemplateColumns: "10px 1fr",
                gap: "0.85rem",
                padding: "0.95rem 1rem",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <span style={{ background: accent, borderRadius: 999 }} />
              <div>
                <div style={{ display: "flex", gap: "0.55rem", alignItems: "center", flexWrap: "wrap" }}>
                  <Link
                    to={`/recipes/${entry.recipe.recipe_id}`}
                    style={{ color: "#0f172a", fontWeight: 700 }}
                    onClick={() => {
                      trackRecipeSelected(entry, `${source}:title`);
                    }}
                  >
                    {entry.recipe.recipe_name}
                  </Link>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      borderRadius: 999,
                      padding: "0.18rem 0.55rem",
                      background: "#f8fafc",
                      color: "#334155",
                      border: "1px solid #cbd5e1",
                    }}
                  >
                    {readinessLabel(entry)}
                  </span>
                  <span style={{ color: "#475569", fontSize: "0.88rem" }}>{entry.recipe.pantry_coverage_pct}% pantry match</span>
                  {entry.confidence_label && <span style={{ color: "#475569", fontSize: "0.88rem", textTransform: "capitalize" }}>{entry.confidence_label} confidence</span>}
                  {timeLabel(entry) && <span style={{ color: "#475569", fontSize: "0.88rem" }}>{timeLabel(entry)}</span>}
                </div>
                {entry.recipe.short_description && (
                  <div style={{ marginTop: "0.28rem", color: "#334155", fontSize: "0.92rem" }}>{entry.recipe.short_description}</div>
                )}
                {metaSummary(entry).length > 0 && (
                  <div style={{ marginTop: "0.28rem", color: "#64748b", fontSize: "0.88rem" }}>{metaSummary(entry).join(" • ")}</div>
                )}
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
                  {entry.recipe.is_weeknight_friendly && (
                    <span style={{ borderRadius: 999, padding: "0.12rem 0.5rem", background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#166534", fontSize: "0.8rem" }}>
                      Weeknight-friendly
                    </span>
                  )}
                  {entry.recipe.is_beginner_friendly && (
                    <span style={{ borderRadius: 999, padding: "0.12rem 0.5rem", background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8", fontSize: "0.8rem" }}>
                      Beginner-friendly
                    </span>
                  )}
                  {entry.recipe.quality_bucket === "KEEP_AND_ENRICH" && (
                    <span style={{ borderRadius: 999, padding: "0.12rem 0.5rem", background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", fontSize: "0.8rem" }}>
                      Curated and improving
                    </span>
                  )}
                </div>
                {entry.why_best && <div style={{ marginTop: "0.3rem", color: "#0f172a", fontSize: "0.93rem", fontWeight: 600 }}>{entry.why_best}</div>}
                <div style={{ marginTop: "0.22rem", color: "#475569", fontSize: "0.92rem" }}>{entry.explanation}</div>
                {(entry.missing?.ingredients ?? entry.recipe.missing_ingredients).length > 0 && (
                  <div style={{ marginTop: "0.45rem", color: "#92400e", fontSize: "0.88rem" }}>
                    {entry.missing?.summary ?? `Missing: ${(entry.missing?.ingredients ?? entry.recipe.missing_ingredients).join(", ")}`}
                  </div>
                )}
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
      <GroupSection
        title="Cook Now"
        subtitle="You can cook these straight from your pantry."
        accent="#15803d"
        source="cook_now"
        items={recommendations.cook_now}
      />
      <GroupSection
        title="Almost There"
        subtitle="These are close enough for a fast grocery run."
        accent="#b45309"
        source="almost_there"
        items={recommendations.almost_there}
      />
      <GroupSection
        title="Skip For Tonight"
        subtitle="These need too many items to be the best dinner decision right now."
        accent="#991b1b"
        source="not_worth_it"
        items={recommendations.not_worth_it}
      />
    </div>
  );
}

export default RecommendationGroups;
