import {
  GENERATED_CANONICAL_INGREDIENTS,
  GENERATED_INGREDIENT_BROWSE_FAMILY_GROUPS,
  GENERATED_INGREDIENT_BROWSE_NODES,
} from "./generatedIngredientTaxonomy";

export const RECIPE_BROWSER_SCOPE_OPTIONS = [
  { id: "cook_now", label: "Cook Now" },
  { id: "almost_there", label: "Almost There" },
  { id: "pantry_stretch", label: "Pantry Stretch" },
  { id: "explore_all", label: "Explore All" },
] as const;

export type RecipeBrowserScopeId = (typeof RECIPE_BROWSER_SCOPE_OPTIONS)[number]["id"];
export type RecipeBrowserProteinBrowseNodeId =
  | "chicken"
  | "beef"
  | "pork"
  | "seafood"
  | "beans_legumes"
  | "tofu_plant_protein"
  | "eggs";

export const RECIPE_BROWSER_FILTER_FAMILY_REGISTRY = [
  { id: "ingredients", label: "Ingredients", enabled: true },
  { id: "cuisine", label: "Cuisine", enabled: true },
  { id: "time", label: "Time", enabled: true },
  { id: "effort", label: "Effort", enabled: false },
  { id: "method", label: "Method", enabled: true },
  { id: "cleanup", label: "Cleanup", enabled: true },
  { id: "diet", label: "Diet", enabled: true },
  { id: "household", label: "Household", enabled: true },
  { id: "cost", label: "Cost", enabled: true },
] as const;

export const INGREDIENT_RECOMMENDATION_ROLLUPS = [
  { id: "chicken", label: "Chicken" },
  { id: "beef", label: "Beef" },
  { id: "pork", label: "Pork" },
  { id: "seafood", label: "Seafood" },
  { id: "plant_protein", label: "Plant protein" },
  { id: "eggs", label: "Eggs" },
  { id: "grains_starches", label: "Grains & starches" },
  { id: "vegetables", label: "Vegetables" },
  { id: "dairy_creamy", label: "Dairy & creamy items" },
  { id: "herbs_spices", label: "Herbs & spices" },
  { id: "sauces_condiments", label: "Sauces & condiments" },
  { id: "oils_fats", label: "Oils & fats" },
  { id: "citrus", label: "Citrus" },
  { id: "regional_sauces_pastes", label: "Regional sauces & pastes" },
] as const;

export type IngredientRecommendationRollupId =
  (typeof INGREDIENT_RECOMMENDATION_ROLLUPS)[number]["id"];

export type QuickStartSection = {
  title: string;
  defaultItems: string[];
  allItems: string[];
};

export function normalizeTaxonomyLookupValue(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/-/g, " ").replace(/_/g, " ").replace(/\s+/g, " ");
  return normalized ? normalized : null;
}

type IngredientVisibility = "browse_and_search" | "search_only";

type CanonicalIngredientDefinition = {
  id: string;
  label: string;
  categoryId: string;
  subcategoryId: string;
  aliases: readonly string[];
  browseNodeIds: readonly string[];
  recommendationRollupIds: readonly string[];
  visibility: IngredientVisibility;
};

function buildNormalizedTermSet(values: readonly string[]): string[] {
  const seenTerms = new Set<string>();
  const normalizedTerms: string[] = [];

  for (const value of values) {
    const normalized = normalizeTaxonomyLookupValue(value);
    if (!normalized || seenTerms.has(normalized)) {
      continue;
    }

    seenTerms.add(normalized);
    normalizedTerms.push(normalized);
  }

  return normalizedTerms;
}

function registerNormalizedLookup<TValue extends string>(
  map: Map<string, TValue>,
  rawValue: string,
  targetValue: TValue,
  context: string,
) {
  const normalizedValue = normalizeTaxonomyLookupValue(rawValue);
  if (!normalizedValue) {
    return;
  }

  const existingValue = map.get(normalizedValue);
  if (existingValue && existingValue !== targetValue) {
    throw new Error(
      `Duplicate normalized taxonomy lookup term "${normalizedValue}" in ${context}. Existing target: ${existingValue}; next target: ${targetValue}.`,
    );
  }

  map.set(normalizedValue, targetValue);
}

function buildIngredientSearchCandidates(
  ingredient: CanonicalIngredientDefinition,
  browseNodeLabel: string,
): IngredientSearchCandidate[] {
  const candidates: IngredientSearchCandidate[] = [
    { value: ingredient.label, matchedOn: "canonical" },
    { value: browseNodeLabel, matchedOn: "browse_node" },
    ...ingredient.aliases.map((alias) => ({ value: alias, matchedOn: "alias" as const })),
  ];

  const seenValues = new Set<string>();

  return candidates.filter((candidate) => {
    const normalizedValue = normalizeTaxonomyLookupValue(candidate.value);
    if (!normalizedValue || seenValues.has(`${candidate.matchedOn}:${normalizedValue}`)) {
      return false;
    }

    seenValues.add(`${candidate.matchedOn}:${normalizedValue}`);
    return true;
  });
}

export const INGREDIENT_BROWSE_NODES = GENERATED_INGREDIENT_BROWSE_NODES;

