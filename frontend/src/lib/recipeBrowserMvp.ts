import {
  CANONICAL_INGREDIENTS,
  INGREDIENT_BROWSE_NODES,
  PROTEIN_BROWSE_NODES,
  normalizeTaxonomyLookupValue,
  normalizeCanonicalIngredientId,
  normalizeIngredientBrowseNodeId,
  type CanonicalIngredientId,
  type RecipeBrowserIngredientNodeId,
  type RecipeBrowserProteinBrowseNodeId,
} from "./recipeTaxonomy";

export const RECIPE_BROWSER_MVP_FILTER_FAMILY_IDS = [
  "ingredients",
  "cuisine",
  "time",
  "difficulty",
  "method",
  "cleanup",
  "diet",
  "protein",
  "household",
  "cost",
] as const;

export type RecipeBrowserMvpFilterFamilyId =
  typeof RECIPE_BROWSER_MVP_FILTER_FAMILY_IDS[number];

export type RecipeBrowserMvpFamilyKind = "ingredient" | "taxonomy" | "flat";
export type RecipeBrowserMvpSelectionMode = "and" | "or";

export type RecipeBrowserMvpIngredientId = CanonicalIngredientId;
export type RecipeBrowserMvpProteinId = RecipeBrowserProteinBrowseNodeId;

export type RecipeBrowserMvpCuisineId =
  | "american"
  | "asian"
  | "bbq"
  | "cuban"
  | "indian"
  | "italian"
  | "latin"
  | "mediterranean"
  | "mediterranean_european"
  | "mexican"
  | "mexican_latin"
  | "southern"
  | "tex_mex";

export type RecipeBrowserMvpTimeBucketId =
  | "15_min"
  | "30_min"
  | "45_min"
  | "45_plus_min";

export type RecipeBrowserMvpDifficultyId = "easy" | "medium";

export type RecipeBrowserMvpMethodId = "skillet" | "stovetop" | "oven";
export type RecipeBrowserMvpCleanupId = "one_pan" | "one_pot" | "sheet_pan" | "multi_pan";
export type RecipeBrowserMvpDietId = "vegetarian";
export type RecipeBrowserMvpHouseholdId = "weeknight" | "meal_prep" | "kid_friendly";
export type RecipeBrowserMvpCostId = "budget" | "moderate";

export type RecipeBrowserMvpFilterValueIdByFamily = {
  ingredients: RecipeBrowserMvpIngredientId;
  protein: RecipeBrowserMvpProteinId;
  cuisine: RecipeBrowserMvpCuisineId;
  time: RecipeBrowserMvpTimeBucketId;
  difficulty: RecipeBrowserMvpDifficultyId;
  method: RecipeBrowserMvpMethodId;
  cleanup: RecipeBrowserMvpCleanupId;
  diet: RecipeBrowserMvpDietId;
  household: RecipeBrowserMvpHouseholdId;
  cost: RecipeBrowserMvpCostId;
};

export type RecipeBrowserMvpFilterValueId =
  RecipeBrowserMvpFilterValueIdByFamily[RecipeBrowserMvpFilterFamilyId];

type RecipeBrowserMvpBaseOption<TId extends string> = {
  id: TId;
  label: string;
};

export type RecipeBrowserMvpIngredientOption =
  RecipeBrowserMvpBaseOption<RecipeBrowserMvpIngredientId> & {
    aliases?: readonly string[];
    browseNodeIds: readonly RecipeBrowserIngredientNodeId[];
    visibility: "browse_and_search" | "search_only";
    source: "canonical_ingredient";
  };

export type RecipeBrowserMvpProteinOption =
  RecipeBrowserMvpBaseOption<RecipeBrowserMvpProteinId> & {
    source: "protein_browse_node";
  };

export type RecipeBrowserMvpTaxonomyOption =
  RecipeBrowserMvpBaseOption<RecipeBrowserMvpCuisineId> & {
    aliases?: readonly string[];
    children?: readonly RecipeBrowserMvpCuisineId[];
    parentId?: RecipeBrowserMvpCuisineId;
  };

type RecipeBrowserMvpFlatOption<TId extends string> = RecipeBrowserMvpBaseOption<TId>;

