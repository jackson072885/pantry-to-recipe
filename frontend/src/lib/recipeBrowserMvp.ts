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
  | "bbq"
  | "american_comfort_food"
  | "american_burgers_sandwiches"
  | "american_casseroles"
  | "american_skillet_dinners"
  | "american_grilled"
  | "american_fried_crispy"
  | "cuban"
  | "indian"
  | "indian_curry"
  | "indian_masala"
  | "indian_tikka_tandoori"
  | "indian_dal_lentils"
  | "indian_rice_bowls"
  | "indian_vegetarian"
  | "indian_chicken"
  | "indian_tofu"
  | "indian_fish"
  | "indian_skillet_curry"
  | "chinese"
  | "chinese_stir_fry"
  | "chinese_noodles"
  | "chinese_fried_rice"
  | "chinese_garlic_sauce"
  | "chinese_soy_based"
  | "chinese_chicken"
  | "chinese_beef"
  | "chinese_vegetable"
  | "japanese"
  | "japanese_teriyaki"
  | "japanese_ramen_noodles"
  | "japanese_rice_bowls"
  | "japanese_miso"
  | "japanese_salmon"
  | "japanese_chicken"
  | "japanese_tofu"
  | "korean"
  | "korean_gochujang"
  | "korean_rice_bowls"
  | "korean_stir_fry"
  | "korean_bbq_style"
  | "korean_beef"
  | "korean_chicken"
  | "korean_tofu"
  | "thai"
  | "thai_curry"
  | "thai_coconut_milk"
  | "thai_noodles"
  | "thai_rice_bowls"
  | "thai_peanut_sauce"
  | "thai_chicken"
  | "thai_shrimp"
  | "thai_tofu"
  | "italian"
  | "italian_pasta"
  | "italian_red_sauce"
  | "italian_cream_sauce"
  | "italian_pesto"
  | "italian_baked_pasta"
  | "italian_chicken"
  | "italian_beef"
  | "italian_sausage"
  | "italian_parmesan_cheese"
  | "italian_vegetarian"
  | "mediterranean"
  | "mediterranean_lemon_herb"
  | "mediterranean_olive_oil"
  | "mediterranean_chickpeas_legumes"
  | "mediterranean_fish_seafood"
  | "mediterranean_chicken"
  | "mediterranean_grain_bowls"
  | "mediterranean_orzo_couscous"
  | "mediterranean_yogurt_feta"
  | "mediterranean_grilled_kebabs"
  | "mediterranean_stewed_braised"
  | "middle_eastern"
  | "middle_eastern_hummus_chickpeas"
  | "middle_eastern_yogurt_tahini"
  | "middle_eastern_shawarma"
  | "middle_eastern_kebabs"
  | "middle_eastern_rice_bowls"
  | "middle_eastern_lentils"
  | "middle_eastern_chicken"
  | "middle_eastern_lamb"
  | "middle_eastern_vegetarian"
  | "mexican"
  | "mexican_tacos"
  | "mexican_fajitas"
  | "mexican_enchiladas"
  | "mexican_burritos"
  | "mexican_quesadillas"
  | "mexican_rice_bowls"
  | "mexican_beans_rice"
  | "mexican_salsa_based"
  | "mexican_spicy_chile"
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
  { id: "american", label: "American", children: ["southern", "bbq", "american_comfort_food", "american_burgers_sandwiches", "american_casseroles", "american_skillet_dinners", "american_grilled", "american_fried_crispy"] },
  { id: "mexican", label: "Mexican", children: ["tex_mex", "mexican_tacos", "mexican_fajitas", "mexican_enchiladas", "mexican_burritos", "mexican_quesadillas", "mexican_rice_bowls", "mexican_beans_rice", "mexican_salsa_based", "mexican_spicy_chile"] },
  { id: "cuban", label: "Cuban" },
  { id: "indian", label: "Indian", children: ["indian_curry", "indian_masala", "indian_tikka_tandoori", "indian_dal_lentils", "indian_rice_bowls", "indian_vegetarian", "indian_chicken", "indian_tofu", "indian_fish", "indian_skillet_curry"] },
  { id: "chinese", label: "Chinese", children: ["chinese_stir_fry", "chinese_noodles", "chinese_fried_rice", "chinese_garlic_sauce", "chinese_soy_based", "chinese_chicken", "chinese_beef", "chinese_vegetable"] },
  { id: "japanese", label: "Japanese", children: ["japanese_teriyaki", "japanese_ramen_noodles", "japanese_rice_bowls", "japanese_miso", "japanese_salmon", "japanese_chicken", "japanese_tofu"] },
  { id: "korean", label: "Korean", children: ["korean_gochujang", "korean_rice_bowls", "korean_stir_fry", "korean_bbq_style", "korean_beef", "korean_chicken", "korean_tofu"] },
  { id: "thai", label: "Thai", children: ["thai_curry", "thai_coconut_milk", "thai_noodles", "thai_rice_bowls", "thai_peanut_sauce", "thai_chicken", "thai_shrimp", "thai_tofu"] },
  { id: "italian", label: "Italian", children: ["italian_pasta", "italian_red_sauce", "italian_cream_sauce", "italian_pesto", "italian_baked_pasta", "italian_chicken", "italian_beef", "italian_sausage", "italian_parmesan_cheese", "italian_vegetarian"] },
  { id: "mediterranean", label: "Mediterranean", children: ["mediterranean_lemon_herb", "mediterranean_olive_oil", "mediterranean_chickpeas_legumes", "mediterranean_fish_seafood", "mediterranean_chicken", "mediterranean_grain_bowls", "mediterranean_orzo_couscous", "mediterranean_yogurt_feta", "mediterranean_grilled_kebabs", "mediterranean_stewed_braised"] },
  { id: "middle_eastern", label: "Middle Eastern", aliases: ["middle eastern"], children: ["middle_eastern_hummus_chickpeas", "middle_eastern_yogurt_tahini", "middle_eastern_shawarma", "middle_eastern_kebabs", "middle_eastern_rice_bowls", "middle_eastern_lentils", "middle_eastern_chicken", "middle_eastern_lamb", "middle_eastern_vegetarian"] },
  { id: "southern", label: "Southern", parentId: "american" },
  { id: "bbq", label: "BBQ", parentId: "american", aliases: ["barbecue"] },
  { id: "american_comfort_food", label: "Comfort Food", parentId: "american", aliases: ["comfort food"] },
  { id: "american_burgers_sandwiches", label: "Burgers & Sandwiches", parentId: "american", aliases: ["burgers and sandwiches", "sandwiches"] },
  { id: "american_casseroles", label: "Casseroles", parentId: "american" },
  { id: "american_skillet_dinners", label: "Skillet Dinners", parentId: "american", aliases: ["skillet dinners"] },
  { id: "american_grilled", label: "Grilled", parentId: "american" },
  { id: "american_fried_crispy", label: "Fried / Crispy", parentId: "american", aliases: ["fried", "crispy"] },
  { id: "tex_mex", label: "Tex-Mex", parentId: "mexican", aliases: ["tex mex"] },
  { id: "mexican_tacos", label: "Tacos", parentId: "mexican" },
  { id: "mexican_fajitas", label: "Fajitas", parentId: "mexican" },
  { id: "mexican_enchiladas", label: "Enchiladas", parentId: "mexican" },
  { id: "mexican_burritos", label: "Burritos", parentId: "mexican" },
  { id: "mexican_quesadillas", label: "Quesadillas", parentId: "mexican" },
  { id: "mexican_rice_bowls", label: "Rice Bowls", parentId: "mexican", aliases: ["rice bowls"] },
  { id: "mexican_beans_rice", label: "Beans & Rice", parentId: "mexican", aliases: ["beans and rice"] },
  { id: "mexican_salsa_based", label: "Salsa-Based", parentId: "mexican", aliases: ["salsa based"] },
  { id: "mexican_spicy_chile", label: "Spicy / Chile-Based", parentId: "mexican", aliases: ["spicy chile based", "chile based"] },
  { id: "indian_curry", label: "Curry", parentId: "indian" },
  { id: "indian_masala", label: "Masala", parentId: "indian" },
  { id: "indian_tikka_tandoori", label: "Tikka / Tandoori", parentId: "indian", aliases: ["tikka", "tandoori"] },
  { id: "indian_dal_lentils", label: "Dal / Lentils", parentId: "indian", aliases: ["dal", "lentils"] },
  { id: "indian_rice_bowls", label: "Rice Bowls", parentId: "indian", aliases: ["rice bowls"] },
  { id: "indian_vegetarian", label: "Vegetarian", parentId: "indian" },
  { id: "indian_chicken", label: "Chicken", parentId: "indian" },
  { id: "indian_tofu", label: "Tofu", parentId: "indian" },
  { id: "indian_fish", label: "Fish", parentId: "indian" },
  { id: "indian_skillet_curry", label: "Skillet Curry", parentId: "indian", aliases: ["skillet curry"] },
  { id: "chinese_stir_fry", label: "Stir-Fry", parentId: "chinese", aliases: ["stir fry"] },
  { id: "chinese_noodles", label: "Noodles", parentId: "chinese" },
  { id: "chinese_fried_rice", label: "Fried Rice", parentId: "chinese", aliases: ["fried rice"] },
  { id: "chinese_garlic_sauce", label: "Garlic Sauce", parentId: "chinese", aliases: ["garlic sauce"] },
  { id: "chinese_soy_based", label: "Soy-Based", parentId: "chinese", aliases: ["soy based"] },
  { id: "chinese_chicken", label: "Chicken", parentId: "chinese" },
  { id: "chinese_beef", label: "Beef", parentId: "chinese" },
  { id: "chinese_vegetable", label: "Vegetable", parentId: "chinese" },
  { id: "japanese_teriyaki", label: "Teriyaki", parentId: "japanese" },
  { id: "japanese_ramen_noodles", label: "Ramen / Noodles", parentId: "japanese", aliases: ["ramen", "noodles"] },
  { id: "japanese_rice_bowls", label: "Rice Bowls", parentId: "japanese", aliases: ["rice bowls"] },
  { id: "japanese_miso", label: "Miso", parentId: "japanese" },
  { id: "japanese_salmon", label: "Salmon", parentId: "japanese" },
  { id: "japanese_chicken", label: "Chicken", parentId: "japanese" },
  { id: "japanese_tofu", label: "Tofu", parentId: "japanese" },
  { id: "korean_gochujang", label: "Gochujang", parentId: "korean" },
  { id: "korean_rice_bowls", label: "Rice Bowls", parentId: "korean", aliases: ["rice bowls"] },
  { id: "korean_stir_fry", label: "Stir-Fry", parentId: "korean", aliases: ["stir fry"] },
  { id: "korean_bbq_style", label: "BBQ-Style", parentId: "korean", aliases: ["bbq style"] },
  { id: "korean_beef", label: "Beef", parentId: "korean" },
  { id: "korean_chicken", label: "Chicken", parentId: "korean" },
  { id: "korean_tofu", label: "Tofu", parentId: "korean" },
  { id: "thai_curry", label: "Curry", parentId: "thai" },
  { id: "thai_coconut_milk", label: "Coconut Milk", parentId: "thai", aliases: ["coconut milk"] },
  { id: "thai_noodles", label: "Noodles", parentId: "thai" },
  { id: "thai_rice_bowls", label: "Rice Bowls", parentId: "thai", aliases: ["rice bowls"] },
  { id: "thai_peanut_sauce", label: "Peanut Sauce", parentId: "thai", aliases: ["peanut sauce"] },
  { id: "thai_chicken", label: "Chicken", parentId: "thai" },
  { id: "thai_shrimp", label: "Shrimp", parentId: "thai" },
  { id: "thai_tofu", label: "Tofu", parentId: "thai" },
  { id: "italian_pasta", label: "Pasta", parentId: "italian" },
  { id: "italian_red_sauce", label: "Red Sauce", parentId: "italian", aliases: ["red sauce"] },
  { id: "italian_cream_sauce", label: "Cream Sauce", parentId: "italian", aliases: ["cream sauce"] },
  { id: "italian_pesto", label: "Pesto", parentId: "italian" },
  { id: "italian_baked_pasta", label: "Baked Pasta", parentId: "italian", aliases: ["baked pasta"] },
  { id: "italian_chicken", label: "Chicken", parentId: "italian" },
  { id: "italian_beef", label: "Beef", parentId: "italian" },
  { id: "italian_sausage", label: "Sausage", parentId: "italian" },
  { id: "italian_parmesan_cheese", label: "Parmesan / Cheese-Based", parentId: "italian", aliases: ["parmesan", "cheese based"] },
  { id: "italian_vegetarian", label: "Vegetarian", parentId: "italian" },
  { id: "mediterranean_lemon_herb", label: "Lemon & Herb", parentId: "mediterranean", aliases: ["lemon and herb"] },
  { id: "mediterranean_olive_oil", label: "Olive Oil-Based", parentId: "mediterranean", aliases: ["olive oil based"] },
  { id: "mediterranean_chickpeas_legumes", label: "Chickpeas & Legumes", parentId: "mediterranean", aliases: ["chickpeas and legumes"] },
  { id: "mediterranean_fish_seafood", label: "Fish & Seafood", parentId: "mediterranean", aliases: ["fish and seafood"] },
  { id: "mediterranean_chicken", label: "Chicken", parentId: "mediterranean" },
  { id: "mediterranean_grain_bowls", label: "Grain Bowls", parentId: "mediterranean", aliases: ["grain bowls"] },
  { id: "mediterranean_orzo_couscous", label: "Orzo / Couscous", parentId: "mediterranean", aliases: ["orzo", "couscous"] },
  { id: "mediterranean_yogurt_feta", label: "Yogurt / Feta", parentId: "mediterranean", aliases: ["yogurt", "feta"] },
  { id: "mediterranean_grilled_kebabs", label: "Grilled / Kebabs", parentId: "mediterranean", aliases: ["grilled", "kebabs"] },
  { id: "mediterranean_stewed_braised", label: "Stewed / Braised", parentId: "mediterranean", aliases: ["stewed", "braised"] },
  { id: "middle_eastern_hummus_chickpeas", label: "Hummus / Chickpeas", parentId: "middle_eastern", aliases: ["hummus", "chickpeas"] },
  { id: "middle_eastern_yogurt_tahini", label: "Yogurt / Tahini", parentId: "middle_eastern", aliases: ["yogurt", "tahini"] },
  { id: "middle_eastern_shawarma", label: "Shawarma-Style", parentId: "middle_eastern", aliases: ["shawarma"] },
  { id: "middle_eastern_kebabs", label: "Kebabs", parentId: "middle_eastern" },
  { id: "middle_eastern_rice_bowls", label: "Rice Bowls", parentId: "middle_eastern", aliases: ["rice bowls"] },
  { id: "middle_eastern_lentils", label: "Lentils", parentId: "middle_eastern" },
  { id: "middle_eastern_chicken", label: "Chicken", parentId: "middle_eastern" },
  { id: "middle_eastern_lamb", label: "Lamb", parentId: "middle_eastern" },
  { id: "middle_eastern_vegetarian", label: "Vegetarian", parentId: "middle_eastern" },
] as const satisfies readonly RecipeBrowserMvpTaxonomyOption[];

