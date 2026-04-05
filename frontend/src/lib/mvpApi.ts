import { getJson, postJson } from "./apiClient";

export type PantryItem = {
  ingredient?: string;
  name?: string;
  title?: string;
  code?: string;
  quantity: number;
  unit?: string;
};

export type PantryListResponse = {
  items: PantryItem[];
};

export type PantryClearResponse = {
  cleared_count: number;
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

export type RecommendationEntry = {
  recipe: RecommendationRecipe;
  explanation: string;
  why_best?: string;
  recommendation_type?: "cook_now" | "almost_there" | "not_worth_it";
  confidence_score?: number;
  confidence_label?: "high" | "medium" | "low";
  missing: RecommendationMissing;
  cta: RecommendationCta;
  tonight_score?: number;
};

export type RecommendationsResponse = {
  contract_version?: string;
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
};

export type RecipeStep = {
  step_number: number;
  instruction_text: string;
  timing_minutes?: number | null;
  temperature_f?: number | null;
  equipment?: string | null;
  doneness_cue?: string | null;
};

export type RecipeDetail = {
  id: number;
  name: string;
  short_description?: string | null;
  cuisine?: string | null;
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

export async function fetchPantry(): Promise<PantryListResponse> {
  return getJson<PantryListResponse>("/pantry");
}

export async function mutatePantry(
  action: "add" | "remove",
  payload: { name: string; amount: number; unit?: string },
): Promise<PantryListResponse> {
  return postJson<PantryListResponse>(`/pantry/${action}`, payload);
}

export async function clearPantry(): Promise<PantryClearResponse> {
  return postJson<PantryClearResponse>("/pantry/clear");
}

export async function fetchRecommendations(pantry: string[]): Promise<RecommendationsResponse> {
  const params = new URLSearchParams();
  pantry.forEach((item) => params.append("pantry", item));
  return getJson<RecommendationsResponse>(`/recommendations?${params.toString()}`);
}

export async function fetchRecipeDetail(recipeId: string | number): Promise<RecipeDetail> {
  return getJson<RecipeDetail>(`/recipes/${recipeId}`);
}

export async function cookRecipe(recipeId: string | number): Promise<CookResponse> {
  return postJson<CookResponse>(`/cook/${recipeId}`);
}
