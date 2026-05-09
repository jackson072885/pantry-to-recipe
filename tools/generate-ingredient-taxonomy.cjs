const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const CATALOG_PATH = path.join(REPO_ROOT, "backend", "app", "data", "ingredient_catalog_v1.json");
const OUTPUT_PATH = path.join(REPO_ROOT, "frontend", "src", "lib", "generatedIngredientTaxonomy.ts");

const COMPATIBILITY_ITEMS = {
  bell_pepper: { frontendId: "bell_peppers", label: "bell peppers" },
};

const SEARCH_ONLY = new Set([
  "chicken_broth",
  "beef_broth",
  "vegetable_broth",
  "stock",
  "worcestershire_sauce",
  "ketchup",
  "peanut_butter",
  "vinegar",
]);

const EXTRA_ALIASES = {
  steak: ["beef strip", "steak strip", "steak strips"],
  chickpeas: ["garbanzo bean", "garbanzos"],
  white_fish: ["catfish"],
  bread: ["sandwich bread"],
  cream: ["half-and-half", "half and half", "half & half"],
  yogurt: ["plain yoghurt"],
  cilantro: ["coriander"],
  oregano: ["italian seasoning"],
  enchilada_sauce: ["red enchilada sauce"],
  rice_noodles: ["rice noodle"],
  udon_noodles: ["udon"],
  egg_noodles: ["egg noodle"],
};

const CATEGORY = {
  proteins: "proteins",
  beans_legumes: "proteins",
  grains_pasta_starches: "grains_starches",
  vegetables: "vegetables",
  fruits: "fruits",
  dairy: "dairy_creamy",
  herbs_spices_seasonings: "herbs_spices",
  sauces_condiments: "sauces_condiments",
  oils_fats: "sauces_condiments",
  nuts_seeds_butters: "sauces_condiments",
  drinks_plant_milks: "drinks_plant_milks",
  pantry_basics: "pantry_basics",
  prepared_not_core: "prepared_not_core",
};

const SUBCATEGORY = {
  poultry: "poultry",
  chicken: "poultry",
  turkey: "poultry",
  beef: "red_meat",
  lamb_bison: "red_meat",
  pork: "red_meat",
  seafood: "seafood",
  fish: "seafood",
  eggs: "eggs",
  soy: "plant_protein",
  beans: "plant_protein",
  lentils: "plant_protein",
  rice: "grains",
  rice_grains: "grains",
  grains: "grains",
  whole_grains: "grains",
  flour_baking: "flour_baking",
  pasta_noodles: "pasta_noodles",
  bread_wraps: "bread_wraps",
  potatoes: "starches",
  alliums: "aromatics",
  aromatics: "aromatics",
  peppers: "peppers",
  leafy_greens: "greens",
  cruciferous: "brassicas",
  brassicas: "brassicas",
  root_vegetables: "root_vegetables",
  squash: "squash",
  other_vegetables: "other_vegetables",
  tomatoes: "tomatoes",
  mushrooms: "mushrooms",
  apples_applesauce: "fruits",
  berries: "fruits",
  citrus: "citrus",
  dried_fruit: "fruits",
  grapes_pears_figs: "fruits",
  melons: "fruits",
  other_fruits: "fruits",
  stone_fruit: "fruits",
  cheese: "cheese",
  milk_cream: "milk_cream",
  dried_herbs: "dry_spices",
  dry_spices: "dry_spices",
  ground_spices: "dry_spices",
  blends: "dry_spices",
  spice_blends: "dry_spices",
  fresh_herbs: "fresh_herbs",
  sauces: "sauces",
  condiments: "sauces",
  broth_stock: "sauces",
  tomato_sauces: "sauces",
  asian_sauces: "sauces",
  hot_sauces: "sauces",
  creamy_sauces: "sauces",
  regional_sauces: "regional_sauces",
  regional_pastes: "regional_sauces",
  cooking_oils: "oils_fats",
  solid_fats: "oils_fats",
  acid: "oils_fats",
  vinegars_acids: "oils_fats",
  butters: "sauces",
  nuts: "nuts_seeds",
  seeds: "nuts_seeds",
  plant_milks: "drinks",
  juices: "drinks",
  drinks: "drinks",
  baking: "pantry_basics",
  sweeteners: "pantry_basics",
  frozen_items: "prepared",
  prepared_meals: "prepared",
  prepared_proteins: "prepared",
};