type RecipeBrowserMvpFilterFamily<
  TId extends RecipeBrowserMvpFilterFamilyId,
  TKind extends RecipeBrowserMvpFamilyKind,
  TOption extends RecipeBrowserMvpBaseOption<string>,
> = {
  id: TId;
  label: string;
  kind: TKind;
  selectionMode: RecipeBrowserMvpSelectionMode;
  description: string;
  supportsHierarchy: boolean;
  options: readonly TOption[];
};

const INGREDIENT_OPTIONS = [
  ...CANONICAL_INGREDIENTS.map((ingredient) => ({
    id: ingredient.id,
    label: ingredient.label,
    source: "canonical_ingredient" as const,
    aliases: ingredient.aliases,
    browseNodeIds: ingredient.browseNodeIds,
    visibility: ingredient.visibility,
  })),
] as const satisfies readonly RecipeBrowserMvpIngredientOption[];

const PROTEIN_OPTIONS = [
  ...PROTEIN_BROWSE_NODES.map((node) => ({
    id: node.id,
    label: node.label,
    source: "protein_browse_node" as const,
  })),
] as const satisfies readonly RecipeBrowserMvpProteinOption[];

const CUISINE_OPTIONS = [
  { id: "american", label: "American", children: ["bbq", "southern"] },
  { id: "mexican_latin", label: "Mexican & Latin", children: ["cuban", "latin", "mexican", "tex_mex"] },
  { id: "asian", label: "Asian", children: ["indian"] },
  { id: "mediterranean_european", label: "Mediterranean & European", children: ["italian", "mediterranean"] },
  { id: "bbq", label: "BBQ", parentId: "american" },
  { id: "cuban", label: "Cuban", parentId: "mexican_latin" },
  { id: "indian", label: "Indian", parentId: "asian" },
  { id: "italian", label: "Italian", parentId: "mediterranean_european" },
  { id: "latin", label: "Latin", parentId: "mexican_latin" },
  { id: "mediterranean", label: "Mediterranean", parentId: "mediterranean_european" },
  { id: "mexican", label: "Mexican", parentId: "mexican_latin" },
  { id: "southern", label: "Southern", parentId: "american" },
  { id: "tex_mex", label: "Tex-Mex", parentId: "mexican_latin", aliases: ["tex mex"] },
] as const satisfies readonly RecipeBrowserMvpTaxonomyOption[];

export const RECIPE_BROWSER_MVP_CUISINE_GROUPS = [
  {
    id: "american",
    label: "American",
    childIds: ["bbq", "southern"],
  },
  {
    id: "mexican_latin",
    label: "Mexican & Latin",
    childIds: ["cuban", "latin", "mexican", "tex_mex"],
  },
  {
    id: "asian",
    label: "Asian",
    childIds: ["indian"],
  },
  {
    id: "mediterranean_european",
    label: "Mediterranean & European",
    childIds: ["italian", "mediterranean"],
  },
] as const satisfies readonly {
  id: RecipeBrowserMvpCuisineId;
  label: string;
  childIds: readonly RecipeBrowserMvpCuisineId[];
}[];

const TIME_OPTIONS = [
  { id: "15_min", label: "15 min" },
  { id: "30_min", label: "30 min" },
  { id: "45_min", label: "45 min" },
  { id: "45_plus_min", label: "45+ min" },
] as const satisfies readonly RecipeBrowserMvpFlatOption<RecipeBrowserMvpTimeBucketId>[];

const DIFFICULTY_OPTIONS = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
] as const satisfies readonly RecipeBrowserMvpFlatOption<RecipeBrowserMvpDifficultyId>[];

const METHOD_OPTIONS = [
  { id: "skillet", label: "Skillet" },
  { id: "stovetop", label: "Stovetop" },
  { id: "oven", label: "Oven" },
] as const satisfies readonly RecipeBrowserMvpFlatOption<RecipeBrowserMvpMethodId>[];

const CLEANUP_OPTIONS = [
  { id: "one_pan", label: "One Pan" },
  { id: "one_pot", label: "One Pot" },
  { id: "sheet_pan", label: "Sheet Pan" },
  { id: "multi_pan", label: "Multi Pan" },
] as const satisfies readonly RecipeBrowserMvpFlatOption<RecipeBrowserMvpCleanupId>[];