export const RECIPE_BROWSER_MVP_CUISINE_GROUPS = [
  { id: "american", label: "American", childIds: ["southern", "bbq", "american_comfort_food", "american_burgers_sandwiches", "american_casseroles", "american_skillet_dinners", "american_grilled", "american_fried_crispy"] },
  { id: "mexican", label: "Mexican", childIds: ["tex_mex", "mexican_tacos", "mexican_fajitas", "mexican_enchiladas", "mexican_burritos", "mexican_quesadillas", "mexican_rice_bowls", "mexican_beans_rice", "mexican_salsa_based", "mexican_spicy_chile"] },
  { id: "cuban", label: "Cuban", childIds: [] },
  { id: "indian", label: "Indian", childIds: ["indian_curry", "indian_masala", "indian_tikka_tandoori", "indian_dal_lentils", "indian_rice_bowls", "indian_vegetarian", "indian_chicken", "indian_tofu", "indian_fish", "indian_skillet_curry"] },
  { id: "chinese", label: "Chinese", childIds: ["chinese_stir_fry", "chinese_noodles", "chinese_fried_rice", "chinese_garlic_sauce", "chinese_soy_based", "chinese_chicken", "chinese_beef", "chinese_vegetable"] },
  { id: "japanese", label: "Japanese", childIds: ["japanese_teriyaki", "japanese_ramen_noodles", "japanese_rice_bowls", "japanese_miso", "japanese_salmon", "japanese_chicken", "japanese_tofu"] },
  { id: "korean", label: "Korean", childIds: ["korean_gochujang", "korean_rice_bowls", "korean_stir_fry", "korean_bbq_style", "korean_beef", "korean_chicken", "korean_tofu"] },
  { id: "thai", label: "Thai", childIds: ["thai_curry", "thai_coconut_milk", "thai_noodles", "thai_rice_bowls", "thai_peanut_sauce", "thai_chicken", "thai_shrimp", "thai_tofu"] },
  { id: "italian", label: "Italian", childIds: ["italian_pasta", "italian_red_sauce", "italian_cream_sauce", "italian_pesto", "italian_baked_pasta", "italian_chicken", "italian_beef", "italian_sausage", "italian_parmesan_cheese", "italian_vegetarian"] },
  { id: "mediterranean", label: "Mediterranean", childIds: ["mediterranean_lemon_herb", "mediterranean_olive_oil", "mediterranean_chickpeas_legumes", "mediterranean_fish_seafood", "mediterranean_chicken", "mediterranean_grain_bowls", "mediterranean_orzo_couscous", "mediterranean_yogurt_feta", "mediterranean_grilled_kebabs", "mediterranean_stewed_braised"] },
  { id: "middle_eastern", label: "Middle Eastern", childIds: ["middle_eastern_hummus_chickpeas", "middle_eastern_yogurt_tahini", "middle_eastern_shawarma", "middle_eastern_kebabs", "middle_eastern_rice_bowls", "middle_eastern_lentils", "middle_eastern_chicken", "middle_eastern_lamb", "middle_eastern_vegetarian"] },
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

type RecipeBrowserCuisineDerivationContext = {
  name?: string | null;
  primary_protein?: string | null;
  cook_method?: string | null;
  tags?: readonly string[] | null;
  ingredients?: readonly {
    ingredient_name?: string | null;
    display_name?: string | null;
    pantry_name?: string | null;
  }[] | null;
};

function normalizeLooseCuisineText(value: string | null | undefined): string {
  return value?.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ") ?? "";
}

function buildCuisineDerivationText(
  cuisine: string | null | undefined,
  context?: RecipeBrowserCuisineDerivationContext,
): string {
  const values = [
    cuisine,
    context?.name,
    context?.primary_protein,
    context?.cook_method,
    ...(context?.tags ?? []),
    ...(context?.ingredients ?? []).flatMap((ingredient) => [
      ingredient.ingredient_name,
      ingredient.display_name,
      ingredient.pantry_name,
    ]),
  ];

  return ` ${values.map(normalizeLooseCuisineText).filter(Boolean).join(" ")} `;
}

function cuisineTextIncludes(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => text.includes(` ${term} `));
}

