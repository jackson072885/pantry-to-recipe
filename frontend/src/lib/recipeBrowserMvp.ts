export const RECIPE_BROWSER_MVP_FILTER_FAMILY_IDS = [
  "protein",
  "cuisine",
  "time",
  "difficulty",
  "method",
] as const;

export type RecipeBrowserMvpFilterFamilyId =
  typeof RECIPE_BROWSER_MVP_FILTER_FAMILY_IDS[number];

export type RecipeBrowserMvpProteinFamilyId =
  | "chicken"
  | "beef"
  | "pork"
  | "turkey"
  | "seafood"
  | "tofu";

export type RecipeBrowserMvpCuisineId =
  | "american"
  | "asian"
  | "bbq"
  | "indian"
  | "italian"
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

export type RecipeBrowserMvpFilterValueId =
  | RecipeBrowserMvpProteinFamilyId
  | RecipeBrowserMvpCuisineId
  | RecipeBrowserMvpTimeBucketId
  | RecipeBrowserMvpDifficultyId
  | RecipeBrowserMvpMethodId;

type RecipeBrowserMvpOption<TId extends string> = {
  id: TId;
  label: string;
};

type RecipeBrowserMvpFilterFamily<TId extends string> = {
  id: RecipeBrowserMvpFilterFamilyId;
  label: string;
  options: readonly RecipeBrowserMvpOption<TId>[];
};

const PROTEIN_OPTIONS = [
  { id: "chicken", label: "Chicken" },
  { id: "beef", label: "Beef" },
  { id: "pork", label: "Pork" },
  { id: "turkey", label: "Turkey" },
  { id: "seafood", label: "Seafood" },
  { id: "tofu", label: "Tofu" },
] as const satisfies readonly RecipeBrowserMvpOption<RecipeBrowserMvpProteinFamilyId>[];

const CUISINE_OPTIONS = [
  { id: "american", label: "American" },
  { id: "asian", label: "Asian" },
  { id: "bbq", label: "BBQ" },
  { id: "indian", label: "Indian" },
  { id: "italian", label: "Italian" },
  { id: "mediterranean", label: "Mediterranean" },
  { id: "mexican", label: "Mexican" },
  { id: "southern", label: "Southern" },
  { id: "tex_mex", label: "Tex-Mex" },
] as const satisfies readonly RecipeBrowserMvpOption<RecipeBrowserMvpCuisineId>[];

const TIME_OPTIONS = [
  { id: "15_min", label: "15 min" },
  { id: "30_min", label: "30 min" },
  { id: "45_min", label: "45 min" },
  { id: "45_plus_min", label: "45+ min" },
] as const satisfies readonly RecipeBrowserMvpOption<RecipeBrowserMvpTimeBucketId>[];

const DIFFICULTY_OPTIONS = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
] as const satisfies readonly RecipeBrowserMvpOption<RecipeBrowserMvpDifficultyId>[];

const METHOD_OPTIONS = [
  { id: "skillet", label: "Skillet" },
  { id: "stovetop", label: "Stovetop" },
  { id: "oven", label: "Oven" },
] as const satisfies readonly RecipeBrowserMvpOption<RecipeBrowserMvpMethodId>[];

export const RECIPE_BROWSER_MVP_FILTERS = {
  protein: {
    id: "protein",
    label: "Protein",
    options: PROTEIN_OPTIONS,
  },
  cuisine: {
    id: "cuisine",
    label: "Cuisine",
    options: CUISINE_OPTIONS,
  },
  time: {
    id: "time",
    label: "Time",
    options: TIME_OPTIONS,
  },
  difficulty: {
    id: "difficulty",
    label: "Difficulty",
    options: DIFFICULTY_OPTIONS,
  },
  method: {
    id: "method",
    label: "Method",
    options: METHOD_OPTIONS,
  },
} as const satisfies {
  protein: RecipeBrowserMvpFilterFamily<RecipeBrowserMvpProteinFamilyId>;
  cuisine: RecipeBrowserMvpFilterFamily<RecipeBrowserMvpCuisineId>;
  time: RecipeBrowserMvpFilterFamily<RecipeBrowserMvpTimeBucketId>;
  difficulty: RecipeBrowserMvpFilterFamily<RecipeBrowserMvpDifficultyId>;
  method: RecipeBrowserMvpFilterFamily<RecipeBrowserMvpMethodId>;
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

const PROTEIN_NORMALIZATION_MAP: Readonly<Record<string, RecipeBrowserMvpProteinFamilyId>> = {
  chicken: "chicken",
  beef: "beef",
  "ground beef": "beef",
  pork: "pork",
  bacon: "pork",
  ham: "pork",
  sausage: "pork",
  "ground turkey": "turkey",
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
  proteinFamilies: [
    "vegetarian",
    "beans",
    "egg",
    "mixed_protein",
    "vegan",
  ],
  proteinInputs: [
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

export function normalizeRecipeBrowserProteinFamily(
  primaryProtein: string | null | undefined,
): RecipeBrowserMvpProteinFamilyId | null {
  const normalized = primaryProtein?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return PROTEIN_NORMALIZATION_MAP[normalized] ?? null;
}