const DIET_OPTIONS = [
  { id: "vegetarian", label: "Vegetarian" },
] as const satisfies readonly RecipeBrowserMvpFlatOption<RecipeBrowserMvpDietId>[];

const HOUSEHOLD_OPTIONS = [
  { id: "weeknight", label: "Weeknight" },
  { id: "meal_prep", label: "Meal Prep" },
  { id: "kid_friendly", label: "Kid-Friendly" },
] as const satisfies readonly RecipeBrowserMvpFlatOption<RecipeBrowserMvpHouseholdId>[];

const COST_OPTIONS = [
  { id: "budget", label: "Budget" },
  { id: "moderate", label: "Moderate" },
] as const satisfies readonly RecipeBrowserMvpFlatOption<RecipeBrowserMvpCostId>[];

export const RECIPE_BROWSER_MVP_FILTERS = {
  ingredients: {
    id: "ingredients",
    label: "Ingredients",
    kind: "ingredient",
    selectionMode: "and",
    description: "Ingredient filters require every selected token to be present on the recipe.",
    supportsHierarchy: false,
    options: INGREDIENT_OPTIONS,
  },
  protein: {
    id: "protein",
    label: "Protein",
    kind: "flat",
    selectionMode: "or",
    description: "Protein browse options match the recipe's supported protein browse nodes without implying a full nutrition model.",
    supportsHierarchy: false,
    options: PROTEIN_OPTIONS,
  },
  cuisine: {
    id: "cuisine",
    label: "Cuisine",
    kind: "taxonomy",
    selectionMode: "or",
    description: "Cuisine selections match the chosen branch or any descendant inside that branch.",
    supportsHierarchy: true,
    options: CUISINE_OPTIONS,
  },
  time: {
    id: "time",
    label: "Time",
    kind: "flat",
    selectionMode: "or",
    description: "Time options stay flat and match any selected bucket.",
    supportsHierarchy: false,
    options: TIME_OPTIONS,
  },
  difficulty: {
    id: "difficulty",
    label: "Difficulty",
    kind: "flat",
    selectionMode: "or",
    description: "Difficulty options stay flat and match any selected value.",
    supportsHierarchy: false,
    options: DIFFICULTY_OPTIONS,
  },
  method: {
    id: "method",
    label: "Method",
    kind: "flat",
    selectionMode: "or",
    description: "Method options stay flat and match any selected value.",
    supportsHierarchy: false,
    options: METHOD_OPTIONS,
  },
  cleanup: {
    id: "cleanup",
    label: "Cleanup",
    kind: "flat",
    selectionMode: "or",
    description: "Cleanup options reflect the recipe's current coarse cleanup tag and do not imply precise cookware or dish-count prediction.",
    supportsHierarchy: false,
    options: CLEANUP_OPTIONS,
  },
  diet: {
    id: "diet",
    label: "Diet",
    kind: "flat",
    selectionMode: "or",
    description: "Diet options only expose explicit dataset-backed labels that are present on the recipe and stay intentionally conservative.",
    supportsHierarchy: false,
    options: DIET_OPTIONS,
  },
  household: {
    id: "household",
    label: "Household",
    kind: "flat",
    selectionMode: "or",
    description: "Household options only expose explicit weeknight, meal-prep, and kid-friendly recipe signals that already exist on the recipe metadata.",
    supportsHierarchy: false,
    options: HOUSEHOLD_OPTIONS,
  },
  cost: {
    id: "cost",
    label: "Cost",
    kind: "flat",
    selectionMode: "or",
    description: "Cost options reflect the recipe's current dataset-backed cost tag without implying precise pricing.",
    supportsHierarchy: false,
    options: COST_OPTIONS,
  },
} as const satisfies {
  ingredients: RecipeBrowserMvpFilterFamily<"ingredients", "ingredient", RecipeBrowserMvpIngredientOption>;
  protein: RecipeBrowserMvpFilterFamily<"protein", "flat", RecipeBrowserMvpProteinOption>;
  cuisine: RecipeBrowserMvpFilterFamily<"cuisine", "taxonomy", RecipeBrowserMvpTaxonomyOption>;
  time: RecipeBrowserMvpFilterFamily<"time", "flat", RecipeBrowserMvpFlatOption<RecipeBrowserMvpTimeBucketId>>;
  difficulty: RecipeBrowserMvpFilterFamily<"difficulty", "flat", RecipeBrowserMvpFlatOption<RecipeBrowserMvpDifficultyId>>;
  method: RecipeBrowserMvpFilterFamily<"method", "flat", RecipeBrowserMvpFlatOption<RecipeBrowserMvpMethodId>>;
  cleanup: RecipeBrowserMvpFilterFamily<"cleanup", "flat", RecipeBrowserMvpFlatOption<RecipeBrowserMvpCleanupId>>;
  diet: RecipeBrowserMvpFilterFamily<"diet", "flat", RecipeBrowserMvpFlatOption<RecipeBrowserMvpDietId>>;
  household: RecipeBrowserMvpFilterFamily<"household", "flat", RecipeBrowserMvpFlatOption<RecipeBrowserMvpHouseholdId>>;
  cost: RecipeBrowserMvpFilterFamily<"cost", "flat", RecipeBrowserMvpFlatOption<RecipeBrowserMvpCostId>>;
};

