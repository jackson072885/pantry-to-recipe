import { getJson, postJson } from "./apiClient";

export type PantryItem = {
  ingredient?: string;
  name?: string;
  title?: string;
  code?: string;
  quantity?: number | null;
  unit?: string | null;
  quantity_is_known?: boolean;
  use_soon?: boolean;
};

export type PantryListResponse = {
  items: PantryItem[];
};

export type PantryClearResponse = {
  cleared_count: number;
};

export type PantryImportLineStatus = "accepted" | "review" | "rejected";

export type PantryImportLineResult = {
  raw_line: string;
  cleaned_line: string;
  status: PantryImportLineStatus;
  parsed_quantity?: number | null;
  parsed_unit?: string | null;
  parsed_ingredient_text?: string | null;
  canonical_unit?: string | null;
  canonical_ingredient?: string | null;
  reason_code: string;
  reason_message: string;
};

export type PantryImportSummary = {
  line_count: number;
  accepted_count: number;
  review_count: number;
  rejected_count: number;
};

export type PantryImportPreviewResponse = {
  results: PantryImportLineResult[];
  summary: PantryImportSummary;
};

export type PantryImportCommitResponse = PantryImportPreviewResponse & {
  committed_count: number;
  items: PantryItem[];
};

export type RecommendationRecipe = {
  recipe_id: number;
  recipe_name: string;
  short_description?: string | null;
  difficulty?: string | null;
  pantry_coverage_pct: number;
  missing_count: number;
  missing_ingredients: string[];
  estimated_time_minutes?: number | null;
  simplicity?: number;
  meal_type?: string | null;
  servings?: number | null;
  quality_score?: number | null;
  quality_bucket?: string | null;
  review_status?: string | null;
  is_weeknight_friendly?: boolean | null;
  is_beginner_friendly?: boolean | null;
  required_count?: number;
  present_required_count?: number;
  recommendation_type?: "cook_now" | "almost_there" | "not_worth_it";
};

export type RecommendationMissing = {
  count: number;
  ingredients: string[];
  summary: string;
};

export type RecommendationCta = {
  type: "cook_recipe" | "shop_missing_ingredients";
  label: string;
  pantry_ready: boolean;
  internal_path: string;
  affiliate_query: string;
  missing_count: number;
  missing_ingredients: string[];
};

export type RecommendationMode = "balanced" | "lowest_effort" | "use_it_up_first";

export type RecommendationModeMetadata = {
  key: RecommendationMode;
  label: string;
  description: string;
  default: boolean;
};

export type RecommendationBehaviorMatch = {
  ingredient: string;
  points: number;
  event_count: number;
};

export type RecommendationBehavior = {
  has_signal: boolean;
  points: number;
  direct_recipe_points: number;
  direct_recipe_event_count: number;
  ingredient_affinity_points: number;
  ingredient_matches: RecommendationBehaviorMatch[];
  positive_preference?: boolean;
  negative_preference?: boolean;
};

export type RecommendationScoreBreakdown = {
  base_tonight_score: number;
  mode_key?: RecommendationMode;
  mode_points?: number;
  mode_applied?: boolean;
  use_soon_points?: number;
  use_soon_applied?: boolean;
  behavior_points: number;
  behavior_applied: boolean;
};

export type RecommendationEntry = {
  recipe: RecommendationRecipe;
  explanation: string;
  why_best?: string;
  recommendation_type?: "cook_now" | "almost_there" | "not_worth_it";
  confidence_score?: number;
  confidence_label?: "high" | "medium" | "low";
  behavior?: RecommendationBehavior;
  score_breakdown?: RecommendationScoreBreakdown;
  missing: RecommendationMissing;
  cta: RecommendationCta;
  tonight_score?: number;
};

export type RecommendationsResponse = {
  contract_version?: string;
  decision_mode?: RecommendationModeMetadata;
  recommendation_status?: "strong_match" | "no_strong_match";
  generated_from?: {
    pantry_items: string[];
    pantry_count: number;
  };
  tie_break_rule?: string[];
  best_tonight: RecommendationEntry | null;
  alternatives: RecommendationEntry[];
  closest_options?: RecommendationEntry[];
  cook_now: RecommendationEntry[];
  almost_there: RecommendationEntry[];
  not_worth_it: RecommendationEntry[];
};

export type RecipeIngredient = {
  ingredient_id: number;
  ingredient_name: string;
  display_name?: string | null;
  pantry_name?: string | null;
  is_required: boolean;
  sort_order?: number | null;
  required_quantity?: number | null;
  unit?: string | null;
  display_quantity?: number | null;
  display_unit?: string | null;
  prep_state?: string | null;
  notes?: string | null;
  measurement_is_estimated: boolean;
  pantry_status?: "ready" | "missing" | "needs_quantity_confirmation" | null;
  pantry_quantity?: number | null;
  pantry_unit?: string | null;
  pantry_quantity_is_known?: boolean | null;
  pantry_has_enough?: boolean | null;
};

export type RecipeStep = {
  step_number: number;
  instruction_text: string;
  timing_minutes?: number | null;
  temperature_f?: number | null;
  equipment?: string | null;
  doneness_cue?: string | null;
};

