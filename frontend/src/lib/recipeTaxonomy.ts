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
  { id: "protein", label: "Protein", enabled: true },
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

export const INGREDIENT_BROWSE_NODES = [
  {
    id: "chicken",
    label: "Chicken & poultry",
    categoryId: "proteins",
    subcategoryId: "poultry",
    aliases: ["chicken"],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["chicken"],
  },
  {
    id: "beef",
    label: "Beef",
    categoryId: "proteins",
    subcategoryId: "red_meat",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["beef"],
  },
  {
    id: "pork",
    label: "Pork",
    categoryId: "proteins",
    subcategoryId: "red_meat",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["pork"],
  },
  {
    id: "seafood",
    label: "Seafood",
    categoryId: "proteins",
    subcategoryId: "seafood",
    aliases: ["fish"],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["seafood"],
  },
  {
    id: "beans_legumes",
    label: "Beans & legumes",
    categoryId: "proteins",
    subcategoryId: "plant_protein",
    aliases: ["beans"],
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
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["grains_starches"],
  },
  {
    id: "pasta_noodles",
    label: "Pasta & noodles",
    categoryId: "grains_starches",
    subcategoryId: "pasta_noodles",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["grains_starches"],
  },
  {
    id: "bread_wraps",
    label: "Bread & wraps",
    categoryId: "grains_starches",
    subcategoryId: "bread_wraps",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["grains_starches"],
  },
  {
    id: "potatoes",
    label: "Potatoes",
    categoryId: "grains_starches",
    subcategoryId: "starches",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["grains_starches"],
  },
  {
    id: "aromatics",
    label: "Aromatics",
    categoryId: "vegetables",
    subcategoryId: "aromatics",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["vegetables"],
  },
  {
    id: "peppers_chiles",
    label: "Peppers & chiles",
    categoryId: "vegetables",
    subcategoryId: "peppers",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["vegetables"],
  },
  {
    id: "leafy_greens",
    label: "Leafy greens",
    categoryId: "vegetables",
    subcategoryId: "greens",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["vegetables"],
  },
  {
    id: "brassicas",
    label: "Brassicas",
    categoryId: "vegetables",
    subcategoryId: "brassicas",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["vegetables"],
  },
  {
    id: "tomatoes",
    label: "Tomatoes",
    categoryId: "vegetables",
    subcategoryId: "tomatoes",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["vegetables"],
  },
  {
    id: "mushrooms",
    label: "Mushrooms",
    categoryId: "vegetables",
    subcategoryId: "mushrooms",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["vegetables"],
  },
  {
    id: "cheese",
    label: "Cheese",
    categoryId: "dairy_creamy",
    subcategoryId: "cheese",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["dairy_creamy"],
  },
  {
    id: "milk_cream",
    label: "Milk / cream",
    categoryId: "dairy_creamy",
    subcategoryId: "milk_cream",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["dairy_creamy"],
  },
  {
    id: "fresh_herbs",
    label: "Fresh herbs",
    categoryId: "herbs_spices",
    subcategoryId: "fresh_herbs",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["herbs_spices"],
  },
  {
    id: "dry_spices",
    label: "Dry spices",
    categoryId: "herbs_spices",
    subcategoryId: "dry_spices",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["herbs_spices"],
  },
  {
    id: "sauces",
    label: "Sauces",
    categoryId: "sauces_condiments",
    subcategoryId: "sauces",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["sauces_condiments"],
  },
  {
    id: "oils_fats",
    label: "Oils & fats",
    categoryId: "sauces_condiments",
    subcategoryId: "oils_fats",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: true,
    recommendationRollupIds: ["oils_fats"],
  },
  {
    id: "citrus",
    label: "Citrus",
    categoryId: "vegetables",
    subcategoryId: "citrus",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["citrus"],
  },
  {
    id: "regional_sauces_pastes",
    label: "Regional sauces & pastes",
    categoryId: "sauces_condiments",
    subcategoryId: "regional_sauces",
    aliases: [],
    visibleInBrowser: true,
    visibleInQuickPick: false,
    recommendationRollupIds: ["regional_sauces_pastes"],
  },
] as const;

export type RecipeBrowserIngredientNodeId =
  (typeof INGREDIENT_BROWSE_NODES)[number]["id"];