const OVERRIDE = {
  butter: { categoryId: "dairy_creamy", subcategoryId: "milk_cream" },
  lemons: { categoryId: "vegetables", subcategoryId: "citrus" },
  limes: { categoryId: "vegetables", subcategoryId: "citrus" },
};

const GROUP_CONFIG = {
  "Proteins > Chicken": node("chicken", "Chicken & poultry", "proteins", "poultry", ["chicken"], true, ["chicken"]),
  "Proteins > Poultry": node("chicken", "Chicken & poultry", "proteins", "poultry", ["chicken"], true, ["chicken"]),
  "Proteins > Turkey": node("chicken", "Chicken & poultry", "proteins", "poultry", ["chicken"], true, ["chicken"]),
  "Proteins > Beef": node("beef", "Beef", "proteins", "red_meat", [], true, ["beef"]),
  "Proteins > Lamb / Bison": node("beef", "Beef", "proteins", "red_meat", [], true, ["beef"]),
  "Proteins > Pork": node("pork", "Pork", "proteins", "red_meat", [], false, ["pork"]),
  "Proteins > Seafood": node("seafood", "Seafood", "proteins", "seafood", ["fish"], false, ["seafood"]),
  "Proteins > Fish": node("seafood", "Seafood", "proteins", "seafood", ["fish"], false, ["seafood"]),
  "Proteins > Eggs": node("eggs", "Eggs", "proteins", "eggs", ["egg"], true, ["eggs"]),
  "Beans & Legumes > Beans": node("beans_legumes", "Beans & legumes", "proteins", "plant_protein", ["beans"], false, ["plant_protein"]),
  "Beans & Legumes > Lentils": node("beans_legumes", "Beans & legumes", "proteins", "plant_protein", ["beans"], false, ["plant_protein"]),
  "Beans & Legumes > Soy": node("tofu_plant_protein", "Tofu & plant protein", "proteins", "plant_protein", ["tofu"], false, ["plant_protein"]),
  "Grains, Pasta & Starches > Rice": node("rice_grains", "Rice & grains", "grains_starches", "grains", [], true, ["grains_starches"]),
  "Grains, Pasta & Starches > Whole Grains": node("rice_grains", "Rice & grains", "grains_starches", "grains", [], true, ["grains_starches"]),
  "Grains, Pasta & Starches > Pasta / Noodles": node("pasta_noodles", "Pasta & noodles", "grains_starches", "pasta_noodles", [], true, ["grains_starches"]),
  "Grains, Pasta & Starches > Bread / Tortillas": node("bread_wraps", "Bread & wraps", "grains_starches", "bread_wraps", [], true, ["grains_starches"]),
  "Grains, Pasta & Starches > Potatoes": node("potatoes", "Potatoes", "grains_starches", "starches", [], false, ["grains_starches"]),
  "Vegetables > Alliums": node("aromatics", "Aromatics", "vegetables", "aromatics", [], true, ["vegetables"]),
  "Vegetables > Peppers": node("peppers_chiles", "Peppers & chiles", "vegetables", "peppers", [], false, ["vegetables"]),
  "Vegetables > Leafy Greens": node("leafy_greens", "Leafy greens", "vegetables", "greens", [], true, ["vegetables"]),
  "Vegetables > Cruciferous": node("brassicas", "Brassicas", "vegetables", "brassicas", [], false, ["vegetables"]),
  "Vegetables > Brassicas": node("brassicas", "Brassicas", "vegetables", "brassicas", [], false, ["vegetables"]),
  "Vegetables > Tomatoes": node("tomatoes", "Tomatoes", "vegetables", "tomatoes", [], true, ["vegetables"]),
  "Vegetables > Mushrooms": node("mushrooms", "Mushrooms", "vegetables", "mushrooms", [], false, ["vegetables"]),
  "Fruits > Citrus": node("citrus", "Citrus", "vegetables", "citrus", [], false, ["citrus"]),
  "Dairy > Cheese": node("cheese", "Cheese", "dairy_creamy", "cheese", [], true, ["dairy_creamy"]),
  "Dairy > Milk / Cream": node("milk_cream", "Milk / cream", "dairy_creamy", "milk_cream", [], true, ["dairy_creamy"]),
  "Herbs, Spices & Seasonings > Fresh Herbs": node("fresh_herbs", "Fresh herbs", "herbs_spices", "fresh_herbs", [], false, ["herbs_spices"]),
  "Herbs, Spices & Seasonings > Dried Herbs": node("dry_spices", "Dry spices", "herbs_spices", "dry_spices", [], true, ["herbs_spices"]),
  "Herbs, Spices & Seasonings > Ground Spices": node("dry_spices", "Dry spices", "herbs_spices", "dry_spices", [], true, ["herbs_spices"]),
  "Herbs, Spices & Seasonings > Blends": node("dry_spices", "Dry spices", "herbs_spices", "dry_spices", [], true, ["herbs_spices"]),
  "Sauces & Condiments > Broth / Stock": node("sauces", "Sauces", "sauces_condiments", "sauces", [], true, ["sauces_condiments"]),
  "Sauces & Condiments > Condiments": node("sauces", "Sauces", "sauces_condiments", "sauces", [], true, ["sauces_condiments"]),
  "Sauces & Condiments > Tomato Sauces": node("sauces", "Sauces", "sauces_condiments", "sauces", [], true, ["sauces_condiments"]),
  "Sauces & Condiments > Asian Sauces": node("sauces", "Sauces", "sauces_condiments", "sauces", [], true, ["sauces_condiments"]),
  "Sauces & Condiments > Hot Sauces": node("sauces", "Sauces", "sauces_condiments", "sauces", [], true, ["sauces_condiments"]),
  "Sauces & Condiments > Creamy Sauces": node("sauces", "Sauces", "sauces_condiments", "sauces", [], true, ["sauces_condiments"]),
  "Sauces & Condiments > Regional Sauces": node("regional_sauces_pastes", "Regional sauces & pastes", "sauces_condiments", "regional_sauces", [], false, ["regional_sauces_pastes"]),
  "Sauces & Condiments > Regional Pastes": node("regional_sauces_pastes", "Regional sauces & pastes", "sauces_condiments", "regional_sauces", [], false, ["regional_sauces_pastes"]),
  "Oils & Fats > Cooking Oils": node("oils_fats", "Oils & fats", "sauces_condiments", "oils_fats", [], true, ["oils_fats"]),
  "Oils & Fats > Solid Fats": node("oils_fats", "Oils & fats", "sauces_condiments", "oils_fats", [], true, ["oils_fats"]),
  "Sauces & Condiments > Acids": node("oils_fats", "Oils & fats", "sauces_condiments", "oils_fats", [], true, ["oils_fats"]),
  "Sauces & Condiments > Vinegars / Acids": node("oils_fats", "Oils & fats", "sauces_condiments", "oils_fats", [], true, ["oils_fats"]),
  "Nuts, Seeds & Butters > Butters": node("sauces", "Sauces", "sauces_condiments", "sauces", [], true, ["sauces_condiments"]),
};

