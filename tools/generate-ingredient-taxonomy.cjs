const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const CATALOG_PATH = path.join(REPO_ROOT, "backend", "app", "data", "ingredient_catalog_v1.json");
const OUTPUT_PATH = path.join(REPO_ROOT, "frontend", "src", "lib", "generatedIngredientTaxonomy.ts");

const SHIPPED_BROWSER_ITEMS = [
  "chicken", "chicken_breast", "chicken_thighs", "ground_chicken", "turkey", "ground_turkey",
  "beef", "ground_beef", "steak", "pork", "pork_chops", "sausage", "bacon", "ham",
  "seafood", "shrimp", "salmon", "tuna", "cod", "tilapia", "white_fish", "eggs",
  "tofu", "edamame", "beans", "black_beans", "white_beans", "pinto_beans", "canned_beans",
  "chickpeas", "lentils", "rice", "quinoa", "couscous", "pasta", "spaghetti", "noodles",
  "ramen_noodles", "ravioli", "bread", "flour_tortillas", "corn_tortillas", "pita", "buns",
  "breadcrumbs", "potatoes", "sweet_potatoes", "onion", "garlic", "green_onion", "ginger",
  "celery", { catalogId: "bell_pepper", frontendId: "bell_peppers", label: "bell peppers" },
  "jalapenos", "poblano", "green_chiles", "spinach", "kale", "lettuce", "bok_choy",
  "broccoli", "cabbage", "cauliflower", "tomato", "cherry_tomatoes", "diced_tomatoes",
  "crushed_tomatoes", "tomato_paste", "mushrooms", "lemons", "limes", "milk", "cream",
  "sour_cream", "yogurt", "cream_cheese", "cheese", "cheddar", "mozzarella", "parmesan",
  "feta", "butter", "salt", "black_pepper", "garlic_powder", "onion_powder", "paprika",
  "smoked_paprika", "chili_powder", "cumin", "oregano", "curry_powder", "red_pepper_flakes",
  "cilantro", "parsley", "basil", "broth", "chicken_broth", "beef_broth", "vegetable_broth",
  "stock", "tomato_sauce", "soy_sauce", "hot_sauce", "mustard", "mayo", "bbq_sauce",
  "salsa", "pesto", "marinara", "enchilada_sauce", "teriyaki_sauce", "sriracha",
  "worcestershire_sauce", "ketchup", "peanut_butter", "oil", "olive_oil", "sesame_oil",
  "vinegar", "miso", "salsa_verde",
];

const BROWSE_NODES = [
  ["chicken", "Chicken & poultry", "proteins", "poultry", ["chicken"], true, ["chicken"]],
  ["beef", "Beef", "proteins", "red_meat", [], true, ["beef"]],
  ["pork", "Pork", "proteins", "red_meat", [], false, ["pork"]],
  ["seafood", "Seafood", "proteins", "seafood", ["fish"], false, ["seafood"]],
  ["beans_legumes", "Beans & legumes", "proteins", "plant_protein", ["beans"], false, ["plant_protein"]],
  ["tofu_plant_protein", "Tofu & plant protein", "proteins", "plant_protein", ["tofu"], false, ["plant_protein"]],
  ["eggs", "Eggs", "proteins", "eggs", ["egg"], true, ["eggs"]],
  ["rice_grains", "Rice & grains", "grains_starches", "grains", [], true, ["grains_starches"]],
  ["pasta_noodles", "Pasta & noodles", "grains_starches", "pasta_noodles", [], true, ["grains_starches"]],
  ["bread_wraps", "Bread & wraps", "grains_starches", "bread_wraps", [], true, ["grains_starches"]],
  ["potatoes", "Potatoes", "grains_starches", "starches", [], false, ["grains_starches"]],
  ["aromatics", "Aromatics", "vegetables", "aromatics", [], true, ["vegetables"]],
  ["peppers_chiles", "Peppers & chiles", "vegetables", "peppers", [], false, ["vegetables"]],
  ["leafy_greens", "Leafy greens", "vegetables", "greens", [], true, ["vegetables"]],
  ["brassicas", "Brassicas", "vegetables", "brassicas", [], false, ["vegetables"]],
  ["tomatoes", "Tomatoes", "vegetables", "tomatoes", [], true, ["vegetables"]],
  ["mushrooms", "Mushrooms", "vegetables", "mushrooms", [], false, ["vegetables"]],
  ["cheese", "Cheese", "dairy_creamy", "cheese", [], true, ["dairy_creamy"]],
  ["milk_cream", "Milk / cream", "dairy_creamy", "milk_cream", [], true, ["dairy_creamy"]],
  ["fresh_herbs", "Fresh herbs", "herbs_spices", "fresh_herbs", [], false, ["herbs_spices"]],
  ["dry_spices", "Dry spices", "herbs_spices", "dry_spices", [], true, ["herbs_spices"]],
  ["sauces", "Sauces", "sauces_condiments", "sauces", [], true, ["sauces_condiments"]],
  ["oils_fats", "Oils & fats", "sauces_condiments", "oils_fats", [], true, ["oils_fats"]],
  ["citrus", "Citrus", "vegetables", "citrus", [], false, ["citrus"]],
  ["regional_sauces_pastes", "Regional sauces & pastes", "sauces_condiments", "regional_sauces", [], false, ["regional_sauces_pastes"]],
].map(([id, label, categoryId, subcategoryId, aliases, visibleInQuickPick, recommendationRollupIds]) => ({
  id, label, categoryId, subcategoryId, aliases, visibleInBrowser: true, visibleInQuickPick, recommendationRollupIds,
}));

