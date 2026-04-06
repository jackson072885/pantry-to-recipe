import type { RecommendationEntry } from "./mvpApi";

type ShoppingLinkOptions = {
  retailerBaseUrl?: string;
  affiliateParams?: Record<string, string | number | boolean | null | undefined>;
};

const DEFAULT_RETAILER_SEARCH_BASE = "https://www.walmart.com/search";
const DEFAULT_QUERY_PARAM = "q";
const MAX_QUERY_TERMS = 8;
const DEFAULT_RETAILER_NAME = "Walmart";

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

function cleanShoppingSearchValue(value: string): string {
  return value
    .replace(/\([^)]*\)/g, " ")
    .replace(/[;,/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildShoppingSearchQuery(items: string[], affiliateQuery?: string | null): string | null {
  const normalizedAffiliateQuery = cleanShoppingSearchValue(affiliateQuery ?? "");
  if (normalizedAffiliateQuery) {
    return normalizedAffiliateQuery;
  }

  const normalizedItems = normalizeShoppingItems(items)
    .map(cleanShoppingSearchValue)
    .filter(Boolean)
    .slice(0, MAX_QUERY_TERMS);

  if (normalizedItems.length === 0) {
    return null;
  }

  return normalizedItems.join(" ");
}

export function buildShoppingSearchUrl(items: string[], options: ShoppingLinkOptions = {}): string | null {
  const query = buildShoppingSearchQuery(items);
  if (!query) {
    return null;
  }

  const url = new URL(options.retailerBaseUrl ?? DEFAULT_RETAILER_SEARCH_BASE);
  url.searchParams.set(DEFAULT_QUERY_PARAM, query);

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

  const shoppingQuery = buildShoppingSearchQuery(
    entry.cta?.missing_ingredients ?? entry.recipe.missing_ingredients ?? [],
    entry.cta?.affiliate_query,
  );
  const shoppingUrl = shoppingQuery
    ? buildShoppingSearchUrlFromQuery(shoppingQuery, options)
    : null;
  if (shoppingUrl) {
    return shoppingUrl;
  }

  return entry.cta?.internal_path || `/recipes/${entry.recipe.recipe_id}`;
}

export function isExternalCookTonightHref(href: string): boolean {
  return /^https?:\/\//.test(href);
}

export function getShoppingCtaLabel(missingCount: number, retailerName = DEFAULT_RETAILER_NAME): string {
  if (missingCount <= 0) {
    return "Cook This Tonight";
  }

  return missingCount === 1 ? `Search ${retailerName} for 1 missing ingredient` : `Search ${retailerName} for ${missingCount} missing ingredients`;
}

export function getShoppingHandoffHint(missingItems: string[], retailerName = DEFAULT_RETAILER_NAME): string | null {
  const normalizedItems = normalizeShoppingItems(missingItems);
  if (normalizedItems.length === 0) {
    return null;
  }

  return `Opens a ${retailerName} search in a new tab for ${normalizedItems.join(", ")}.`;
}

function buildShoppingSearchUrlFromQuery(query: string, options: ShoppingLinkOptions = {}): string {
  const url = new URL(options.retailerBaseUrl ?? DEFAULT_RETAILER_SEARCH_BASE);
  url.searchParams.set(DEFAULT_QUERY_PARAM, query);

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