export const RECIPE_BROWSER_MVP_FILTER_ORDER = RECIPE_BROWSER_MVP_FILTER_FAMILY_IDS.map(
  (familyId) => RECIPE_BROWSER_MVP_FILTERS[familyId],
);

export const RECIPE_BROWSER_MVP_INGREDIENT_GROUPS = INGREDIENT_BROWSE_NODES.filter((node) => node.visibleInBrowser);

export function getRecipeBrowserIngredientOptionsForBrowseNode(
  browseNodeId: RecipeBrowserIngredientNodeId,
): RecipeBrowserMvpIngredientOption[] {
  return INGREDIENT_OPTIONS.filter(
    (option) =>
      option.browseNodeIds.some((optionBrowseNodeId) => optionBrowseNodeId === browseNodeId) &&
      option.visibility === "browse_and_search",
  );
}

export const RECIPE_BROWSER_MVP_TIME_BUCKET_RULES = {
  "15_min": {
    maxTotalTimeMinutes: 15,
    description: "Includes recipes with total_time_minutes up to and including 15.",
  },
  "30_min": {
    minTotalTimeMinutes: 16,
    maxTotalTimeMinutes: 30,
    description: "Includes recipes with total_time_minutes from 16 through 30.",
  },
  "45_min": {
    minTotalTimeMinutes: 31,
    maxTotalTimeMinutes: 45,
    description: "Includes recipes with total_time_minutes from 31 through 45.",
  },
  "45_plus_min": {
    minTotalTimeMinutes: 46,
    description: "Includes recipes with total_time_minutes of 46 or more.",
  },
} as const satisfies Record<
  RecipeBrowserMvpTimeBucketId,
  {
    description: string;
    minTotalTimeMinutes?: number;
    maxTotalTimeMinutes?: number;
  }
>;

const INGREDIENT_TOKEN_ALIAS_MAP = new Map<string, RecipeBrowserMvpIngredientId>();
const CUISINE_ALIAS_MAP = new Map<string, RecipeBrowserMvpCuisineId>();
const CUISINE_PARENT_BY_ID = new Map<RecipeBrowserMvpCuisineId, RecipeBrowserMvpCuisineId | null>();

function registerNormalizedMvpLookup<TValue extends string>(
  map: Map<string, TValue>,
  rawValue: string,
  targetValue: TValue,
) {
  const normalizedValue = normalizeTaxonomyLookupValue(rawValue);
  if (!normalizedValue) {
    return;
  }

  map.set(normalizedValue, targetValue);
}

for (const option of INGREDIENT_OPTIONS as readonly RecipeBrowserMvpIngredientOption[]) {
  registerNormalizedMvpLookup(INGREDIENT_TOKEN_ALIAS_MAP, option.id, option.id);
  registerNormalizedMvpLookup(INGREDIENT_TOKEN_ALIAS_MAP, option.label, option.id);
  option.aliases?.forEach((alias: string) => registerNormalizedMvpLookup(INGREDIENT_TOKEN_ALIAS_MAP, alias, option.id));
}