const FAMILY_GROUP_LABELS = {
  proteins: "Proteins",
  beans_legumes: "Beans & legumes",
  grains_starches: "Grains, pasta & starches",
  vegetables: "Vegetables",
  fruits: "Fruits",
  dairy: "Dairy",
  dairy_creamy: "Dairy & creamy",
  herbs_spices: "Herbs & spices",
  oils_fats: "Oils & fats",
  sauces_condiments: "Sauces & condiments",
  pantry_basics: "Pantry basics",
  nuts_seeds_butters: "Nuts, seeds & butters",
  drinks_plant_milks: "Drinks & plant milks",
  prepared_not_core: "Prepared / not core",
};

const NODE_ORDER = [
  "chicken",
  "beef",
  "pork",
  "seafood",
  "beans_legumes",
  "tofu_plant_protein",
  "eggs",
  "rice_grains",
  "pasta_noodles",
  "bread_wraps",
  "potatoes",
  "grains_pasta_starches_flour_baking",
  "aromatics",
  "peppers_chiles",
  "leafy_greens",
  "brassicas",
  "vegetables_root_vegetables",
  "vegetables_squash",
  "vegetables_other_vegetables",
  "tomatoes",
  "mushrooms",
  "cheese",
  "milk_cream",
  "fruits_apples_applesauce",
  "fruits_berries",
  "citrus",
  "fruits_dried_fruit",
  "fruits_grapes_pears_figs",
  "fruits_melons",
  "fruits_other_fruits",
  "fruits_stone_fruit",
  "fresh_herbs",
  "dry_spices",
  "sauces",
  "regional_sauces_pastes",
  "oils_fats",
  "nuts_seeds_butters_nuts",
  "nuts_seeds_butters_seeds",
  "drinks_plant_milks_drinks",
  "drinks_plant_milks_juices",
  "drinks_plant_milks_plant_milks",
  "pantry_basics_baking",
  "pantry_basics_sweeteners",
  "prepared_not_core_frozen_items",
  "prepared_not_core_prepared_meals",
  "prepared_not_core_prepared_proteins",
];