function inferCuisineRootFromText(text: string): RecipeBrowserMvpCuisineId | null {
  if (cuisineTextIncludes(text, ["korean", "gochujang"])) {
    return "korean";
  }

  if (cuisineTextIncludes(text, ["thai"]) || (cuisineTextIncludes(text, ["coconut", "peanut"]) && cuisineTextIncludes(text, ["curry", "noodles"]))) {
    return "thai";
  }

  if (cuisineTextIncludes(text, ["japanese", "teriyaki", "ramen", "miso", "sushi", "udon"])) {
    return "japanese";
  }

  if (cuisineTextIncludes(text, ["chinese", "lo mein", "stir fry", "fried rice", "soy", "sesame", "bok choy"])) {
    return "chinese";
  }

  return null;
}

function getCuisineRootIdFromRawCuisine(
  cuisine: string | null | undefined,
  derivationText: string,
): RecipeBrowserMvpCuisineId | null {
  const normalizedId = normalizeRecipeBrowserCuisineId(cuisine);
  if (normalizedId) {
    return getRecipeBrowserCuisineRootId(normalizedId);
  }

  const normalizedCuisine = normalizeLookupValue(cuisine);
  if (normalizedCuisine === "asian") {
    return inferCuisineRootFromText(derivationText);
  }

  return null;
}