export type RecipeBrowserIngredientNodeId =
  (typeof INGREDIENT_BROWSE_NODES)[number]["id"];

export type IngredientBrowseNode = (typeof INGREDIENT_BROWSE_NODES)[number];
export type ProteinBrowseNode = Extract<IngredientBrowseNode, { id: RecipeBrowserProteinBrowseNodeId }>;

export const INGREDIENT_BROWSE_FAMILY_GROUPS = GENERATED_INGREDIENT_BROWSE_FAMILY_GROUPS;

function isProteinBrowseNode(node: IngredientBrowseNode): node is ProteinBrowseNode {
  return (
    node.visibleInBrowser &&
    (node.id === "chicken" ||
      node.id === "beef" ||
      node.id === "pork" ||
      node.id === "seafood" ||
      node.id === "beans_legumes" ||
      node.id === "tofu_plant_protein" ||
      node.id === "eggs")
  );
}

export const PROTEIN_BROWSE_NODES = INGREDIENT_BROWSE_NODES.filter(isProteinBrowseNode);

export const CANONICAL_INGREDIENTS = GENERATED_CANONICAL_INGREDIENTS satisfies readonly CanonicalIngredientDefinition[];

export type CanonicalIngredient = (typeof CANONICAL_INGREDIENTS)[number];
export type CanonicalIngredientId = CanonicalIngredient["id"];

export type IngredientBrowseSearchResult = {
  browseNodeId: RecipeBrowserIngredientNodeId;
  browseNodeLabel: string;
  canonicalIngredientId: CanonicalIngredientId;
  label: CanonicalIngredient["label"];
  matchedTerm: string;
  matchedOn: "browse_node" | "canonical" | "alias";
};

type IngredientSearchCandidate = {
  value: string;
  matchedOn: IngredientBrowseSearchResult["matchedOn"];
};

type RankedIngredientBrowseSearchResult = IngredientBrowseSearchResult & {
  candidateRank: number;
};

export const INGREDIENT_BROWSE_NODE_BY_ID = new Map(
  INGREDIENT_BROWSE_NODES.map((node) => [node.id, node] as const),
);

const INGREDIENT_NODE_ALIAS_MAP = new Map<string, RecipeBrowserIngredientNodeId>();
const CANONICAL_INGREDIENT_ALIAS_MAP = new Map<string, CanonicalIngredientId>();

for (const node of INGREDIENT_BROWSE_NODES) {
  registerNormalizedLookup(INGREDIENT_NODE_ALIAS_MAP, node.id, node.id, `browse node ${node.id}`);
  registerNormalizedLookup(INGREDIENT_NODE_ALIAS_MAP, node.label, node.id, `browse node ${node.id}`);
  for (const alias of node.aliases) {
    registerNormalizedLookup(INGREDIENT_NODE_ALIAS_MAP, alias, node.id, `browse node ${node.id}`);
  }
}

for (const ingredient of CANONICAL_INGREDIENTS) {
  registerNormalizedLookup(CANONICAL_INGREDIENT_ALIAS_MAP, ingredient.id, ingredient.id, `ingredient ${ingredient.id}`);
  registerNormalizedLookup(CANONICAL_INGREDIENT_ALIAS_MAP, ingredient.label, ingredient.id, `ingredient ${ingredient.id}`);

  for (const browseNodeId of ingredient.browseNodeIds) {
    registerNormalizedLookup(INGREDIENT_NODE_ALIAS_MAP, ingredient.label, browseNodeId, `ingredient ${ingredient.id}`);
    for (const alias of buildNormalizedTermSet(ingredient.aliases)) {
      registerNormalizedLookup(INGREDIENT_NODE_ALIAS_MAP, alias, browseNodeId, `ingredient ${ingredient.id}`);
    }
  }

  for (const alias of buildNormalizedTermSet(ingredient.aliases)) {
    registerNormalizedLookup(CANONICAL_INGREDIENT_ALIAS_MAP, alias, ingredient.id, `ingredient ${ingredient.id}`);
  }
}

export function normalizeIngredientBrowseNodeId(
  value: string | null | undefined,
): RecipeBrowserIngredientNodeId | null {
  const normalized = normalizeTaxonomyLookupValue(value);
  if (!normalized) {
    return null;
  }

  return INGREDIENT_NODE_ALIAS_MAP.get(normalized) ?? null;
}

export function normalizeCanonicalIngredientId(
  value: string | null | undefined,
): CanonicalIngredientId | null {
  const normalized = normalizeTaxonomyLookupValue(value);
  if (!normalized) {
    return null;
  }

  return CANONICAL_INGREDIENT_ALIAS_MAP.get(normalized) ?? null;
}

function getIngredientSearchCandidateRank(
  candidate: string,
  query: string,
): number {
  if (candidate === query) {
    return 0;
  }

  if (candidate.startsWith(query)) {
    return 1;
  }

  if (candidate.split(" ").some((token) => token.startsWith(query))) {
    return 2;
  }

  return 3;
}

const INGREDIENT_SEARCH_SOURCE_RANK: Record<IngredientBrowseSearchResult["matchedOn"], number> = {
  browse_node: 0,
  canonical: 1,
  alias: 2,
};

