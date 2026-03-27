import { postJson } from "./apiClient";
import { fetchPantry } from "./mvpApi";

export type ChefAssistGenerateRequest = {
  rawPrompt: string;
  pantryItems: string[];
  timeBand: "quick" | "standard" | "i_got_time";
  budgetBand: "stretch" | "normal" | "flexible";
  householdBand: "1_2" | "3_4" | "5_plus";
  allowMissing: number;
};

export type ChefAssistIngredient = {
  name: string;
  qty: string;
  optional: boolean;
  fromPantry: boolean;
};

export type ChefAssistResponse = {
  title: string;
  archetype: string;
  timeMinutes: number;
  servingsBand: string;
  ingredients: ChefAssistIngredient[];
  steps: string[];
  pantryAlignment: {
    usedFromPantry: string[];
    missing: string[];
  };
  whyThisWorks: string[];
  safetyNotes: string[];
  validation: {
    passed: boolean;
    issues: string[];
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const strings = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return strings.length ? strings : fallback;
}

export async function fetchPantryForChefAssist() {
  return fetchPantry();
}

export async function fetchChefAssistGenerate(request: ChefAssistGenerateRequest): Promise<ChefAssistResponse> {
  const raw = await postJson<unknown>("/ai/recipe/generate", {
    raw_prompt: request.rawPrompt,
    pantry_items: request.pantryItems,
    time_band: request.timeBand,
    budget_band: request.budgetBand,
    household_band: request.householdBand,
    allow_missing: request.allowMissing,
  });

  if (!isRecord(raw)) throw new Error("Invalid /ai/recipe/generate response");

  const ingredientsRaw = Array.isArray(raw.ingredients) ? raw.ingredients : [];
  const ingredients = ingredientsRaw
    .map((item) => {
      if (!isRecord(item)) return null;
      return {
        name: readString(item.name, "unknown"),
        qty: readString(item.qty, "1 unit"),
        optional: Boolean(item.optional),
        fromPantry: Boolean(item.from_pantry),
      } satisfies ChefAssistIngredient;
    })
    .filter((item): item is ChefAssistIngredient => item !== null);

  const pantryAlignmentRaw = isRecord(raw.pantry_alignment) ? raw.pantry_alignment : {};
  const validationRaw = isRecord(raw.validation) ? raw.validation : {};

  return {
    title: readString(raw.title, "Pantry Meal"),
    archetype: readString(raw.archetype, "skillet"),
    timeMinutes: Number(raw.time_minutes ?? 0),
    servingsBand: readString(raw.servings_band, "3-4 servings"),
    ingredients,
    steps: readStringArray(raw.steps, []),
    pantryAlignment: {
      usedFromPantry: readStringArray(pantryAlignmentRaw.used_from_pantry, []),
      missing: readStringArray(pantryAlignmentRaw.missing, []),
    },
    whyThisWorks: readStringArray(raw.why_this_works, []),
    safetyNotes: readStringArray(raw.safety_notes, []),
    validation: {
      passed: Boolean(validationRaw.passed),
      issues: readStringArray(validationRaw.issues, []),
    },
  };
}
