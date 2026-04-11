import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import type { RecommendationEntry } from "../lib/mvpApi";
import { getCookTonightHref, getShoppingHandoffHint, isExternalCookTonightHref } from "../lib/shoppingLinks";
import { trackCtaClicked, trackCtaRendered, trackEvent, trackOutboundLinkOpened } from "../lib/tracking";

type BestOptionActionProps = {
  entry: RecommendationEntry;
  source: string;
  linkDestinationSource: string;
  externalBackground: string;
  internalBackground: string;
  marginTop: string;
  padding: string;
  hintFontSize: string;
  borderRadius: number;
};

function bestActionLabel(entry: RecommendationEntry): string {
  return entry.cta.label;
}

function BestOptionAction({
  entry,
  source,
  linkDestinationSource,
  externalBackground,
  internalBackground,
  marginTop,
  padding,
  hintFontSize,
  borderRadius,
}: BestOptionActionProps) {
  const href = getCookTonightHref(entry);
  const isExternal = isExternalCookTonightHref(href);
  const renderTracked = useRef(false);
  const handoffHint = isExternal ? getShoppingHandoffHint(entry.missing.ingredients) : null;
  const actionStyle = {
    display: "inline-block",
    marginTop,
    padding,
    borderRadius,
    background: isExternal ? externalBackground : internalBackground,
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
      missing_count: entry.missing.count,
    });
  }, [entry.missing.count, entry.recipe.recipe_id, isExternal, source]);

  if (isExternal) {
    return (
      <div style={{ display: "grid", gap: "0.35rem" }}>
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
            void trackEvent("ingredients_requested", {
              recipeId: entry.recipe.recipe_id,
              metadata: {
                source: `${linkDestinationSource}:cta`,
                missing_count: entry.missing.count,
                missing_ingredients: entry.missing.ingredients,
              },
            });
            void trackOutboundLinkOpened(entry.recipe.recipe_id, {
              source: `${source}:cta`,
              href,
              missing_count: entry.missing.count,
              missing_ingredients: entry.missing.ingredients,
            });
          }}
        >
          {bestActionLabel(entry)}
        </a>
        {handoffHint && <div style={{ color: "#64748b", fontSize: hintFontSize }}>{handoffHint}</div>}
      </div>
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
        void trackEvent("recipe_selected", {
          recipeId: entry.recipe.recipe_id,
          metadata: { source: `${linkDestinationSource}:cta` },
        });
      }}
    >
      {bestActionLabel(entry)}
    </Link>
  );
}

export default BestOptionAction;