const FAMILY_ORDER = [
  "proteins",
  "beans_legumes",
  "grains_starches",
  "vegetables",
  "fruits",
  "dairy_creamy",
  "herbs_spices",
  "oils_fats",
  "sauces_condiments",
  "nuts_seeds_butters",
  "pantry_basics",
  "drinks_plant_milks",
  "prepared_not_core",
];

function node(id, label, categoryId, subcategoryId, aliases, visibleInQuickPick, recommendationRollupIds) {
  return { id, label, categoryId, subcategoryId, aliases, visibleInBrowser: true, visibleInQuickPick, recommendationRollupIds };
}

function norm(value) {
  return value?.trim().toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ") || "";
}

function slug(value) {
  return norm(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function titleFromId(value) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function groupKey(item) {
  return `${item.browser.groupPath[1]} > ${item.browser.groupPath[2]}`;
}

function defaultNodeFor(item) {
  const nodeId = slug(`${item.family}_${item.subfamily}`);
  return node(
    nodeId,
    item.browser.groupPath[2],
    CATEGORY[item.family] || item.family,
    SUBCATEGORY[item.subfamily] || item.subfamily,
    [],
    Boolean(item.quickAdd?.enabled),
    item.matching?.rollups?.length ? item.matching.rollups : [CATEGORY[item.family] || item.family],
  );
}

function unique(values) {
  const seen = new Set();
  return values.filter((value) => {
    const n = norm(value);
    if (!n || seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}

function entryConfig(item) {
  const compatibility = COMPATIBILITY_ITEMS[item.id] || {};
  return {
    catalogId: item.id,
    frontendId: compatibility.frontendId || item.id,
    label: compatibility.label || item.displayName.toLowerCase(),
  };
}

function stable(value) {
  return JSON.stringify(value, null, 2);
}

function buildPrimaryOwnerMap(items) {
  const primaryOwner = new Map();
  for (const item of items) {
    const config = entryConfig(item);
    for (const value of [config.frontendId, config.label, item.canonicalName]) {
      const normalized = norm(value);
      const existing = primaryOwner.get(normalized);
      if (existing && existing !== config.frontendId) {
        throw new Error(`Duplicate generated primary term "${normalized}" for ${existing} and ${config.frontendId}.`);
      }
      primaryOwner.set(normalized, config.frontendId);
    }
  }
  return primaryOwner;
}

function build(item, nodeByGroup, primaryOwner) {
  const config = entryConfig(item);
  const nodeId = nodeByGroup.get(groupKey(item)).id;
  const node = BROWSE_NODES.find((candidate) => candidate.id === nodeId);
  const override = OVERRIDE[item.id] || {};
  const rawAliases = unique([item.canonicalName, ...item.aliases, ...(EXTRA_ALIASES[item.id] || [])]);
  const aliases = rawAliases.filter((alias) => {
    const aliasOwner = primaryOwner.get(norm(alias));
    return (!aliasOwner || aliasOwner === config.frontendId) &&
      norm(alias) !== norm(config.label) &&
      norm(alias) !== norm(config.frontendId);
  });

  return {
    id: config.frontendId,
    catalogId: item.id,
    label: config.label,
    categoryId: override.categoryId || CATEGORY[item.family] || item.family,
    subcategoryId: override.subcategoryId || SUBCATEGORY[item.subfamily] || item.subfamily,
    aliases,
    browseNodeIds: [nodeId],
    recommendationRollupIds: node.recommendationRollupIds,
    quickAddEnabled: Boolean(item.quickAdd?.enabled),
    quickAddPriority: item.quickAdd?.priority ?? 0,
    visibility: SEARCH_ONLY.has(item.id) || item.browser?.enabled === false ? "search_only" : "browse_and_search",
  };
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
const emittedItems = catalog.items.filter((item) => item.browser?.enabled || SEARCH_ONLY.has(item.id));
const nodeByGroup = new Map();
const browseNodesById = new Map();

for (const item of emittedItems) {
  const key = groupKey(item);
  const candidateNode = GROUP_CONFIG[key] || defaultNodeFor(item);
  nodeByGroup.set(key, candidateNode);
  if (!browseNodesById.has(candidateNode.id)) {
    browseNodesById.set(candidateNode.id, candidateNode);
  }
}

const BROWSE_NODES = Array.from(browseNodesById.values());
const nodeRank = new Map(NODE_ORDER.map((id, index) => [id, index]));
BROWSE_NODES.sort((left, right) => {
  const leftRank = nodeRank.get(left.id) ?? Number.MAX_SAFE_INTEGER;
  const rightRank = nodeRank.get(right.id) ?? Number.MAX_SAFE_INTEGER;
  if (leftRank !== rightRank) return leftRank - rightRank;
  return left.label.localeCompare(right.label);
});
const familyNodeIds = new Map();
for (const item of emittedItems) {
  const nodeId = nodeByGroup.get(groupKey(item)).id;
  const groupId = item.family === "beans_legumes" ? "beans_legumes" : CATEGORY[item.family] || item.family;
  const nodeIds = familyNodeIds.get(groupId) || [];
  if (!nodeIds.includes(nodeId)) {
    nodeIds.push(nodeId);
  }
  familyNodeIds.set(groupId, nodeIds);
}

const BROWSE_FAMILY_GROUPS = Array.from(familyNodeIds.entries()).map(([id, nodeIds]) => ({
  id,
  label: FAMILY_GROUP_LABELS[id] || titleFromId(id),
  nodeIds: nodeIds.sort((left, right) => (nodeRank.get(left) ?? Number.MAX_SAFE_INTEGER) - (nodeRank.get(right) ?? Number.MAX_SAFE_INTEGER)),
}));
const familyRank = new Map(FAMILY_ORDER.map((id, index) => [id, index]));
BROWSE_FAMILY_GROUPS.sort((left, right) => {
  const leftRank = familyRank.get(left.id) ?? Number.MAX_SAFE_INTEGER;
  const rightRank = familyRank.get(right.id) ?? Number.MAX_SAFE_INTEGER;
  if (leftRank !== rightRank) return leftRank - rightRank;
  return left.label.localeCompare(right.label);
});

const primaryOwner = buildPrimaryOwnerMap(emittedItems);
const canonical = emittedItems.map((item) => build(item, nodeByGroup, primaryOwner));
const output = `// This file is generated by tools/generate-ingredient-taxonomy.cjs.\n// Do not edit by hand; update the backend catalog or generator compatibility config instead.\n\nexport const GENERATED_INGREDIENT_BROWSE_NODES = ${stable(BROWSE_NODES)} as const;\n\nexport const GENERATED_INGREDIENT_BROWSE_FAMILY_GROUPS = ${stable(BROWSE_FAMILY_GROUPS)} as const;\n\nexport const GENERATED_CANONICAL_INGREDIENTS = ${stable(canonical)} as const;\n`;

if (process.argv.includes("--check")) {
  if (!fs.existsSync(OUTPUT_PATH) || fs.readFileSync(OUTPUT_PATH, "utf8") !== output) {
    throw new Error(`${path.relative(REPO_ROOT, OUTPUT_PATH)} is out of date. Run node tools/generate-ingredient-taxonomy.cjs.`);
  }
  console.log(`${path.relative(REPO_ROOT, OUTPUT_PATH)} is up to date.`);
} else {
  fs.writeFileSync(OUTPUT_PATH, output, "utf8");
  console.log(`Generated ${path.relative(REPO_ROOT, OUTPUT_PATH)} from ${path.relative(REPO_ROOT, CATALOG_PATH)}.`);
}