export type IngredientBrowseNode = (typeof INGREDIENT_BROWSE_NODES)[number];
export type ProteinBrowseNode = Extract<IngredientBrowseNode, { id: RecipeBrowserProteinBrowseNodeId }>;

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

export const CANONICAL_INGREDIENTS = [
  { id: "chicken", label: "chicken", categoryId: "proteins", subcategoryId: "poultry", aliases: [], browseNodeIds: ["chicken"], recommendationRollupIds: ["chicken"], visibility: "browse_and_search" },
  { id: "chicken_breast", label: "chicken breast", categoryId: "proteins", subcategoryId: "poultry", aliases: ["chicken breasts"], browseNodeIds: ["chicken"], recommendationRollupIds: ["chicken"], visibility: "browse_and_search" },
  { id: "chicken_thighs", label: "chicken thighs", categoryId: "proteins", subcategoryId: "poultry", aliases: ["chicken thigh"], browseNodeIds: ["chicken"], recommendationRollupIds: ["chicken"], visibility: "browse_and_search" },
  { id: "ground_chicken", label: "ground chicken", categoryId: "proteins", subcategoryId: "poultry", aliases: ["minced chicken"], browseNodeIds: ["chicken"], recommendationRollupIds: ["chicken"], visibility: "browse_and_search" },
  { id: "turkey", label: "turkey", categoryId: "proteins", subcategoryId: "poultry", aliases: [], browseNodeIds: ["chicken"], recommendationRollupIds: ["chicken"], visibility: "browse_and_search" },
  { id: "ground_turkey", label: "ground turkey", categoryId: "proteins", subcategoryId: "poultry", aliases: [], browseNodeIds: ["chicken"], recommendationRollupIds: ["chicken"], visibility: "browse_and_search" },
  { id: "beef", label: "beef", categoryId: "proteins", subcategoryId: "red_meat", aliases: [], browseNodeIds: ["beef"], recommendationRollupIds: ["beef"], visibility: "browse_and_search" },
  { id: "ground_beef", label: "ground beef", categoryId: "proteins", subcategoryId: "red_meat", aliases: ["hamburger meat"], browseNodeIds: ["beef"], recommendationRollupIds: ["beef"], visibility: "browse_and_search" },
  { id: "steak", label: "steak", categoryId: "proteins", subcategoryId: "red_meat", aliases: ["beef steak", "beef strip", "beef strips", "steak strip", "steak strips", "sliced steak", "thinly sliced steak"], browseNodeIds: ["beef"], recommendationRollupIds: ["beef"], visibility: "browse_and_search" },
  { id: "pork", label: "pork", categoryId: "proteins", subcategoryId: "red_meat", aliases: [], browseNodeIds: ["pork"], recommendationRollupIds: ["pork"], visibility: "browse_and_search" },
  { id: "pork_chops", label: "pork chops", categoryId: "proteins", subcategoryId: "red_meat", aliases: ["pork chop"], browseNodeIds: ["pork"], recommendationRollupIds: ["pork"], visibility: "browse_and_search" },
  { id: "sausage", label: "sausage", categoryId: "proteins", subcategoryId: "red_meat", aliases: ["italian sausage", "breakfast sausage"], browseNodeIds: ["pork"], recommendationRollupIds: ["pork"], visibility: "browse_and_search" },
  { id: "bacon", label: "bacon", categoryId: "proteins", subcategoryId: "red_meat", aliases: [], browseNodeIds: ["pork"], recommendationRollupIds: ["pork"], visibility: "browse_and_search" },
  { id: "ham", label: "ham", categoryId: "proteins", subcategoryId: "red_meat", aliases: [], browseNodeIds: ["pork"], recommendationRollupIds: ["pork"], visibility: "browse_and_search" },
  { id: "seafood", label: "seafood", categoryId: "proteins", subcategoryId: "seafood", aliases: ["fish"], browseNodeIds: ["seafood"], recommendationRollupIds: ["seafood"], visibility: "browse_and_search" },
  { id: "shrimp", label: "shrimp", categoryId: "proteins", subcategoryId: "seafood", aliases: [], browseNodeIds: ["seafood"], recommendationRollupIds: ["seafood"], visibility: "browse_and_search" },
  { id: "salmon", label: "salmon", categoryId: "proteins", subcategoryId: "seafood", aliases: [], browseNodeIds: ["seafood"], recommendationRollupIds: ["seafood"], visibility: "browse_and_search" },
  { id: "tuna", label: "tuna", categoryId: "proteins", subcategoryId: "seafood", aliases: ["canned tuna"], browseNodeIds: ["seafood"], recommendationRollupIds: ["seafood"], visibility: "browse_and_search" },
  { id: "cod", label: "cod", categoryId: "proteins", subcategoryId: "seafood", aliases: [], browseNodeIds: ["seafood"], recommendationRollupIds: ["seafood"], visibility: "browse_and_search" },
  { id: "tilapia", label: "tilapia", categoryId: "proteins", subcategoryId: "seafood", aliases: [], browseNodeIds: ["seafood"], recommendationRollupIds: ["seafood"], visibility: "browse_and_search" },
  { id: "white_fish", label: "white fish", categoryId: "proteins", subcategoryId: "seafood", aliases: ["whitefish", "catfish", "bass", "sea bass"], browseNodeIds: ["seafood"], recommendationRollupIds: ["seafood"], visibility: "browse_and_search" },
  { id: "eggs", label: "eggs", categoryId: "proteins", subcategoryId: "eggs", aliases: ["egg"], browseNodeIds: ["eggs"], recommendationRollupIds: ["eggs"], visibility: "browse_and_search" },
  { id: "tofu", label: "tofu", categoryId: "proteins", subcategoryId: "plant_protein", aliases: [], browseNodeIds: ["tofu_plant_protein"], recommendationRollupIds: ["plant_protein"], visibility: "browse_and_search" },
  { id: "edamame", label: "edamame", categoryId: "proteins", subcategoryId: "plant_protein", aliases: [], browseNodeIds: ["tofu_plant_protein"], recommendationRollupIds: ["plant_protein"], visibility: "browse_and_search" },
  { id: "beans", label: "beans", categoryId: "proteins", subcategoryId: "plant_protein", aliases: ["bean"], browseNodeIds: ["beans_legumes"], recommendationRollupIds: ["plant_protein"], visibility: "browse_and_search" },
  { id: "black_beans", label: "black beans", categoryId: "proteins", subcategoryId: "plant_protein", aliases: ["black bean"], browseNodeIds: ["beans_legumes"], recommendationRollupIds: ["plant_protein"], visibility: "browse_and_search" },
  { id: "white_beans", label: "white beans", categoryId: "proteins", subcategoryId: "plant_protein", aliases: ["white bean"], browseNodeIds: ["beans_legumes"], recommendationRollupIds: ["plant_protein"], visibility: "browse_and_search" },
  { id: "pinto_beans", label: "pinto beans", categoryId: "proteins", subcategoryId: "plant_protein", aliases: ["pinto bean"], browseNodeIds: ["beans_legumes"], recommendationRollupIds: ["plant_protein"], visibility: "browse_and_search" },
  { id: "canned_beans", label: "canned beans", categoryId: "proteins", subcategoryId: "plant_protein", aliases: ["canned bean", "beans canned"], browseNodeIds: ["beans_legumes"], recommendationRollupIds: ["plant_protein"], visibility: "browse_and_search" },
  { id: "chickpeas", label: "chickpeas", categoryId: "proteins", subcategoryId: "plant_protein", aliases: ["chickpea", "garbanzo", "garbanzo bean", "garbanzo beans", "garbanzos"], browseNodeIds: ["beans_legumes"], recommendationRollupIds: ["plant_protein"], visibility: "browse_and_search" },
  { id: "lentils", label: "lentils", categoryId: "proteins", subcategoryId: "plant_protein", aliases: ["lentil"], browseNodeIds: ["beans_legumes"], recommendationRollupIds: ["plant_protein"], visibility: "browse_and_search" },
  { id: "rice", label: "rice", categoryId: "grains_starches", subcategoryId: "grains", aliases: ["white rice", "brown rice", "jasmine rice", "basmati rice"], browseNodeIds: ["rice_grains"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "quinoa", label: "quinoa", categoryId: "grains_starches", subcategoryId: "grains", aliases: [], browseNodeIds: ["rice_grains"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "couscous", label: "couscous", categoryId: "grains_starches", subcategoryId: "grains", aliases: [], browseNodeIds: ["rice_grains"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "pasta", label: "pasta", categoryId: "grains_starches", subcategoryId: "pasta_noodles", aliases: ["macaroni", "penne", "linguine", "fettuccine", "shells", "orzo", "tortellini", "ziti"], browseNodeIds: ["pasta_noodles"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "spaghetti", label: "spaghetti", categoryId: "grains_starches", subcategoryId: "pasta_noodles", aliases: ["spaghetti noodles"], browseNodeIds: ["pasta_noodles"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "noodles", label: "noodles", categoryId: "grains_starches", subcategoryId: "pasta_noodles", aliases: ["egg noodles", "udon", "udon noodles", "lo mein", "lo mein noodle", "lo mein noodles", "rice noodle", "rice noodles"], browseNodeIds: ["pasta_noodles"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "ramen_noodles", label: "ramen noodles", categoryId: "grains_starches", subcategoryId: "pasta_noodles", aliases: ["ramen"], browseNodeIds: ["pasta_noodles"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "ravioli", label: "ravioli", categoryId: "grains_starches", subcategoryId: "pasta_noodles", aliases: [], browseNodeIds: ["pasta_noodles"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "bread", label: "bread", categoryId: "grains_starches", subcategoryId: "bread_wraps", aliases: ["sliced bread", "sandwich bread"], browseNodeIds: ["bread_wraps"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "flour_tortillas", label: "flour tortillas", categoryId: "grains_starches", subcategoryId: "bread_wraps", aliases: ["flour tortilla"], browseNodeIds: ["bread_wraps"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "corn_tortillas", label: "corn tortillas", categoryId: "grains_starches", subcategoryId: "bread_wraps", aliases: ["corn tortilla", "corn tortillas", "tostada", "tostadas"], browseNodeIds: ["bread_wraps"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "pita", label: "pita", categoryId: "grains_starches", subcategoryId: "bread_wraps", aliases: [], browseNodeIds: ["bread_wraps"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "buns", label: "buns", categoryId: "grains_starches", subcategoryId: "bread_wraps", aliases: ["burger buns", "burger bun", "sandwich rolls", "sandwich roll", "rolls"], browseNodeIds: ["bread_wraps"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "breadcrumbs", label: "breadcrumbs", categoryId: "grains_starches", subcategoryId: "bread_wraps", aliases: ["bread crumbs", "panko", "panko breadcrumbs"], browseNodeIds: ["bread_wraps"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "potatoes", label: "potatoes", categoryId: "grains_starches", subcategoryId: "starches", aliases: ["potato"], browseNodeIds: ["potatoes"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "sweet_potatoes", label: "sweet potatoes", categoryId: "grains_starches", subcategoryId: "starches", aliases: ["sweet potato"], browseNodeIds: ["potatoes"], recommendationRollupIds: ["grains_starches"], visibility: "browse_and_search" },
  { id: "onion", label: "onion", categoryId: "vegetables", subcategoryId: "aromatics", aliases: ["red onion", "yellow onion", "white onion"], browseNodeIds: ["aromatics"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "garlic", label: "garlic", categoryId: "vegetables", subcategoryId: "aromatics", aliases: ["garlic clove", "garlic cloves", "minced garlic"], browseNodeIds: ["aromatics"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "green_onion", label: "green onion", categoryId: "vegetables", subcategoryId: "aromatics", aliases: ["green onions", "scallion", "scallions", "spring onion", "spring onions"], browseNodeIds: ["aromatics"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "ginger", label: "ginger", categoryId: "vegetables", subcategoryId: "aromatics", aliases: [], browseNodeIds: ["aromatics"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "celery", label: "celery", categoryId: "vegetables", subcategoryId: "aromatics", aliases: ["celery stalk", "celery stalks"], browseNodeIds: ["aromatics"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "bell_peppers", label: "bell peppers", categoryId: "vegetables", subcategoryId: "peppers", aliases: ["bell pepper", "green bell pepper", "red bell pepper", "yellow bell pepper", "capsicum"], browseNodeIds: ["peppers_chiles"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "jalapenos", label: "jalapenos", categoryId: "vegetables", subcategoryId: "peppers", aliases: ["jalapeno"], browseNodeIds: ["peppers_chiles"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "poblano", label: "poblano", categoryId: "vegetables", subcategoryId: "peppers", aliases: ["poblanos"], browseNodeIds: ["peppers_chiles"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "green_chiles", label: "green chiles", categoryId: "vegetables", subcategoryId: "peppers", aliases: ["green chile"], browseNodeIds: ["peppers_chiles"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "spinach", label: "spinach", categoryId: "vegetables", subcategoryId: "greens", aliases: [], browseNodeIds: ["leafy_greens"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "kale", label: "kale", categoryId: "vegetables", subcategoryId: "greens", aliases: [], browseNodeIds: ["leafy_greens"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "lettuce", label: "lettuce", categoryId: "vegetables", subcategoryId: "greens", aliases: ["romaine"], browseNodeIds: ["leafy_greens"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "bok_choy", label: "bok choy", categoryId: "vegetables", subcategoryId: "greens", aliases: [], browseNodeIds: ["leafy_greens"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "broccoli", label: "broccoli", categoryId: "vegetables", subcategoryId: "brassicas", aliases: [], browseNodeIds: ["brassicas"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "cabbage", label: "cabbage", categoryId: "vegetables", subcategoryId: "brassicas", aliases: [], browseNodeIds: ["brassicas"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "cauliflower", label: "cauliflower", categoryId: "vegetables", subcategoryId: "brassicas", aliases: [], browseNodeIds: ["brassicas"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "tomato", label: "tomato", categoryId: "vegetables", subcategoryId: "tomatoes", aliases: ["tomatoes", "roma tomato"], browseNodeIds: ["tomatoes"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "cherry_tomatoes", label: "cherry tomatoes", categoryId: "vegetables", subcategoryId: "tomatoes", aliases: ["cherry tomato", "grape tomato", "grape tomatoes"], browseNodeIds: ["tomatoes"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "diced_tomatoes", label: "diced tomatoes", categoryId: "vegetables", subcategoryId: "tomatoes", aliases: [], browseNodeIds: ["tomatoes"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "crushed_tomatoes", label: "crushed tomatoes", categoryId: "vegetables", subcategoryId: "tomatoes", aliases: [], browseNodeIds: ["tomatoes"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "tomato_paste", label: "tomato paste", categoryId: "vegetables", subcategoryId: "tomatoes", aliases: [], browseNodeIds: ["tomatoes"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "mushrooms", label: "mushrooms", categoryId: "vegetables", subcategoryId: "mushrooms", aliases: ["mushroom"], browseNodeIds: ["mushrooms"], recommendationRollupIds: ["vegetables"], visibility: "browse_and_search" },
  { id: "lemons", label: "lemons", categoryId: "vegetables", subcategoryId: "citrus", aliases: ["lemon"], browseNodeIds: ["citrus"], recommendationRollupIds: ["citrus"], visibility: "browse_and_search" },
  { id: "limes", label: "limes", categoryId: "vegetables", subcategoryId: "citrus", aliases: ["lime"], browseNodeIds: ["citrus"], recommendationRollupIds: ["citrus"], visibility: "browse_and_search" },
  { id: "milk", label: "milk", categoryId: "dairy_creamy", subcategoryId: "milk_cream", aliases: ["whole milk", "2% milk", "skim milk"], browseNodeIds: ["milk_cream"], recommendationRollupIds: ["dairy_creamy"], visibility: "browse_and_search" },
  { id: "cream", label: "cream", categoryId: "dairy_creamy", subcategoryId: "milk_cream", aliases: ["heavy cream", "half-and-half", "half and half", "half & half"], browseNodeIds: ["milk_cream"], recommendationRollupIds: ["dairy_creamy"], visibility: "browse_and_search" },
  { id: "sour_cream", label: "sour cream", categoryId: "dairy_creamy", subcategoryId: "milk_cream", aliases: [], browseNodeIds: ["milk_cream"], recommendationRollupIds: ["dairy_creamy"], visibility: "browse_and_search" },
  { id: "yogurt", label: "yogurt", categoryId: "dairy_creamy", subcategoryId: "milk_cream", aliases: ["plain yogurt", "plain yoghurt"], browseNodeIds: ["milk_cream"], recommendationRollupIds: ["dairy_creamy"], visibility: "browse_and_search" },
  { id: "cream_cheese", label: "cream cheese", categoryId: "dairy_creamy", subcategoryId: "milk_cream", aliases: [], browseNodeIds: ["milk_cream"], recommendationRollupIds: ["dairy_creamy"], visibility: "browse_and_search" },
  { id: "cheese", label: "cheese", categoryId: "dairy_creamy", subcategoryId: "cheese", aliases: ["mixed cheese", "sliced cheese", "shredded cheese"], browseNodeIds: ["cheese"], recommendationRollupIds: ["dairy_creamy"], visibility: "browse_and_search" },
  { id: "cheddar", label: "cheddar", categoryId: "dairy_creamy", subcategoryId: "cheese", aliases: ["cheddar cheese", "shredded cheddar"], browseNodeIds: ["cheese"], recommendationRollupIds: ["dairy_creamy"], visibility: "browse_and_search" },
  { id: "mozzarella", label: "mozzarella", categoryId: "dairy_creamy", subcategoryId: "cheese", aliases: ["mozzarella cheese", "shredded mozzarella"], browseNodeIds: ["cheese"], recommendationRollupIds: ["dairy_creamy"], visibility: "browse_and_search" },
  { id: "parmesan", label: "parmesan", categoryId: "dairy_creamy", subcategoryId: "cheese", aliases: ["parmesan cheese"], browseNodeIds: ["cheese"], recommendationRollupIds: ["dairy_creamy"], visibility: "browse_and_search" },
  { id: "feta", label: "feta", categoryId: "dairy_creamy", subcategoryId: "cheese", aliases: ["feta cheese"], browseNodeIds: ["cheese"], recommendationRollupIds: ["dairy_creamy"], visibility: "browse_and_search" },
  { id: "butter", label: "butter", categoryId: "dairy_creamy", subcategoryId: "milk_cream", aliases: ["salted butter", "unsalted butter"], browseNodeIds: ["oils_fats"], recommendationRollupIds: ["dairy_creamy"], visibility: "browse_and_search" },
  { id: "salt", label: "salt", categoryId: "herbs_spices", subcategoryId: "dry_spices", aliases: ["sea salt", "kosher salt", "table salt"], browseNodeIds: ["dry_spices"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "black_pepper", label: "black pepper", categoryId: "herbs_spices", subcategoryId: "dry_spices", aliases: ["ground pepper", "pepper"], browseNodeIds: ["dry_spices"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "garlic_powder", label: "garlic powder", categoryId: "herbs_spices", subcategoryId: "dry_spices", aliases: [], browseNodeIds: ["dry_spices"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "onion_powder", label: "onion powder", categoryId: "herbs_spices", subcategoryId: "dry_spices", aliases: [], browseNodeIds: ["dry_spices"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "paprika", label: "paprika", categoryId: "herbs_spices", subcategoryId: "dry_spices", aliases: [], browseNodeIds: ["dry_spices"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "smoked_paprika", label: "smoked paprika", categoryId: "herbs_spices", subcategoryId: "dry_spices", aliases: [], browseNodeIds: ["dry_spices"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "chili_powder", label: "chili powder", categoryId: "herbs_spices", subcategoryId: "dry_spices", aliases: [], browseNodeIds: ["dry_spices"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "cumin", label: "cumin", categoryId: "herbs_spices", subcategoryId: "dry_spices", aliases: [], browseNodeIds: ["dry_spices"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "oregano", label: "oregano", categoryId: "herbs_spices", subcategoryId: "dry_spices", aliases: ["italian seasoning", "dried oregano"], browseNodeIds: ["dry_spices"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "curry_powder", label: "curry powder", categoryId: "herbs_spices", subcategoryId: "dry_spices", aliases: [], browseNodeIds: ["dry_spices"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "red_pepper_flakes", label: "red pepper flakes", categoryId: "herbs_spices", subcategoryId: "dry_spices", aliases: [], browseNodeIds: ["dry_spices"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "cilantro", label: "cilantro", categoryId: "herbs_spices", subcategoryId: "fresh_herbs", aliases: ["coriander"], browseNodeIds: ["fresh_herbs"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "parsley", label: "parsley", categoryId: "herbs_spices", subcategoryId: "fresh_herbs", aliases: [], browseNodeIds: ["fresh_herbs"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "basil", label: "basil", categoryId: "herbs_spices", subcategoryId: "fresh_herbs", aliases: [], browseNodeIds: ["fresh_herbs"], recommendationRollupIds: ["herbs_spices"], visibility: "browse_and_search" },
  { id: "broth", label: "broth", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: [], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "browse_and_search" },
  { id: "chicken_broth", label: "chicken broth", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: ["chicken stock"], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "search_only" },
  { id: "beef_broth", label: "beef broth", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: ["beef stock"], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "search_only" },
  { id: "vegetable_broth", label: "vegetable broth", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: ["vegetable stock", "veggie broth", "veggie stock"], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "search_only" },
  { id: "stock", label: "stock", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: [], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "search_only" },
  { id: "tomato_sauce", label: "tomato sauce", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: [], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "browse_and_search" },
  { id: "soy_sauce", label: "soy sauce", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: [], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "browse_and_search" },
  { id: "hot_sauce", label: "hot sauce", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: [], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "browse_and_search" },
  { id: "mustard", label: "mustard", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: [], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "browse_and_search" },
  { id: "mayo", label: "mayo", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: ["mayonnaise"], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "browse_and_search" },
  { id: "bbq_sauce", label: "bbq sauce", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: ["barbecue sauce"], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "browse_and_search" },
  { id: "salsa", label: "salsa", categoryId: "sauces_condiments", subcategoryId: "regional_sauces", aliases: [], browseNodeIds: ["regional_sauces_pastes"], recommendationRollupIds: ["sauces_condiments", "regional_sauces_pastes"], visibility: "browse_and_search" },
  { id: "pesto", label: "pesto", categoryId: "sauces_condiments", subcategoryId: "regional_sauces", aliases: [], browseNodeIds: ["regional_sauces_pastes"], recommendationRollupIds: ["sauces_condiments", "regional_sauces_pastes"], visibility: "browse_and_search" },
  { id: "marinara", label: "marinara", categoryId: "sauces_condiments", subcategoryId: "regional_sauces", aliases: ["marinara sauce", "pasta sauce"], browseNodeIds: ["regional_sauces_pastes"], recommendationRollupIds: ["sauces_condiments", "regional_sauces_pastes"], visibility: "browse_and_search" },
  { id: "enchilada_sauce", label: "enchilada sauce", categoryId: "sauces_condiments", subcategoryId: "regional_sauces", aliases: ["red enchilada sauce"], browseNodeIds: ["regional_sauces_pastes"], recommendationRollupIds: ["regional_sauces_pastes"], visibility: "browse_and_search" },
  { id: "teriyaki_sauce", label: "teriyaki sauce", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: [], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "browse_and_search" },
  { id: "sriracha", label: "sriracha", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: [], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "browse_and_search" },
  { id: "worcestershire_sauce", label: "worcestershire sauce", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: ["worcestershire"], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "search_only" },
  { id: "ketchup", label: "ketchup", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: [], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "search_only" },
  { id: "peanut_butter", label: "peanut butter", categoryId: "sauces_condiments", subcategoryId: "sauces", aliases: [], browseNodeIds: ["sauces"], recommendationRollupIds: ["sauces_condiments"], visibility: "search_only" },
  { id: "oil", label: "oil", categoryId: "sauces_condiments", subcategoryId: "oils_fats", aliases: ["cooking oil", "vegetable oil", "canola oil"], browseNodeIds: ["oils_fats"], recommendationRollupIds: ["oils_fats"], visibility: "browse_and_search" },
  { id: "olive_oil", label: "olive oil", categoryId: "sauces_condiments", subcategoryId: "oils_fats", aliases: ["extra virgin olive oil"], browseNodeIds: ["oils_fats"], recommendationRollupIds: ["oils_fats"], visibility: "browse_and_search" },
  { id: "sesame_oil", label: "sesame oil", categoryId: "sauces_condiments", subcategoryId: "oils_fats", aliases: [], browseNodeIds: ["oils_fats"], recommendationRollupIds: ["oils_fats"], visibility: "browse_and_search" },
  { id: "vinegar", label: "vinegar", categoryId: "sauces_condiments", subcategoryId: "oils_fats", aliases: [], browseNodeIds: ["oils_fats"], recommendationRollupIds: ["oils_fats"], visibility: "search_only" },
  { id: "miso", label: "miso", categoryId: "sauces_condiments", subcategoryId: "regional_sauces", aliases: [], browseNodeIds: ["regional_sauces_pastes"], recommendationRollupIds: ["regional_sauces_pastes"], visibility: "browse_and_search" },
  { id: "salsa_verde", label: "salsa verde", categoryId: "sauces_condiments", subcategoryId: "regional_sauces", aliases: [], browseNodeIds: ["regional_sauces_pastes"], recommendationRollupIds: ["regional_sauces_pastes"], visibility: "browse_and_search" },
] as const satisfies readonly CanonicalIngredientDefinition[];

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
