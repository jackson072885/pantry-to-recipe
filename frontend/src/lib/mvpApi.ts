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

export type RecommendationRecipe = {
  recipe_id: number;
  recipe_name: string;
  pantry_coverage_pct: number;
  missing_count: number;
  missing_ingredients: string[];
  estimated_time_minutes?: number | null;
  simplicity?: number;
};

export type RecommendationEntry = {
  recipe: RecommendationRecipe;
  explanation: string;
  tonight_score?: number;
};

export type RecommendationsResponse = {
  best_tonight: RecommendationEntry | null;
  alternatives: RecommendationEntry[];
  cook_now: RecommendationEntry[];
  almost_there: RecommendationEntry[];
  not_worth_it: RecommendationEntry[];
};

export type RecipeIngredient = {
  ingredient_id: number;
  ingredient_name: string;
  is_required: boolean;
};

export type RecipeDetail = {
  id: number;
  name: string;
  cuisine?: string | null;
  difficulty?: string | null;
  cook_method?: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  total_time_minutes?: number | null;
  oven_temp_f?: number | null;
  air_fryer_temp_f?: number | null;
  servings?: number | null;
  instructions?: string | null;
  ingredients: RecipeIngredient[];
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

export function parsePantryInput(raw: string): string[] {
  return raw
    .split(/\n|,/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function fetchPantry(): Promise<PantryListResponse> {
  return getJson<PantryListResponse>("/pantry");
}

export async function mutatePantry(
  action: "add" | "remove",
  payload: { name: string; amount: number; unit?: string },
): Promise<PantryListResponse> {
  return postJson<PantryListResponse>(`/pantry/${action}`, payload);
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
