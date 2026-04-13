export const RECIPE_BROWSER_MVP_FILTER_FAMILY_IDS = [
  "ingredients",
  "cuisine",
  "time",
  "difficulty",
  "method",
] as const;

export type RecipeBrowserMvpFilterFamilyId =
  typeof RECIPE_BROWSER_MVP_FILTER_FAMILY_IDS[number];

export type RecipeBrowserMvpFamilyKind = "ingredient" | "taxonomy" | "flat";
export type RecipeBrowserMvpSelectionMode = "and" | "or";

export type RecipeBrowserMvpIngredientId =
  | "chicken"
  | "beef"
  | "pork"
  | "turkey"
  | "seafood"
  | "tofu"
  | "garlic"
  | "cumin"
  | "green_beans"
  | "pasta";

export type RecipeBrowserMvpCuisineId =
  | "american"
  | "asian"
  | "bbq"
  | "cuban"
  | "indian"
  | "italian"
  | "latin"
  | "mediterranean"
  | "mexican"
  | "southern"
  | "tex_mex";

export type RecipeBrowserMvpTimeBucketId =
  | "15_min"
  | "30_min"
  | "45_min"
  | "45_plus_min";

export type RecipeBrowserMvpDifficultyId = "easy" | "medium";

export type RecipeBrowserMvpMethodId = "skillet" | "stovetop" | "oven";

export type RecipeBrowserMvpFilterValueIdByFamily = {
  ingredients: RecipeBrowserMvpIngredientId;
  cuisine: RecipeBrowserMvpCuisineId;
  time: RecipeBrowserMvpTimeBucketId;
  difficulty: RecipeBrowserMvpDifficultyId;
  method: RecipeBrowserMvpMethodId;
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
    source: "recipe_ingredient" | "derived_from_primary_protein";
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
  { id: "chicken", label: "Chicken", source: "derived_from_primary_protein" },
  { id: "beef", label: "Beef", source: "derived_from_primary_protein" },
  { id: "pork", label: "Pork", source: "derived_from_primary_protein" },
  { id: "turkey", label: "Turkey", source: "derived_from_primary_protein" },
  { id: "seafood", label: "Seafood", source: "derived_from_primary_protein" },
  { id: "tofu", label: "Tofu", source: "derived_from_primary_protein" },
  { id: "garlic", label: "Garlic", source: "recipe_ingredient" },
  { id: "cumin", label: "Cumin", source: "recipe_ingredient" },
  { id: "green_beans", label: "Green Beans", source: "recipe_ingredient", aliases: ["green beans", "string beans"] },
  { id: "pasta", label: "Pasta", source: "recipe_ingredient", aliases: ["spaghetti", "linguine", "penne"] },
] as const satisfies readonly RecipeBrowserMvpIngredientOption[];

const CUISINE_OPTIONS = [
  { id: "american", label: "American" },
  { id: "asian", label: "Asian" },
  { id: "bbq", label: "BBQ" },
  { id: "cuban", label: "Cuban", parentId: "latin" },
  { id: "indian", label: "Indian" },
  { id: "italian", label: "Italian" },
  { id: "latin", label: "Latin", children: ["cuban", "mexican", "tex_mex"] },
  { id: "mediterranean", label: "Mediterranean" },
  { id: "mexican", label: "Mexican", parentId: "latin" },
  { id: "southern", label: "Southern" },
  { id: "tex_mex", label: "Tex-Mex", parentId: "latin", aliases: ["tex mex"] },
] as const satisfies readonly RecipeBrowserMvpTaxonomyOption[];

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
} as const satisfies {
  ingredients: RecipeBrowserMvpFilterFamily<"ingredients", "ingredient", RecipeBrowserMvpIngredientOption>;
  cuisine: RecipeBrowserMvpFilterFamily<"cuisine", "taxonomy", RecipeBrowserMvpTaxonomyOption>;
  time: RecipeBrowserMvpFilterFamily<"time", "flat", RecipeBrowserMvpFlatOption<RecipeBrowserMvpTimeBucketId>>;
  difficulty: RecipeBrowserMvpFilterFamily<"difficulty", "flat", RecipeBrowserMvpFlatOption<RecipeBrowserMvpDifficultyId>>;
  method: RecipeBrowserMvpFilterFamily<"method", "flat", RecipeBrowserMvpFlatOption<RecipeBrowserMvpMethodId>>;
};

export const RECIPE_BROWSER_MVP_FILTER_ORDER = RECIPE_BROWSER_MVP_FILTER_FAMILY_IDS.map(
  (familyId) => RECIPE_BROWSER_MVP_FILTERS[familyId],
);

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

for (const option of INGREDIENT_OPTIONS as readonly RecipeBrowserMvpIngredientOption[]) {
  INGREDIENT_TOKEN_ALIAS_MAP.set(option.id, option.id);
  option.aliases?.forEach((alias: string) => INGREDIENT_TOKEN_ALIAS_MAP.set(alias, option.id));
}

for (const option of CUISINE_OPTIONS as readonly RecipeBrowserMvpTaxonomyOption[]) {
  CUISINE_ALIAS_MAP.set(option.id, option.id);
  option.aliases?.forEach((alias: string) => CUISINE_ALIAS_MAP.set(alias, option.id));
  CUISINE_PARENT_BY_ID.set(option.id, option.parentId ?? null);
}

const PRIMARY_PROTEIN_TO_INGREDIENT_MAP: Readonly<Record<string, RecipeBrowserMvpIngredientId>> = {
  chicken: "chicken",
  beef: "beef",
  "ground beef": "beef",
  pork: "pork",
  bacon: "pork",
  ham: "pork",
  sausage: "pork",
  "ground turkey": "turkey",
  turkey: "turkey",
  fish: "seafood",
  salmon: "seafood",
  shrimp: "seafood",
  tuna: "seafood",
  cod: "seafood",
  tilapia: "seafood",
  catfish: "seafood",
  bass: "seafood",
  tofu: "tofu",
} as const;

export const RECIPE_BROWSER_MVP_DEFERRED = {
  ingredientTokens: [
    "vegetarian",
    "beans",
    "egg",
    "mixed_protein",
    "vegan",
  ],
  ingredientInputs: [
    "egg",
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
  const normalized = normalizeLookupValue(ingredient);
  if (!normalized) {
    return null;
  }

  return INGREDIENT_TOKEN_ALIAS_MAP.get(normalized) ?? null;
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
