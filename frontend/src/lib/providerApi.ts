type ProviderCard = {
  headline: string;
  detail: string;
  bullets: string[];
};

export type ProviderInsights = {
  whatsTheDamage: ProviderCard;
  scarcitySimulation: ProviderCard;
  weeklySummary: ProviderCard;
  archetypeFit: ProviderCard;
};

export type ProviderPlan = {
  forecastNudges: string[];
  generatedAt: string;
};

export type UnlockSuggestion = {
  title: string;
  reason: string;
  action: string;
};

export type SupplyPlanRequest = {
  pantryItems: string[];
  householdBand: "1_2" | "3_4" | "5_plus";
  daysTarget: number;
  budgetSensitivity: "low" | "normal" | "high";
};

export type SupplyRecommendation = {
  ingredient: string;
  score: number;
  coverageDeltaDays: number;
  mealsUnlocked: number;
  estimatedSpendBand: "$" | "$$" | "$$$";
  confidence: "low" | "med" | "high";
  notes: string[];
};

export type SupplyPlanResponse = {
  bottleneckIngredient: string;
  proteinExhaustionDay: number;
  generatedForDays: number;
  recommendations: SupplyRecommendation[];
};

export type PlanRequest = {
  focus: "stability" | "growth" | "efficiency";
  horizonDays: 7 | 14 | 30;
};

type PantryLikeRow = {
  ingredient?: unknown;
  name?: unknown;
};

const DEFAULT_PLAN: ProviderPlan = {
  forecastNudges: ["Plan data not available yet. Trigger a refresh to retry."],
  generatedAt: "",
};

const DEFAULT_UNLOCK: UnlockSuggestion[] = [
  {
    title: "No unlock suggestions yet",
    reason: "As soon as /unlock responds, recommendations will show here.",
    action: "Retry",
  },
];

const jsonHeaders = { "Content-Type": "application/json" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const parsed = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return parsed.length ? parsed : fallback;
}

const UNIT_TOKENS = new Set([
  "lb",
  "lbs",
  "oz",
  "g",
  "kg",
  "ml",
  "l",
  "cup",
  "cups",
  "tbsp",
  "tsp",
  "teaspoon",
  "teaspoons",
  "tablespoon",
  "tablespoons",
  "pint",
  "quart",
  "gallon",
  "ea",
  "each",
]);

const JUNK_TOKENS = new Set(["unknown", "n/a", "none"]);

const ALIAS_MAP: Record<string, string> = {
  "hamburger meat": "ground beef",
  "minced beef": "ground beef",
  scallions: "green onion",
  "spring onion": "green onion",
  capsicum: "bell pepper",
  "spaghetti noodles": "pasta",
  macaroni: "pasta",
};

function singularizeToken(token: string): string {
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

function normalizePantryName(raw: string): string {
  let name = raw.trim().toLowerCase();
  name = name.replace(/\([^)]*\)|\[[^\]]*\]/g, " ");
  name = name.replace(/[_/-]/g, " ");
  name = name.replace(/[()[\]{}.,:;'"!?]/g, "");
  name = name.replace(/\s+/g, " ").trim();

  if (!name) return "";

  if (ALIAS_MAP[name]) {
    name = ALIAS_MAP[name];
  }

  const tokens = name
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !UNIT_TOKENS.has(token))
    .filter((token) => !/^\d+([.,]\d+)?$/.test(token))
    .map(singularizeToken);

  const cleaned = tokens.join(" ").trim();
  if (!cleaned) return "";
  if (cleaned.length < 2) return "";
  if (JUNK_TOKENS.has(cleaned)) return "";
  return ALIAS_MAP[cleaned] ?? cleaned;
}

export function mapPantryToSupplyItems(rows: PantryLikeRow[]): string[] {
  const out = new Set<string>();
  for (const row of rows) {
    const raw =
      typeof row.ingredient === "string"
        ? row.ingredient
        : typeof row.name === "string"
          ? row.name
          : "";
    if (!raw) continue;
    const normalized = normalizePantryName(raw);
    if (!normalized) continue;
    out.add(normalized);
  }
  return Array.from(out).sort((a, b) => a.localeCompare(b));
}