const BROWSE_FAMILY_GROUPS = [
  { id: "proteins", label: "Proteins", nodeIds: ["chicken", "beef", "pork", "seafood", "eggs"] },
  { id: "beans_legumes", label: "Beans & legumes", nodeIds: ["beans_legumes", "tofu_plant_protein"] },
  { id: "grains_starches", label: "Grains, pasta & starches", nodeIds: ["rice_grains", "pasta_noodles", "bread_wraps", "potatoes"] },
  { id: "vegetables", label: "Vegetables", nodeIds: ["aromatics", "peppers_chiles", "leafy_greens", "brassicas", "tomatoes", "mushrooms"] },
  { id: "dairy", label: "Dairy", nodeIds: ["cheese", "milk_cream"] },
  { id: "oils_fats", label: "Oils & fats", nodeIds: ["oils_fats"] },
  { id: "sauces_condiments", label: "Sauces & condiments", nodeIds: ["sauces", "regional_sauces_pastes"] },
  { id: "pantry_basics", label: "Pantry basics", nodeIds: ["dry_spices", "fresh_herbs", "citrus"] },
];

const SEARCH_ONLY = new Set(["chicken_broth", "beef_broth", "vegetable_broth", "stock", "worcestershire_sauce", "ketchup", "peanut_butter", "vinegar"]);
const EXTRA_ALIASES = {
  steak: ["beef strip", "steak strip", "steak strips"],
  chickpeas: ["garbanzo bean", "garbanzos"],
  white_fish: ["catfish"],
  rice: ["white rice", "brown rice", "jasmine rice", "basmati rice"],
  pasta: ["penne", "linguine", "fettuccine", "shells", "orzo", "tortellini", "ziti"],
  noodles: ["egg noodles", "udon", "udon noodles", "lo mein", "lo mein noodle", "lo mein noodles", "rice noodle", "rice noodles"],
  bread: ["sliced bread", "sandwich bread"],
  corn_tortillas: ["tostadas"],
  tomato: ["tomatoes"],
  cream: ["heavy cream", "half-and-half", "half and half", "half & half"],
  yogurt: ["plain yoghurt"],
  cilantro: ["coriander"],
  oregano: ["italian seasoning"],
  enchilada_sauce: ["red enchilada sauce"],
  oil: ["vegetable oil", "canola oil"],
};

