export const RECIPE_BROWSER_SCOPE_OPTIONS = [
  { id: "cook_now", label: "Cook Now" },
  { id: "almost_there", label: "Almost There" },
  { id: "pantry_stretch", label: "Pantry Stretch" },
  { id: "explore_all", label: "Explore All" },
] as const;

export type RecipeBrowserScopeId = (typeof RECIPE_BROWSER_SCOPE_OPTIONS)[number]["id"];

export const RECIPE_BROWSER_FILTER_FAMILY_REGISTRY = [
  { id: "ingredients", label: "Ingredients", enabled: true },
  { id: "cuisine", label: "Cuisine", enabled: true },
  { id: "time", label: "Time", enabled: true },
  { id: "effort", label: "Effort", enabled: false },
  { id: "method", label: "Method", enabled: true },
  { id: "cleanup", label: "Cleanup", enabled: false },
  { id: "diet", label: "Diet", enabled: false },
  { id: "protein", label: "Protein", enabled: false },
  { id: "household", label: "Household", enabled: false },
  { id: "cost", label: "Cost", enabled: false },
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

export const INGREDIENT_BROWSE_NODES = [
  {
    id: "chicken",
    label: "Chicken",
    categoryId: "proteins",
    subcategoryId: "poultry",
    aliases: ["chicken breast", "chicken thighs", "chicken thigh", "chicken tenderloins"],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["chicken"],
  },
  {
    id: "beef",
    label: "Beef",
    categoryId: "proteins",
    subcategoryId: "red_meat",
    aliases: ["ground beef", "steak", "beef strips"],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["beef"],
  },
  {
    id: "pork",
    label: "Pork",
    categoryId: "proteins",
    subcategoryId: "red_meat",
    aliases: ["pork chops", "pork tenderloin", "sausage", "bacon", "ham"],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["pork"],
  },
  {
    id: "seafood",
    label: "Seafood",
    categoryId: "proteins",
    subcategoryId: "seafood",
    aliases: ["shrimp", "salmon", "white fish", "tilapia", "tuna", "fish"],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["seafood"],
  },
  {
    id: "beans_legumes",
    label: "Beans & legumes",
    categoryId: "proteins",
    subcategoryId: "plant_protein",
    aliases: ["beans", "canned beans", "cooked beans", "lentils"],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["plant_protein"],
  },
  {
    id: "tofu_plant_protein",
    label: "Tofu & plant protein",
    categoryId: "proteins",
    subcategoryId: "plant_protein",
    aliases: ["tofu"],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["plant_protein"],
  },
  {
    id: "eggs",
    label: "Eggs",
    categoryId: "proteins",
    subcategoryId: "eggs",
    aliases: ["egg"],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["eggs"],
  },
  {
    id: "rice_grains",
    label: "Rice & grains",
    categoryId: "grains_starches",
    subcategoryId: "grains",
    aliases: ["rice", "quinoa", "couscous", "oats", "cornmeal", "flour"],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["grains_starches"],
  },
  {
    id: "pasta_noodles",
    label: "Pasta & noodles",
    categoryId: "grains_starches",
    subcategoryId: "pasta_noodles",
    aliases: ["pasta", "spaghetti", "linguine", "fettuccine", "egg noodles", "macaroni", "shells", "penne"],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["grains_starches"],
  },
  {
    id: "bread_wraps",
    label: "Bread & wraps",
    categoryId: "grains_starches",
    subcategoryId: "bread_wraps",
    aliases: ["bread", "burger buns", "sandwich rolls", "tortillas", "breadcrumbs"],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["grains_starches"],
  },
  {
    id: "potatoes",
    label: "Potatoes",
    categoryId: "grains_starches",
    subcategoryId: "starches",
    aliases: ["potatoes", "potato", "sweet potatoes", "sweet potato"],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["grains_starches"],
  },
  {
    id: "aromatics",
    label: "Aromatics",
    categoryId: "vegetables",
    subcategoryId: "aromatics",
    aliases: ["onion", "red onion", "yellow onion", "white onion", "green onion", "scallions", "garlic", "celery"],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["vegetables"],
  },
  {
    id: "peppers_chiles",
    label: "Peppers & chiles",
    categoryId: "vegetables",
    subcategoryId: "peppers",
    aliases: ["bell peppers", "bell pepper", "jalapenos", "jalapeno"],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["vegetables"],
  },
  {
    id: "leafy_greens",
    label: "Leafy greens",
    categoryId: "vegetables",
    subcategoryId: "greens",
    aliases: ["spinach", "kale", "lettuce", "romaine"],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["vegetables"],
  },
  {
    id: "brassicas",
    label: "Brassicas",
    categoryId: "vegetables",
    subcategoryId: "brassicas",
    aliases: ["broccoli", "cauliflower", "cabbage"],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["vegetables"],
  },
  {
    id: "tomatoes",
    label: "Tomatoes",
    categoryId: "vegetables",
    subcategoryId: "tomatoes",
    aliases: ["tomato", "cherry tomatoes", "grape tomatoes", "crushed tomatoes", "diced tomatoes"],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["vegetables"],
  },
  {
    id: "mushrooms",
    label: "Mushrooms",
    categoryId: "vegetables",
    subcategoryId: "mushrooms",
    aliases: ["mushrooms", "mushroom"],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["vegetables"],
  },
  {
    id: "cheese",
    label: "Cheese",
    categoryId: "dairy_creamy",
    subcategoryId: "cheese",
    aliases: ["cheese", "shredded cheddar", "shredded mozzarella", "mixed cheese", "parmesan", "sliced cheese", "cheddar"],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["dairy_creamy"],
  },
  {
    id: "milk_cream",
    label: "Milk / cream",
    categoryId: "dairy_creamy",
    subcategoryId: "milk_cream",
    aliases: ["milk", "heavy cream", "half-and-half", "sour cream", "cream cheese", "plain yogurt", "coconut milk"],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["dairy_creamy"],
  },
  {
    id: "fresh_herbs",
    label: "Fresh herbs",
    categoryId: "herbs_spices",
    subcategoryId: "fresh_herbs",
    aliases: ["cilantro", "parsley", "basil"],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["herbs_spices"],
  },
  {
    id: "dry_spices",
    label: "Dry spices",
    categoryId: "herbs_spices",
    subcategoryId: "dry_spices",
    aliases: ["salt", "black pepper", "garlic powder", "onion powder", "paprika", "italian seasoning", "chili powder", "cumin", "red pepper flakes"],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["herbs_spices"],
  },
  {
    id: "sauces",
    label: "Sauces",
    categoryId: "sauces_condiments",
    subcategoryId: "sauces",
    aliases: ["broth", "chicken broth", "beef broth", "vegetable broth", "tomato sauce", "pasta sauce", "soy sauce", "hot sauce", "mustard", "mayo", "ketchup", "peanut butter", "jam", "jelly"],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["sauces_condiments"],
  },
  {
    id: "oils_fats",
    label: "Oils & fats",
    categoryId: "sauces_condiments",
    subcategoryId: "oils_fats",
    aliases: ["oil", "olive oil", "butter", "vinegar"],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["oils_fats"],
  },
  {
    id: "citrus",
    label: "Citrus",
    categoryId: "vegetables",
    subcategoryId: "citrus",
    aliases: ["lemons", "lemon", "limes", "lime"],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["citrus"],
  },
  {
    id: "regional_sauces_pastes",
    label: "Regional sauces & pastes",
    categoryId: "sauces_condiments",
    subcategoryId: "regional_sauces",
    aliases: ["salsa", "pesto", "curry paste"],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["regional_sauces_pastes"],
  },
] as const;

export type RecipeBrowserIngredientNodeId =
  (typeof INGREDIENT_BROWSE_NODES)[number]["id"];

export type IngredientBrowseNode = (typeof INGREDIENT_BROWSE_NODES)[number];

export const CANONICAL_INGREDIENTS = [
  { id: "chicken", label: "chicken", categoryId: "proteins", subcategoryId: "poultry", aliases: [], browseNodeIds: ["chicken"], recommendationRollupIds: ["chicken"], visibility: "browse_and_search" },
  { id: "chicken_breast", label: "chicken breast", categoryId: "proteins", subcategoryId: "poultry", aliases: [], browseNodeIds: ["chicken"], recommendationRollupIds: ["chicken"], visibility: "search_only" },
  { id: "chicken_thighs", label: "chicken thighs", categoryId: "proteins", subcategoryId: "poultry", aliases: ["chicken thigh"], browseNodeIds: ["chicken"], recommendationRollupIds: ["chicken"], visibility: "search_only" },
  { id: "ground_beef", label: "ground beef", categoryId: "proteins", subcategoryId: "red_meat", aliases: ["beef"], browseNodeIds: ["beef"], recommendationRollupIds: ["beef"], visibility: "browse_and_search" },
  { id: "steak", label: "steak", categoryId: "proteins", subcategoryId: "red_meat", aliases: [], browseNodeIds: ["beef"], recommendationRollupIds: ["beef"], visibility: "search_only" },
  { id: "pork_chops", label: "pork chops", categoryId: "proteins", subcategoryId: "red_meat", aliases: [], browseNodeIds: ["pork"], recommendationRollupIds: ["pork"], visibility: "search_only" },
  { id: "sausage", label: "sausage", categoryId: "proteins", subcategoryId: "red_meat", aliases: [], browseNodeIds: ["pork"], recommendationRollupIds: ["pork"], visibility: "search_only" },
  { id: "bacon", label: "bacon", categoryId: "proteins", subcategoryId: "red_meat", aliases: [], browseNodeIds: ["pork"], recommendationRollupIds: ["pork"], visibility: "search_only" },
  { id: "shrimp", label: "shrimp", categoryId: "proteins", subcategoryId: "seafood", aliases: [], browseNodeIds: ["seafood"], recommendationRollupIds: ["seafood"], visibility: "search_only" },
  { id: "salmon", label: "salmon", categoryId: "proteins", subcategoryId: "seafood", aliases: [], browseNodeIds: ["seafood"], recommendationRollupIds: ["seafood"], visibility: "search_only" },
  { id: "eggs", label: "eggs", categoryId: "proteins", subcategoryId: "eggs", aliases: ["egg"], browseNodeIds: ["eggs"], recommendationRollupIds: ["eggs"], visibility: "browse_and_search" },
  { id: "tofu", label: "tofu", categoryId: "proteins", subcategoryId: "plant_protein", aliases: [], browseNodeIds: ["tofu_plant_protein"], recommendationRollupIds: ["plant_protein"], visibility: "browse_and_search" },
  { id: "canned_beans", label: "canned beans", categoryId: "proteins", subcategoryId: "plant_protein", aliases: ["beans"], browseNodeIds: ["beans_legumes"], recommendationRollupIds: ["plant_protein"], visibility: "search_only" },
  { id: "lentils", label: "lentils", categoryId: "proteins", subcategoryId: "plant_protein", aliases: [], browseNodeIds: ["beans_legumes"], recommendationRollupIds: ["plant_protein"], visibility: "search_only" },
  { id: "rice", label: "rice", categoryId: "grains_starches", subcategoryId: "grains", aliases: [], browseNodeIds: ["rice_grains"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "quinoa", label: "quinoa", categoryId: "grains_starches", subcategoryId: "grains", aliases: [], browseNodeIds: ["rice_grains"], recommendationRollupIds: ["grains_starches"], visibility: "search_only" },
  { id: "pasta", label: "pasta", categoryId: "grains_starches", subcategoryId: "pasta_noodles", aliases: [], browseNodeIds: ["pasta_noodles"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "spaghetti", label: "spaghetti", categoryId: "grains_starches", subcategoryId: "pasta_noodles", aliases: [], browseNodeIds: ["pasta_noodles"], recommendationRollupIds: ["grains_starches"], visibility: "search_only" },
  { id: "bread", label: "bread", categoryId: "grains_starches", subcategoryId: "bread_wraps", aliases: [], browseNodeIds: ["bread_wraps"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "tortillas", label: "tortillas", categoryId: "grains_starches", subcategoryId: "bread_wraps", aliases: ["tortilla"], browseNodeIds: ["bread_wraps"], recommendationRollupIds: ["grains_starches"], visibility: "search_only" },
  { id: "potatoes", label: "potatoes", categoryId: "grains_starches", subcategoryId: "starches", aliases: ["potato"], browseNodeIds: ["potatoes"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "sweet_potatoes", label: "sweet potatoes", categoryId: "grains_starches", subcategoryId: "starches", aliases: ["sweet potato"], browseNodeIds: ["potatoes"], recommendationRollupIds: ["grains_starches"], visibility: "search_only" },
  { id: "onion", label: "onion", categoryId: "vegetables", subcategoryId: "aromatics", aliases: ["red onion", "yellow onion", "white onion"], browseNodeIds: ["aromatics"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "garlic", label: "garlic", categoryId: "vegetables", subcategoryId: "aromatics", aliases: ["green onion", "scallions"], browseNodeIds: ["aromatics"], recommendationRollupIds: ["vegetables"], visibility: "search_only" },
  { id: "bell_peppers", label: "bell peppers", categoryId: "vegetables", subcategoryId: "peppers", aliases: ["bell pepper"], browseNodeIds: ["peppers_chiles"], recommendationRollupIds: ["vegetables"], visibility: "search_only" },
  { id: "jalapenos", label: "jalapenos", categoryId: "vegetables", subcategoryId: "peppers", aliases: ["jalapeno"], browseNodeIds: ["peppers_chiles"], recommendationRollupIds: ["vegetables"], visibility: "search_only" },
  { id: "spinach", label: "spinach", categoryId: "vegetables", subcategoryId: "greens", aliases: ["kale", "lettuce", "romaine"], browseNodeIds: ["leafy_greens"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "broccoli", label: "broccoli", categoryId: "vegetables", subcategoryId: "brassicas", aliases: ["cauliflower", "cabbage"], browseNodeIds: ["brassicas"], recommendationRollupIds: ["vegetables"], visibility: "search_only" },
  { id: "tomato", label: "tomato", categoryId: "vegetables", subcategoryId: "tomatoes", aliases: ["cherry tomatoes", "grape tomatoes"], browseNodeIds: ["tomatoes"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "mushrooms", label: "mushrooms", categoryId: "vegetables", subcategoryId: "mushrooms", aliases: ["mushroom"], browseNodeIds: ["mushrooms"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "lemons", label: "lemons", categoryId: "vegetables", subcategoryId: "citrus", aliases: ["lemon"], browseNodeIds: ["citrus"], recommendationRollupIds: ["citrus"], visibility: "search_only" },
  { id: "limes", label: "limes", categoryId: "vegetables", subcategoryId: "citrus", aliases: ["lime"], browseNodeIds: ["citrus"], recommendationRollupIds: ["citrus"], visibility: "search_only" },
  { id: "milk", label: "milk", categoryId: "dairy_creamy", subcategoryId: "milk_cream", aliases: ["heavy cream", "half-and-half", "sour cream", "cream cheese", "plain yogurt"], browseNodeIds: ["milk_cream"], recommendationRollupIds: ["dairy_creamy"], visibility: "browse_and_search" },
  { id: "cheese", label: "cheese", categoryId: "dairy_creamy", subcategoryId: "cheese", aliases: ["shredded cheddar", "shredded mozzarella", "mixed cheese", "parmesan", "sliced cheese", "cheddar"], browseNodeIds: ["cheese"], recommendationRollupIds: ["dairy_creamy"], visibility: "browse_and_search" },
  { id: "butter", label: "butter", categoryId: "dairy_creamy", subcategoryId: "milk_cream", aliases: [], browseNodeIds: ["oils_fats"], recommendationRollupIds: ["dairy_creamy"], visibility: "browse_and_search" },
  { id: "salt", label: "salt", categoryId: "herbs_spices", subcategoryId: "dry_spices", aliases: ["onion powder", "paprika", "italian seasoning", "chili powder", "cumin", "red pepper flakes"], browseNodeIds: ["dry_spices"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "black_pepper", label: "black pepper", categoryId: "herbs_spices", subcategoryId: "dry_spices", aliases: [], browseNodeIds: ["dry_spices"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "garlic_powder", label: "garlic powder", categoryId: "herbs_spices", subcategoryId: "dry_spices", aliases: [], browseNodeIds: ["dry_spices"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "cilantro", label: "cilantro", categoryId: "herbs_spices", subcategoryId: "fresh_herbs", aliases: ["parsley", "basil"], browseNodeIds: ["fresh_herbs"], recommendationRollupIds: ["herbs_spices"], visibility: "search_only" },
  { id: "broth", label: "broth", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: ["chicken broth", "beef broth", "vegetable broth"], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "browse_and_search" },
  { id: "tomato_sauce", label: "tomato sauce", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: ["pasta sauce"], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "browse_and_search" },
  { id: "soy_sauce", label: "soy sauce", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: ["hot sauce", "mustard", "mayo", "ketchup", "peanut butter", "jam", "jelly"], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "browse_and_search" },
  { id: "oil", label: "oil", categoryId: "sauces_condiments", subcategoryId: "oils_fats", aliases: ["olive oil", "cooking oil", "vinegar"], browseNodeIds: ["oils_fats"], recommendationRollupIds: ["oils_fats"], visibility: "browse_and_search" },
  { id: "salsa", label: "salsa", categoryId: "sauces_condiments", subcategoryId: "regional_sauces", aliases: ["pesto", "curry paste"], browseNodeIds: ["regional_sauces_pastes"], recommendationRollupIds: ["regional_sauces_pastes"], visibility: "search_only" },
] as const;

export type CanonicalIngredient = (typeof CANONICAL_INGREDIENTS)[number];

const INGREDIENT_NODE_ALIAS_MAP = new Map<string, RecipeBrowserIngredientNodeId>();

for (const node of INGREDIENT_BROWSE_NODES) {
  INGREDIENT_NODE_ALIAS_MAP.set(node.id, node.id);
  INGREDIENT_NODE_ALIAS_MAP.set(node.label.toLowerCase(), node.id);
  for (const alias of node.aliases) {
    INGREDIENT_NODE_ALIAS_MAP.set(alias.toLowerCase(), node.id);
  }
}

for (const ingredient of CANONICAL_INGREDIENTS) {
  for (const browseNodeId of ingredient.browseNodeIds) {
    INGREDIENT_NODE_ALIAS_MAP.set(ingredient.label.toLowerCase(), browseNodeId);
    for (const alias of ingredient.aliases) {
      INGREDIENT_NODE_ALIAS_MAP.set(alias.toLowerCase(), browseNodeId);
    }
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