for (const option of CUISINE_OPTIONS as readonly RecipeBrowserMvpTaxonomyOption[]) {
  registerNormalizedMvpLookup(CUISINE_ALIAS_MAP, option.id, option.id);
  registerNormalizedMvpLookup(CUISINE_ALIAS_MAP, option.label, option.id);
  option.aliases?.forEach((alias: string) => registerNormalizedMvpLookup(CUISINE_ALIAS_MAP, alias, option.id));
  CUISINE_PARENT_BY_ID.set(option.id, option.parentId ?? null);
}

export function getRecipeBrowserCuisineRootId(
  cuisineId: RecipeBrowserMvpCuisineId,
): RecipeBrowserMvpCuisineId {
  let currentId: RecipeBrowserMvpCuisineId = cuisineId;
  let parentId = CUISINE_PARENT_BY_ID.get(currentId) ?? null;

  while (parentId) {
    currentId = parentId;
    parentId = CUISINE_PARENT_BY_ID.get(currentId) ?? null;
  }

  return currentId;
}

const PRIMARY_PROTEIN_TO_INGREDIENT_MAP: Readonly<Record<string, RecipeBrowserMvpIngredientId>> = {
  chicken: "chicken",
  "chicken breast": "chicken_breast",
  "chicken breasts": "chicken_breast",
  "chicken thighs": "chicken_thighs",
  "chicken thigh": "chicken_thighs",
  turkey: "turkey",
  "ground turkey": "ground_turkey",
  beef: "beef",
  "ground beef": "ground_beef",
  steak: "steak",
  "beef steak": "steak",
  pork: "pork",
  "pork chop": "pork_chops",
  "pork chops": "pork_chops",
  bacon: "pork",
  ham: "pork",
  sausage: "pork",
  fish: "seafood",
  salmon: "seafood",
  shrimp: "shrimp",
  tuna: "seafood",
  cod: "cod",
  tilapia: "tilapia",
  "white fish": "white_fish",
  tofu: "tofu",
  eggs: "eggs",
  egg: "eggs",
  beans: "beans",
  lentils: "lentils",
} as const;

export function normalizeRecipeBrowserProteinId(
  value: string | null | undefined,
): RecipeBrowserMvpProteinId | null {
  const normalized = normalizeIngredientBrowseNodeId(value);
  if (
    normalized &&
    RECIPE_BROWSER_MVP_FILTERS.protein.options.some((option) => option.id === normalized)
  ) {
    return normalized as RecipeBrowserMvpProteinId;
  }

  return null;
}

export const RECIPE_BROWSER_MVP_DEFERRED = {
  ingredientTokens: [
    "vegetarian",
    "mixed_protein",
    "vegan",
  ],
  ingredientInputs: [
    "unknown",
    "missing_primary_protein",
  ],
  methods: [
    "no_cook",
    "air_fryer",
    "slow_cooker",
    "instant_pot",
    "sheet_pan",
    "one_pot",
    "grilled",
  ],
  difficulties: [
    "advanced",
    "hard",
    "beginner",
  ],
  timeBuckets: [
    "1_hour_plus",
  ],
} as const;

function normalizeLookupValue(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, " ");
  return normalized ? normalized : null;
}

export function deriveRecipeBrowserTimeBucket(
  totalTimeMinutes: number | null | undefined,
): RecipeBrowserMvpTimeBucketId | null {
  if (typeof totalTimeMinutes !== "number" || !Number.isFinite(totalTimeMinutes) || totalTimeMinutes <= 0) {
    return null;
  }

  if (totalTimeMinutes <= RECIPE_BROWSER_MVP_TIME_BUCKET_RULES["15_min"].maxTotalTimeMinutes) {
    return "15_min";
  }

  if (totalTimeMinutes <= RECIPE_BROWSER_MVP_TIME_BUCKET_RULES["30_min"].maxTotalTimeMinutes) {
    return "30_min";
  }

  if (totalTimeMinutes <= RECIPE_BROWSER_MVP_TIME_BUCKET_RULES["45_min"].maxTotalTimeMinutes) {
    return "45_min";
  }

  return "45_plus_min";
}

export function normalizeRecipeBrowserPrimaryProteinIngredient(
  primaryProtein: string | null | undefined,
): RecipeBrowserMvpIngredientId | null {
  const normalized = normalizeLookupValue(primaryProtein);
  if (!normalized) {
    return null;
  }

  return PRIMARY_PROTEIN_TO_INGREDIENT_MAP[normalized] ?? null;
}