const CATEGORY = { proteins: "proteins", beans_legumes: "proteins", grains_pasta_starches: "grains_starches", vegetables: "vegetables", fruits: "vegetables", dairy: "dairy_creamy", herbs_spices_seasonings: "herbs_spices", sauces_condiments: "sauces_condiments", oils_fats: "sauces_condiments", nuts_seeds_butters: "sauces_condiments" };
const SUBCATEGORY = { poultry: "poultry", chicken: "poultry", turkey: "poultry", beef: "red_meat", pork: "red_meat", seafood: "seafood", fish: "seafood", eggs: "eggs", soy: "plant_protein", beans: "plant_protein", lentils: "plant_protein", rice: "grains", grains: "grains", whole_grains: "grains", pasta_noodles: "pasta_noodles", bread_wraps: "bread_wraps", potatoes: "starches", alliums: "aromatics", aromatics: "aromatics", peppers: "peppers", leafy_greens: "greens", cruciferous: "brassicas", tomatoes: "tomatoes", mushrooms: "mushrooms", citrus: "citrus", cheese: "cheese", milk_cream: "milk_cream", dried_herbs: "dry_spices", ground_spices: "dry_spices", spice_blends: "dry_spices", fresh_herbs: "fresh_herbs", sauces: "sauces", condiments: "sauces", broth_stock: "sauces", tomato_sauces: "sauces", asian_sauces: "sauces", hot_sauces: "sauces", creamy_sauces: "sauces", regional_sauces: "regional_sauces", regional_pastes: "regional_sauces", cooking_oils: "oils_fats", solid_fats: "oils_fats", acid: "oils_fats", vinegars_acids: "oils_fats", butters: "sauces" };
const OVERRIDE = { butter: { categoryId: "dairy_creamy", subcategoryId: "milk_cream" }, lemons: { categoryId: "vegetables", subcategoryId: "citrus" }, limes: { categoryId: "vegetables", subcategoryId: "citrus" } };
const GROUP_TO_NODE = { "Proteins > Chicken": "chicken", "Proteins > Poultry": "chicken", "Proteins > Turkey": "chicken", "Proteins > Beef": "beef", "Proteins > Lamb / Bison": "beef", "Proteins > Pork": "pork", "Proteins > Seafood": "seafood", "Proteins > Fish": "seafood", "Proteins > Eggs": "eggs", "Beans & Legumes > Beans": "beans_legumes", "Beans & Legumes > Lentils": "beans_legumes", "Beans & Legumes > Soy": "tofu_plant_protein", "Grains, Pasta & Starches > Rice": "rice_grains", "Grains, Pasta & Starches > Whole Grains": "rice_grains", "Grains, Pasta & Starches > Pasta / Noodles": "pasta_noodles", "Grains, Pasta & Starches > Bread / Tortillas": "bread_wraps", "Grains, Pasta & Starches > Potatoes": "potatoes", "Vegetables > Alliums": "aromatics", "Vegetables > Peppers": "peppers_chiles", "Vegetables > Leafy Greens": "leafy_greens", "Vegetables > Cruciferous": "brassicas", "Vegetables > Tomatoes": "tomatoes", "Vegetables > Mushrooms": "mushrooms", "Fruits > Citrus": "citrus", "Dairy > Cheese": "cheese", "Dairy > Milk / Cream": "milk_cream", "Herbs, Spices & Seasonings > Fresh Herbs": "fresh_herbs", "Herbs, Spices & Seasonings > Dried Herbs": "dry_spices", "Herbs, Spices & Seasonings > Ground Spices": "dry_spices", "Herbs, Spices & Seasonings > Blends": "dry_spices", "Sauces & Condiments > Broth / Stock": "sauces", "Sauces & Condiments > Condiments": "sauces", "Sauces & Condiments > Tomato Sauces": "sauces", "Sauces & Condiments > Asian Sauces": "sauces", "Sauces & Condiments > Hot Sauces": "sauces", "Sauces & Condiments > Creamy Sauces": "sauces", "Sauces & Condiments > Regional Sauces": "regional_sauces_pastes", "Sauces & Condiments > Regional Pastes": "regional_sauces_pastes", "Oils & Fats > Cooking Oils": "oils_fats", "Oils & Fats > Solid Fats": "oils_fats", "Sauces & Condiments > Acids": "oils_fats", "Sauces & Condiments > Vinegars / Acids": "oils_fats", "Nuts, Seeds & Butters > Butters": "sauces" };

function norm(value) { return value?.trim().toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ") || ""; }
function unique(values) { const seen = new Set(); return values.filter((value) => { const n = norm(value); if (!n || seen.has(n)) return false; seen.add(n); return true; }); }
function browseNode(item) { const key = `${item.browser.groupPath[1]} > ${item.browser.groupPath[2]}`; const id = GROUP_TO_NODE[key]; if (!id) throw new Error(`${item.id} has unsupported group ${key}`); return id; }
function entryConfig(entry) { return typeof entry === "string" ? { catalogId: entry, frontendId: entry } : entry; }
function stable(value) { return JSON.stringify(value, null, 2); }

function build(item, config) {
  const nodeId = browseNode(item);
  const node = BROWSE_NODES.find((candidate) => candidate.id === nodeId);
  const override = OVERRIDE[item.id] || {};
  const label = config.label || item.displayName.toLowerCase();
  return {
    id: config.frontendId,
    catalogId: item.id,
    label,
    categoryId: override.categoryId || CATEGORY[item.family] || item.family,
    subcategoryId: override.subcategoryId || SUBCATEGORY[item.subfamily] || item.subfamily,
    aliases: unique([item.canonicalName, ...item.aliases, ...(EXTRA_ALIASES[item.id] || [])]).filter((alias) => norm(alias) !== norm(label) && norm(alias) !== norm(config.frontendId)),
    browseNodeIds: [nodeId],
    recommendationRollupIds: node.recommendationRollupIds,
    visibility: SEARCH_ONLY.has(item.id) || item.browser?.enabled === false ? "search_only" : "browse_and_search",
  };
}

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
const byId = new Map(catalog.items.map((item) => [item.id, item]));
const canonical = SHIPPED_BROWSER_ITEMS.map(entryConfig).map((config) => {
  const item = byId.get(config.catalogId);
  if (!item) throw new Error(`Missing catalog item ${config.catalogId}`);
  return build(item, config);
});
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