export function searchIngredientBrowseNodes(query: string | null | undefined): IngredientBrowseSearchResult[] {
  const normalizedQuery = normalizeTaxonomyLookupValue(query);
  if (!normalizedQuery) {
    return [];
  }

  const results: RankedIngredientBrowseSearchResult[] = [];

  for (const ingredient of CANONICAL_INGREDIENTS) {
    const browseNodeId = ingredient.browseNodeIds.find((candidateBrowseNodeId) =>
      INGREDIENT_BROWSE_NODE_BY_ID.get(candidateBrowseNodeId)?.visibleInBrowser,
    );
    if (!browseNodeId) {
      continue;
    }

    const browseNode = INGREDIENT_BROWSE_NODE_BY_ID.get(browseNodeId);
    if (!browseNode) {
      continue;
    }

    const candidates = buildIngredientSearchCandidates(ingredient, browseNode.label);

    let bestMatch: RankedIngredientBrowseSearchResult | null = null;

    for (const candidate of candidates) {
      const normalizedCandidate = normalizeTaxonomyLookupValue(candidate.value);
      if (!normalizedCandidate || !normalizedCandidate.includes(normalizedQuery)) {
        continue;
      }

      const rankedMatch: RankedIngredientBrowseSearchResult = {
        browseNodeId,
        browseNodeLabel: browseNode.label,
        canonicalIngredientId: ingredient.id,
        label: ingredient.label,
        matchedTerm: candidate.value,
        matchedOn: candidate.matchedOn,
        candidateRank: getIngredientSearchCandidateRank(normalizedCandidate, normalizedQuery),
      };

      if (!bestMatch) {
        bestMatch = rankedMatch;
        continue;
      }

      if (rankedMatch.candidateRank < bestMatch.candidateRank) {
        bestMatch = rankedMatch;
        continue;
      }

      if (
        rankedMatch.candidateRank === bestMatch.candidateRank &&
        INGREDIENT_SEARCH_SOURCE_RANK[rankedMatch.matchedOn] < INGREDIENT_SEARCH_SOURCE_RANK[bestMatch.matchedOn]
      ) {
        bestMatch = rankedMatch;
        continue;
      }

      if (
        rankedMatch.candidateRank === bestMatch.candidateRank &&
        INGREDIENT_SEARCH_SOURCE_RANK[rankedMatch.matchedOn] === INGREDIENT_SEARCH_SOURCE_RANK[bestMatch.matchedOn] &&
        rankedMatch.label.localeCompare(bestMatch.label) < 0
      ) {
        bestMatch = rankedMatch;
      }
    }

    if (bestMatch) {
      results.push(bestMatch);
    }
  }

  results.sort((left, right) => {
    if (left.candidateRank !== right.candidateRank) {
      return left.candidateRank - right.candidateRank;
    }

    if (INGREDIENT_SEARCH_SOURCE_RANK[left.matchedOn] !== INGREDIENT_SEARCH_SOURCE_RANK[right.matchedOn]) {
      return INGREDIENT_SEARCH_SOURCE_RANK[left.matchedOn] - INGREDIENT_SEARCH_SOURCE_RANK[right.matchedOn];
    }

    return left.label.localeCompare(right.label);
  });

  return results.map(({ candidateRank: _candidateRank, ...result }) => result);
}

const QUICK_START_SECTION_CONFIG = [
  {
    title: "Proteins",
    categoryId: "proteins",
    defaultItems: ["chicken", "ground beef", "eggs"],
  },
  {
    title: "Grains & Starches",
    categoryId: "grains_starches",
    defaultItems: ["rice", "pasta", "bread"],
  },
  {
    title: "Dairy & Creamy",
    categoryId: "dairy_creamy",
    defaultItems: ["milk", "butter", "cheese"],
  },
  {
    title: "Vegetables",
    categoryId: "vegetables",
    defaultItems: ["onion", "tomato", "spinach"],
  },
  {
    title: "Herbs & Spices",
    categoryId: "herbs_spices",
    defaultItems: ["salt", "black pepper", "garlic powder"],
  },
  {
    title: "Sauces & Condiments",
    categoryId: "sauces_condiments",
    defaultItems: ["oil", "soy sauce", "tomato sauce"],
  },
] as const;

export function buildQuickStartSections(): QuickStartSection[] {
  return QUICK_START_SECTION_CONFIG.map((section) => {
    const allItems = Array.from(
      new Set(
        CANONICAL_INGREDIENTS.filter((ingredient) => ingredient.categoryId === section.categoryId).map(
          (ingredient) => ingredient.label,
        ),
      ),
    );

    return {
      title: section.title,
      defaultItems: section.defaultItems.filter((item) => allItems.includes(item)),
      allItems,
    };
  });
}

export const QUICK_START_SECTIONS_FROM_TAXONOMY = buildQuickStartSections();

export const QUICK_START_ITEMS_FROM_TAXONOMY = Array.from(
  new Set(QUICK_START_SECTIONS_FROM_TAXONOMY.flatMap((section) => section.allItems)),
);