export function normalizeRecipeBrowserIngredientToken(
  ingredient: string | null | undefined,
): RecipeBrowserMvpIngredientId | null {
  const normalized = normalizeCanonicalIngredientId(ingredient);
  if (normalized) {
    return normalized;
  }

  const normalizedLookup = normalizeLookupValue(ingredient);
  if (!normalizedLookup) {
    return null;
  }

  return INGREDIENT_TOKEN_ALIAS_MAP.get(normalizedLookup) ?? normalizeRecipeBrowserPrimaryProteinIngredient(normalizedLookup);
}

export function normalizeRecipeBrowserCuisineId(
  cuisine: string | null | undefined,
): RecipeBrowserMvpCuisineId | null {
  const normalized = normalizeLookupValue(cuisine);
  if (!normalized) {
    return null;
  }

  const directMatch = CUISINE_ALIAS_MAP.get(normalized);
  if (directMatch) {
    return directMatch;
  }

  return CUISINE_ALIAS_MAP.get(normalized.replace(/_/g, " ")) ?? null;
}

export function deriveRecipeBrowserCuisinePath(
  cuisine: string | null | undefined,
): RecipeBrowserMvpCuisineId[] | null {
  const normalizedId = normalizeRecipeBrowserCuisineId(cuisine);
  if (!normalizedId) {
    return null;
  }

  const path: RecipeBrowserMvpCuisineId[] = [];
  let currentId: RecipeBrowserMvpCuisineId | null = normalizedId;

  while (currentId) {
    path.unshift(currentId);
    currentId = CUISINE_PARENT_BY_ID.get(currentId) ?? null;
  }

  return path;
}

export function normalizeRecipeBrowserCostId(
  tags: readonly string[] | null | undefined,
): RecipeBrowserMvpCostId | null {
  if (!tags || tags.length === 0) {
    return null;
  }

  const normalizedTags = tags
    .map((tag) => normalizeLookupValue(tag))
    .filter((tag): tag is string => Boolean(tag));

  if (
    normalizedTags.includes("budget") ||
    normalizedTags.includes("budget friendly") ||
    normalizedTags.includes("budget_friendly")
  ) {
    return "budget";
  }

  if (normalizedTags.includes("moderate")) {
    return "moderate";
  }

  return null;
}

export function normalizeRecipeBrowserCleanupId(
  tags: readonly string[] | null | undefined,
): RecipeBrowserMvpCleanupId | null {
  if (!tags || tags.length === 0) {
    return null;
  }

  const normalizedTags = tags
    .map((tag) => normalizeLookupValue(tag))
    .filter((tag): tag is string => Boolean(tag));

  if (normalizedTags.includes("one_pan")) {
    return "one_pan";
  }

  if (normalizedTags.includes("one_pot")) {
    return "one_pot";
  }

  if (normalizedTags.includes("sheet_pan")) {
    return "sheet_pan";
  }

  if (normalizedTags.includes("multi_pan")) {
    return "multi_pan";
  }

  return null;
}

export function normalizeRecipeBrowserDietIds(
  tags: readonly string[] | null | undefined,
): RecipeBrowserMvpDietId[] {
  if (!tags || tags.length === 0) {
    return [];
  }

  const normalizedTags = tags
    .map((tag) => normalizeLookupValue(tag))
    .filter((tag): tag is string => Boolean(tag));

  return normalizedTags.includes("vegetarian") ? ["vegetarian"] : [];
}

export function normalizeRecipeBrowserHouseholdIds(
  tags: readonly string[] | null | undefined,
  isWeeknightFriendly?: boolean | null,
): RecipeBrowserMvpHouseholdId[] {
  const normalizedTags = (tags ?? [])
    .map((tag) => normalizeLookupValue(tag))
    .filter((tag): tag is string => Boolean(tag));
  const householdIds = new Set<RecipeBrowserMvpHouseholdId>();

  if (isWeeknightFriendly || normalizedTags.includes("weeknight")) {
    householdIds.add("weeknight");
  }

  if (normalizedTags.includes("meal_prep")) {
    householdIds.add("meal_prep");
  }

  if (normalizedTags.includes("kid_friendly")) {
    householdIds.add("kid_friendly");
  }

  return Array.from(householdIds);
}
