import type { RecommendationEntry } from "./mvpApi";

type ShoppingLinkOptions = {
  retailerBaseUrl?: string;
  affiliateParams?: Record<string, string | number | boolean | null | undefined>;
};

const DEFAULT_RETAILER_SEARCH_BASE = "https://www.walmart.com/search";
const DEFAULT_QUERY_PARAM = "q";

function defaultAffiliateParams(): Record<string, string> {
  const params: Record<string, string> = {};
  const campaign = import.meta.env.VITE_AFFILIATE_CAMPAIGN;
  const source = import.meta.env.VITE_AFFILIATE_SOURCE;
  const medium = import.meta.env.VITE_AFFILIATE_MEDIUM;

  if (campaign) params.campaign = campaign;
  if (source) params.source = source;
  if (medium) params.medium = medium;

  return params;
}

export function normalizeShoppingItems(items: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of items) {
    const value = item.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }

  return normalized;
}

export function buildShoppingSearchUrl(items: string[], options: ShoppingLinkOptions = {}): string | null {
  const normalized = normalizeShoppingItems(items);
  if (normalized.length === 0) {
    return null;
  }

  const url = new URL(options.retailerBaseUrl ?? DEFAULT_RETAILER_SEARCH_BASE);
  url.searchParams.set(DEFAULT_QUERY_PARAM, normalized.join(" "));

  const affiliateParams = {
    ...defaultAffiliateParams(),
    ...(options.affiliateParams ?? {}),
  };

  for (const [key, value] of Object.entries(affiliateParams)) {
    if (value === null || value === undefined || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

export function getCookTonightHref(entry: RecommendationEntry, options: ShoppingLinkOptions = {}): string {
  if (entry.cta?.type === "cook_recipe") {
    return entry.cta.internal_path || `/recipes/${entry.recipe.recipe_id}`;
  }

  const shoppingUrl = buildShoppingSearchUrl(entry.cta?.missing_ingredients ?? entry.recipe.missing_ingredients ?? [], options);
  if (shoppingUrl) {
    return shoppingUrl;
  }

  return entry.cta?.internal_path || `/recipes/${entry.recipe.recipe_id}`;
}

export function isExternalCookTonightHref(href: string): boolean {
  return /^https?:\/\//.test(href);
}