function pushCuisineStyleIfMatched(
  styles: RecipeBrowserMvpCuisineId[],
  text: string,
  styleId: RecipeBrowserMvpCuisineId,
  terms: readonly string[],
) {
  if (cuisineTextIncludes(text, terms)) {
    styles.push(styleId);
  }
}

function deriveCuisineStyleIds(
  rootId: RecipeBrowserMvpCuisineId,
  text: string,
): RecipeBrowserMvpCuisineId[] {
  const styles: RecipeBrowserMvpCuisineId[] = [];

  if (rootId === "american") {
    pushCuisineStyleIfMatched(styles, text, "southern", ["southern", "cajun", "creole", "smothered", "blackened", "dumpling", "dirty rice"]);
    pushCuisineStyleIfMatched(styles, text, "bbq", ["bbq", "barbecue"]);
    pushCuisineStyleIfMatched(styles, text, "american_comfort_food", ["comfort food", "pot pie", "mac and cheese", "chili", "soup", "stuffing"]);
    pushCuisineStyleIfMatched(styles, text, "american_burgers_sandwiches", ["burger", "sandwich", "sloppy"]);
    pushCuisineStyleIfMatched(styles, text, "american_casseroles", ["casserole", "bake"]);
    pushCuisineStyleIfMatched(styles, text, "american_skillet_dinners", ["skillet"]);
    pushCuisineStyleIfMatched(styles, text, "american_grilled", ["grilled"]);
    pushCuisineStyleIfMatched(styles, text, "american_fried_crispy", ["fried", "crispy", "pan fried"]);
  }

  if (rootId === "mexican") {
    pushCuisineStyleIfMatched(styles, text, "tex_mex", ["tex mex"]);
    pushCuisineStyleIfMatched(styles, text, "mexican_tacos", ["taco", "tacos"]);
    pushCuisineStyleIfMatched(styles, text, "mexican_fajitas", ["fajita", "fajitas"]);
    pushCuisineStyleIfMatched(styles, text, "mexican_enchiladas", ["enchilada", "enchiladas", "enchilada style"]);
    pushCuisineStyleIfMatched(styles, text, "mexican_burritos", ["burrito", "burritos", "burrito bowls"]);
    pushCuisineStyleIfMatched(styles, text, "mexican_quesadillas", ["quesadilla", "quesadillas"]);
    pushCuisineStyleIfMatched(styles, text, "mexican_rice_bowls", ["rice bowl", "rice bowls", "bowl", "bowls", "rice skillet"]);
    pushCuisineStyleIfMatched(styles, text, "mexican_beans_rice", ["beans", "bean forward", "black beans"]);
    pushCuisineStyleIfMatched(styles, text, "mexican_salsa_based", ["salsa", "salsa verde", "salsa roja"]);
    pushCuisineStyleIfMatched(styles, text, "mexican_spicy_chile", ["chile", "chili", "chipotle", "adobo", "poblano"]);
  }

  if (rootId === "indian") {
    pushCuisineStyleIfMatched(styles, text, "indian_curry", ["curry"]);
    pushCuisineStyleIfMatched(styles, text, "indian_masala", ["masala"]);
    pushCuisineStyleIfMatched(styles, text, "indian_tikka_tandoori", ["tikka", "tandoori"]);
    pushCuisineStyleIfMatched(styles, text, "indian_dal_lentils", ["dal", "lentil", "lentils"]);
    pushCuisineStyleIfMatched(styles, text, "indian_rice_bowls", ["rice bowl", "rice bowls", "rice"]);
    pushCuisineStyleIfMatched(styles, text, "indian_vegetarian", ["vegetarian", "chickpea", "chickpeas", "potato", "pea", "vegetable"]);
    pushCuisineStyleIfMatched(styles, text, "indian_chicken", ["chicken"]);
    pushCuisineStyleIfMatched(styles, text, "indian_tofu", ["tofu"]);
    pushCuisineStyleIfMatched(styles, text, "indian_fish", ["fish", "cod", "salmon"]);
    if (cuisineTextIncludes(text, ["skillet"]) && cuisineTextIncludes(text, ["curry"])) {
      styles.push("indian_skillet_curry");
    }
  }

  if (rootId === "chinese") {
    pushCuisineStyleIfMatched(styles, text, "chinese_stir_fry", ["stir fry"]);
    pushCuisineStyleIfMatched(styles, text, "chinese_noodles", ["noodle", "noodles", "lo mein"]);
    pushCuisineStyleIfMatched(styles, text, "chinese_fried_rice", ["fried rice"]);
    if (cuisineTextIncludes(text, ["garlic"]) && cuisineTextIncludes(text, ["sauce", "stir fry", "noodles"])) {
      styles.push("chinese_garlic_sauce");
    }
    pushCuisineStyleIfMatched(styles, text, "chinese_soy_based", ["soy"]);
    pushCuisineStyleIfMatched(styles, text, "chinese_chicken", ["chicken"]);
    pushCuisineStyleIfMatched(styles, text, "chinese_beef", ["beef"]);
    pushCuisineStyleIfMatched(styles, text, "chinese_vegetable", ["vegetable", "veggie", "broccoli", "cabbage", "bok choy", "green bean", "snap pea", "mushroom", "carrot"]);
  }

  if (rootId === "japanese") {
    pushCuisineStyleIfMatched(styles, text, "japanese_teriyaki", ["teriyaki"]);
    pushCuisineStyleIfMatched(styles, text, "japanese_ramen_noodles", ["ramen", "noodle", "noodles", "udon"]);
    pushCuisineStyleIfMatched(styles, text, "japanese_rice_bowls", ["rice bowl", "rice bowls", "bowl", "bowls", "rice"]);
    pushCuisineStyleIfMatched(styles, text, "japanese_miso", ["miso"]);
    pushCuisineStyleIfMatched(styles, text, "japanese_salmon", ["salmon"]);
    pushCuisineStyleIfMatched(styles, text, "japanese_chicken", ["chicken"]);
    pushCuisineStyleIfMatched(styles, text, "japanese_tofu", ["tofu"]);
  }

  if (rootId === "korean") {
    pushCuisineStyleIfMatched(styles, text, "korean_gochujang", ["gochujang"]);
    pushCuisineStyleIfMatched(styles, text, "korean_rice_bowls", ["rice bowl", "rice bowls", "bowl", "bowls"]);
    pushCuisineStyleIfMatched(styles, text, "korean_stir_fry", ["stir fry"]);
    pushCuisineStyleIfMatched(styles, text, "korean_bbq_style", ["bbq", "barbecue"]);
    pushCuisineStyleIfMatched(styles, text, "korean_beef", ["beef"]);
    pushCuisineStyleIfMatched(styles, text, "korean_chicken", ["chicken"]);
    pushCuisineStyleIfMatched(styles, text, "korean_tofu", ["tofu"]);
  }

  if (rootId === "thai") {
    pushCuisineStyleIfMatched(styles, text, "thai_curry", ["curry"]);
    pushCuisineStyleIfMatched(styles, text, "thai_coconut_milk", ["coconut"]);
    pushCuisineStyleIfMatched(styles, text, "thai_noodles", ["noodle", "noodles"]);
    pushCuisineStyleIfMatched(styles, text, "thai_rice_bowls", ["rice bowl", "rice bowls", "bowl", "bowls"]);
    pushCuisineStyleIfMatched(styles, text, "thai_peanut_sauce", ["peanut"]);
    pushCuisineStyleIfMatched(styles, text, "thai_chicken", ["chicken"]);
    pushCuisineStyleIfMatched(styles, text, "thai_shrimp", ["shrimp"]);
    pushCuisineStyleIfMatched(styles, text, "thai_tofu", ["tofu"]);
  }

  if (rootId === "italian") {
    pushCuisineStyleIfMatched(styles, text, "italian_pasta", ["pasta", "ravioli", "ziti", "tortellini", "lasagna", "noodle"]);
    pushCuisineStyleIfMatched(styles, text, "italian_red_sauce", ["red sauce", "marinara", "ragu", "tomato"]);
    pushCuisineStyleIfMatched(styles, text, "italian_cream_sauce", ["cream", "creamy", "alfredo"]);
    pushCuisineStyleIfMatched(styles, text, "italian_pesto", ["pesto"]);
    pushCuisineStyleIfMatched(styles, text, "italian_baked_pasta", ["pasta bake", "baked pasta", "baked ziti", "bake"]);
    pushCuisineStyleIfMatched(styles, text, "italian_chicken", ["chicken"]);
    pushCuisineStyleIfMatched(styles, text, "italian_beef", ["beef"]);
    pushCuisineStyleIfMatched(styles, text, "italian_sausage", ["sausage"]);
    pushCuisineStyleIfMatched(styles, text, "italian_parmesan_cheese", ["parmesan", "cheese", "mozzarella", "ricotta"]);
    pushCuisineStyleIfMatched(styles, text, "italian_vegetarian", ["vegetarian", "veggie"]);
  }

  if (rootId === "mediterranean") {
    pushCuisineStyleIfMatched(styles, text, "mediterranean_lemon_herb", ["lemon", "herb", "oregano"]);
    pushCuisineStyleIfMatched(styles, text, "mediterranean_olive_oil", ["olive oil"]);
    pushCuisineStyleIfMatched(styles, text, "mediterranean_chickpeas_legumes", ["chickpea", "chickpeas", "lentil", "lentils", "bean", "beans"]);
    pushCuisineStyleIfMatched(styles, text, "mediterranean_fish_seafood", ["fish", "seafood", "cod", "salmon", "shrimp", "tuna"]);
    pushCuisineStyleIfMatched(styles, text, "mediterranean_chicken", ["chicken"]);
    pushCuisineStyleIfMatched(styles, text, "mediterranean_grain_bowls", ["rice bowl", "rice bowls", "grain bowl", "grain bowls"]);
    pushCuisineStyleIfMatched(styles, text, "mediterranean_orzo_couscous", ["orzo", "couscous"]);
    pushCuisineStyleIfMatched(styles, text, "mediterranean_yogurt_feta", ["yogurt", "feta"]);
    pushCuisineStyleIfMatched(styles, text, "mediterranean_grilled_kebabs", ["grilled", "kebab", "kebabs"]);
    pushCuisineStyleIfMatched(styles, text, "mediterranean_stewed_braised", ["stew", "stewed", "braised"]);
  }

  if (rootId === "middle_eastern") {
    pushCuisineStyleIfMatched(styles, text, "middle_eastern_hummus_chickpeas", ["hummus", "chickpea", "chickpeas"]);
    pushCuisineStyleIfMatched(styles, text, "middle_eastern_yogurt_tahini", ["yogurt", "tahini"]);
    pushCuisineStyleIfMatched(styles, text, "middle_eastern_shawarma", ["shawarma"]);
    pushCuisineStyleIfMatched(styles, text, "middle_eastern_kebabs", ["kebab", "kebabs"]);
    pushCuisineStyleIfMatched(styles, text, "middle_eastern_rice_bowls", ["rice bowl", "rice bowls", "bowl", "bowls"]);
    pushCuisineStyleIfMatched(styles, text, "middle_eastern_lentils", ["lentil", "lentils"]);
    pushCuisineStyleIfMatched(styles, text, "middle_eastern_chicken", ["chicken"]);
    pushCuisineStyleIfMatched(styles, text, "middle_eastern_lamb", ["lamb"]);
    pushCuisineStyleIfMatched(styles, text, "middle_eastern_vegetarian", ["vegetarian", "chickpea", "lentil"]);
  }

  return Array.from(new Set(styles));
}

export function deriveRecipeBrowserCuisinePath(
  cuisine: string | null | undefined,
  context?: RecipeBrowserCuisineDerivationContext,
): RecipeBrowserMvpCuisineId[] | null {
  const derivationText = buildCuisineDerivationText(cuisine, context);
  const rootId = getCuisineRootIdFromRawCuisine(cuisine, derivationText);
  if (!rootId) {
    return null;
  }

  const normalizedId = normalizeRecipeBrowserCuisineId(cuisine);
  const directPath = normalizedId && getRecipeBrowserCuisineRootId(normalizedId) === rootId ? [normalizedId] : [];
  return Array.from(new Set([rootId, ...directPath.filter((id) => id !== rootId), ...deriveCuisineStyleIds(rootId, derivationText)]));
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