async function readJson(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, init);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${path}`);
  }
  return (await response.json()) as unknown;
}

async function postOptional(paths: string[], payload: Record<string, unknown>): Promise<void> {
  for (const path of paths) {
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      });

      if (response.ok || response.status === 202 || response.status === 204) return;
      if (response.status === 404 || response.status === 405) continue;
      return;
    } catch {
      return;
    }
  }
}

export async function fetchProviderInsights(): Promise<ProviderInsights> {
  const [summaryRaw, damageRaw, scarcityRaw, archetypesRaw] = await Promise.all([
    readJson("/insights/provider-summary", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ provider_id: "default-provider", window_days: 7 }),
    }),
    readJson("/insights/damage", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ baseline_score: 20, shocks: [] }),
    }),
    readJson("/plan/scarcity/simulate", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ ingredients: [], scarcity_level: 0.35, budget_tightness: 0.35 }),
    }),
    readJson("/plan/archetypes"),
  ]);

  const summary = isRecord(summaryRaw) ? summaryRaw : {};
  const damage = isRecord(damageRaw) ? damageRaw : {};
  const scarcity = isRecord(scarcityRaw) ? scarcityRaw : {};
  const archetypes = isRecord(archetypesRaw) ? archetypesRaw : {};
  const archetypeList = Array.isArray(archetypes.archetypes) ? archetypes.archetypes : [];

  return {
    whatsTheDamage: {
      headline: `Damage index: ${readString(damage.damage_index, "n/a")} (${readString(damage.severity_band, "unknown")})`,
      detail: "Current pressure estimate based on baseline and known shocks.",
      bullets: readStringArray(damage.recommendations, ["No recommendations yet"]),
    },
    scarcitySimulation: {
      headline: `Risk score: ${readString(scarcity.risk_score, "n/a")} | Archetype: ${readString(
        scarcity.recommended_archetype,
        "n/a",
      )}`,
      detail: "Deterministic scarcity simulation from current pantry conditions.",
      bullets: readStringArray(scarcity.action_plan, ["No scarcity plan yet"]),
    },
    weeklySummary: {
      headline: `Readiness: ${readString(summary.readiness_band, "n/a")} | Health: ${readString(summary.health_score, "n/a")}`,
      detail: `Scarcity risk ${readString(summary.scarcity_risk, "n/a")} over ${readString(summary.window_days, "7")} days.`,
      bullets: readStringArray(summary.highlights, ["No summary highlights yet"]),
    },
    archetypeFit: {
      headline: archetypeList.length
        ? `Top archetype: ${readString((archetypeList[0] as Record<string, unknown>).title, "n/a")}`
        : "No archetype fit yet",
      detail: archetypeList.length
        ? readString((archetypeList[0] as Record<string, unknown>).description, "")
        : "Archetype mappings are not available yet.",
      bullets: archetypeList
        .map((item) => (isRecord(item) ? readString(item.trigger, "") : ""))
        .filter((item) => item.length > 0),
    },
  };
}

export async function fetchProviderPlan(request: PlanRequest): Promise<ProviderPlan> {
  const demandShift = request.focus === "growth" ? 0.25 : request.focus === "efficiency" ? -0.1 : 0.0;
  const supplyShift = request.focus === "efficiency" ? 0.15 : 0.0;
  const volatility = request.focus === "stability" ? 0.2 : 0.35;

  const raw = await readJson("/insights/forecast/micro", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      horizon_days: request.horizonDays,
      demand_shift: demandShift,
      supply_shift: supplyShift,
      volatility,
      focus_ingredients: [],
    }),
  });

  if (!isRecord(raw)) return DEFAULT_PLAN;

  const trend = readString(raw.trend, "unknown");
  const score = readString(raw.forecast_score, "n/a");
  const cookable = readString(raw.cookable_projection, "0");
  const almost = readString(raw.almost_projection, "0");
  const drivers = readStringArray(raw.drivers, []);

  return {
    forecastNudges: [
      `Trend: ${trend} (score ${score})`,
      `Projected cookable: ${cookable}`,
      `Projected almost-ready: ${almost}`,
      ...drivers,
    ],
    generatedAt: new Date().toISOString(),
  };
}

export async function fetchUnlockSuggestions(): Promise<UnlockSuggestion[]> {
  const raw = await readJson("/unlock/minimal", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      goal: "provider-intelligence",
      pantry_items_target: 8,
      event_target: 4,
      closed_session_target: 1,
    }),
  });

  if (!isRecord(raw)) return DEFAULT_UNLOCK;

  const unlocked = Boolean(raw.unlocked);
  const progress = readString(raw.progress, "0");
  const reasons = readStringArray(raw.reasons, []);
  const steps = readStringArray(raw.remaining_steps, []);

  return [
    {
      title: unlocked ? "Provider unlock reached" : "Provider unlock in progress",
      reason: reasons[0] ?? "No progress reason available.",
      action: unlocked ? "Unlocked" : `Progress ${progress}`,
    },
    ...steps.map((step, index) => ({
      title: `Next step ${index + 1}`,
      reason: step,
      action: "Do next",
    })),
  ];
}

export async function fetchSupplyPlan(request: SupplyPlanRequest): Promise<SupplyPlanResponse> {
  const raw = await readJson("/supply/plan", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      pantry_items: request.pantryItems,
      household_band: request.householdBand,
      days_target: request.daysTarget,
      budget_sensitivity: request.budgetSensitivity,
    }),
  });

  if (!isRecord(raw)) {
    return {
      bottleneckIngredient: "unknown",
      proteinExhaustionDay: 0,
      generatedForDays: request.daysTarget,
      recommendations: [],
    };
  }

  const recommendationsRaw = Array.isArray(raw.recommendations) ? raw.recommendations : [];
  const recommendations = recommendationsRaw
    .map((item) => {
      if (!isRecord(item)) return null;
      return {
        ingredient: readString(item.ingredient, "unknown"),
        score: Number(item.score ?? 0),
        coverageDeltaDays: Number(item.coverage_delta_days ?? 0),
        mealsUnlocked: Number(item.meals_unlocked ?? 0),
        estimatedSpendBand: (readString(item.estimated_spend_band, "$$") as "$" | "$$" | "$$$"),
        confidence: (readString(item.confidence, "low") as "low" | "med" | "high"),
        notes: readStringArray(item.notes, []),
      } satisfies SupplyRecommendation;
    })
    .filter((item): item is SupplyRecommendation => item !== null);

  return {
    bottleneckIngredient: readString(raw.bottleneck_ingredient, "unknown"),
    proteinExhaustionDay: Number(raw.protein_exhaustion_day ?? 0),
    generatedForDays: Number(raw.generated_for_days ?? request.daysTarget),
    recommendations,
  };
}

export function createProviderSessionId(): string {
  const randomChunk = Math.random().toString(36).slice(2, 8);
  return `provider-${Date.now()}-${randomChunk}`;
}

export async function trackProviderSessionStart(sessionId: string): Promise<void> {
  await postOptional(["/insights/telemetry/event"], {
    session_id: sessionId,
    event_name: "session_start",
    properties: {
      started_at: new Date().toISOString(),
    },
  });
}

export async function trackProviderFirstResult(sessionId: string, source: string): Promise<void> {
  await postOptional(["/insights/telemetry/event"], {
    session_id: sessionId,
    event_name: "first_result",
    properties: {
      source,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function trackProviderSessionClose(sessionId: string, reason: "unmount" | "beforeunload"): Promise<void> {
  await postOptional(["/insights/telemetry/session/close"], {
    session_id: sessionId,
    duration_seconds: 0,
    outcome: reason,
  });
}