export type RecipeReadiness = {
  can_cook_now: boolean;
  required_ready_count: number;
  required_count: number;
  missing_required_ingredients: string[];
  missing_optional_ingredients: string[];
  required_quantity_confirmation_ingredients: string[];
  optional_quantity_confirmation_ingredients: string[];
};

export type RecipeDetail = {
  id: number;
  name: string;
  short_description?: string | null;
  cuisine?: string | null;
  primary_protein?: string | null;
  difficulty?: string | null;
  meal_type?: string | null;
  cook_method?: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  total_time_minutes?: number | null;
  oven_temp_f?: number | null;
  air_fryer_temp_f?: number | null;
  servings?: number | null;
  instructions?: string | null;
  quality_score?: number | null;
  quality_bucket?: string | null;
  review_status?: string | null;
  is_weeknight_friendly?: boolean | null;
  is_beginner_friendly?: boolean | null;
  equipment: string[];
  tips: string[];
  substitutions: string[];
  warnings: string[];
  storage: string[];
  tags: string[];
  readiness: RecipeReadiness;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
};

export type CookResponse = {
  recipe_id: number;
  recipe_name: string;
  deducted: string[];
  deductions: Array<{
    ingredient: string;
    quantity: number;
    unit: string;
  }>;
};

export type RecipeListItem = {
  id: number;
  name: string;
  short_description?: string | null;
  meal_type?: string | null;
  total_time_minutes?: number | null;
  difficulty?: string | null;
  quality_score?: number | null;
};

export type RecipeBrowserCatalog = {
  recipes: RecipeDetail[];
  failedRecipeCount: number;
  totalRecipeCount: number;
};

export async function fetchPantry(): Promise<PantryListResponse> {
  return getJson<PantryListResponse>("/pantry");
}

export async function mutatePantry(
  action: "add" | "remove",
  payload: { name: string; amount: number; unit?: string },
): Promise<PantryListResponse> {
  return postJson<PantryListResponse>(`/pantry/${action}`, payload);
}

export async function addPantryPresence(
  payload: { name: string },
): Promise<PantryListResponse> {
  return postJson<PantryListResponse>("/pantry/add-presence", payload);
}

export async function setPantryUseSoon(
  payload: { name: string; use_soon: boolean },
): Promise<PantryListResponse> {
  return postJson<PantryListResponse>("/pantry/use-soon", payload);
}

export async function clearPantry(): Promise<PantryClearResponse> {
  return postJson<PantryClearResponse>("/pantry/clear");
}

export async function previewPantryImport(payload: { lines: string[] }): Promise<PantryImportPreviewResponse> {
  return postJson<PantryImportPreviewResponse>("/pantry/import/preview", payload);
}

export async function commitPantryImport(payload: { lines: string[] }): Promise<PantryImportCommitResponse> {
  return postJson<PantryImportCommitResponse>("/pantry/import/commit", payload);
}

export async function fetchRecommendations(
  pantry: string[],
  mode: RecommendationMode = "balanced",
): Promise<RecommendationsResponse> {
  const params = new URLSearchParams();
  pantry.forEach((item) => params.append("pantry", item));
  params.append("mode", mode);
  return getJson<RecommendationsResponse>(`/recommendations?${params.toString()}`);
}

export async function fetchRecipeList(limit = 5000): Promise<RecipeListItem[]> {
  return getJson<RecipeListItem[]>(`/recipes?limit=${limit}`);
}

const RECIPE_BROWSER_CATALOG_BATCH_SIZE = 25;

export async function fetchRecipeBrowserCatalog(limit = 5000): Promise<RecipeBrowserCatalog> {
  const recipes = await fetchRecipeList(limit);
  const hydratedRecipes: Array<{ index: number; recipe: RecipeDetail }> = [];
  let failedRecipeCount = 0;

  for (let batchStart = 0; batchStart < recipes.length; batchStart += RECIPE_BROWSER_CATALOG_BATCH_SIZE) {
    const batch = recipes.slice(batchStart, batchStart + RECIPE_BROWSER_CATALOG_BATCH_SIZE);
    const settledBatch = await Promise.allSettled(
      batch.map(async (recipe, batchIndex) => ({
        index: batchStart + batchIndex,
        recipe: await fetchRecipeDetail(recipe.id),
      })),
    );

    for (const result of settledBatch) {
      if (result.status === "fulfilled") {
        hydratedRecipes.push(result.value);
      } else {
        failedRecipeCount += 1;
      }
    }
  }

  if (recipes.length > 0 && hydratedRecipes.length === 0) {
    throw new Error("Recipe Browser catalog failed to hydrate.");
  }

  hydratedRecipes.sort((left, right) => left.index - right.index);

  return {
    recipes: hydratedRecipes.map((entry) => entry.recipe),
    failedRecipeCount,
    totalRecipeCount: recipes.length,
  };
}

export async function fetchRecipeDetail(recipeId: string | number): Promise<RecipeDetail> {
  return getJson<RecipeDetail>(`/recipes/${recipeId}`);
}

export async function cookRecipe(recipeId: string | number): Promise<CookResponse> {
  return postJson<CookResponse>(`/cook/${recipeId}`);
}
