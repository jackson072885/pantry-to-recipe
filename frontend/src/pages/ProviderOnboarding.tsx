import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { postJson, postOptional } from "../lib/apiClient";
import { fetchPantry } from "../lib/mvpApi";
import { mapPantryToSupplyItems } from "../lib/providerApi";

type StepKey = "tonight_mode" | "pantry_pulse" | "constraint_snap";

type Recommendation = {
  recipe_id: number;
  recipe_name: string;
  reasons: string[];
  missing_ingredients: string[];
};

type OnboardingState = {
  step: 1 | 2 | 3;
  partySize: "1_2" | "3_4" | "5_plus";
  hungerLevel: "light" | "normal" | "big";
  timeLimitMinutes: number;
  budgetPerMeal: string;
  pantryText: string;
  dietary: "any" | "vegetarian";
  avoidText: string;
  mustIncludeText: string;
};

const STORAGE_KEY = "provider_onboarding_state_v1";
const SESSION_KEY = "provider_onboarding_session_id";
const START_KEY = "provider_onboarding_start_ms";

const DEFAULT_STATE: OnboardingState = {
  step: 1,
  partySize: "3_4",
  hungerLevel: "normal",
  timeLimitMinutes: 30,
  budgetPerMeal: "",
  pantryText: "",
  dietary: "any",
  avoidText: "",
  mustIncludeText: "",
};

const shellStyle: React.CSSProperties = {
  maxWidth: 860,
  margin: "0 auto",
  padding: "1rem 0.9rem 2rem",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #dbe4ef",
  borderRadius: 12,
  padding: "0.9rem",
  background: "#ffffff",
};

function parseListText(input: string): string[] {
  return input
    .split(/\n|,/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

function tokenSet(input: string): Set<string> {
  return new Set(
    parseListText(input)
      .map((value) => value.toLowerCase())
      .map((value) => value.replace(/\s+/g, " ").trim())
      .filter(Boolean),
  );
}

function coverageHints(pantryItems: string[]): string[] {
  const proteins = new Set(["chicken", "beef", "pork", "egg", "beans", "tofu", "fish", "tuna", "ground beef"]);
  const staples = new Set(["rice", "pasta", "bread", "tortilla", "potato", "oil"]);
  const produce = new Set(["onion", "tomato", "lettuce", "spinach", "bell pepper", "carrot"]);
  const pantry = new Set(pantryItems);
  const proteinCount = Array.from(proteins).filter((item) => pantry.has(item)).length;
  const stapleCount = Array.from(staples).filter((item) => pantry.has(item)).length;
  const produceCount = Array.from(produce).filter((item) => pantry.has(item)).length;

  return [
    `Pantry items detected: ${pantryItems.length}`,
    proteinCount >= 2 ? "Protein coverage: stable for next picks" : "Protein coverage: thin, consider adding one",
    stapleCount >= 1 ? "Staples: available for flexible meals" : "Staples: low, recipes may need extras",
    produceCount >= 1 ? "Fresh overlap: available for variety" : "Fresh overlap: limited",
  ];
}

function mapDietaryToApi(value: "any" | "vegetarian"): "any" | "vegetarian" | "omnivore" {
  return value === "vegetarian" ? "vegetarian" : "omnivore";
}

function normalizeMinutes(value: number): number {
  if (Number.isNaN(value)) return 30;
  return Math.max(5, Math.min(120, Math.round(value)));
}

function ProviderOnboardingPage() {
  const [state, setState] = useState<OnboardingState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_STATE;
      const parsed = JSON.parse(raw) as Partial<OnboardingState>;
      return { ...DEFAULT_STATE, ...parsed };
    } catch {
      return DEFAULT_STATE;
    }
  });
  const [loadingPantry, setLoadingPantry] = useState(false);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const ttfrSentRef = useRef(false);

  const onboardingSessionId = useMemo(() => {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = `provider-onb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  }, []);

  const startAtMs = useMemo(() => {
    const existing = sessionStorage.getItem(START_KEY);
    if (existing) return Number(existing);
    const created = Date.now();
    sessionStorage.setItem(START_KEY, String(created));
    return created;
  }, []);

  const pantryItems = useMemo(() => {
    const rows = parseListText(state.pantryText).map((value) => ({ ingredient: value }));
    return mapPantryToSupplyItems(rows);
  }, [state.pantryText]);

  const hints = useMemo(() => coverageHints(pantryItems), [pantryItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    void postOptional("/insights/telemetry/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: onboardingSessionId,
        event_name: "provider_onboarding_started",
        properties: {
          started_at_ms: startAtMs,
        },
      }),
    }).catch(() => {
      // non-blocking telemetry
    });
  }, [onboardingSessionId, startAtMs]);

  useEffect(() => {
    if (loadingRecommendations || recommendations.length === 0 || ttfrSentRef.current) return;
    const rafId = requestAnimationFrame(() => {
      if (ttfrSentRef.current) return;
      ttfrSentRef.current = true;
      const ttfrMs = Math.max(Date.now() - startAtMs, 0);
      localStorage.setItem("provider_onboarding_ttfr_ms", String(ttfrMs));
      const selections = {
        party_size: state.partySize,
        hunger_level: state.hungerLevel,
        time_limit_minutes: state.timeLimitMinutes,
        budget_per_meal: state.budgetPerMeal || null,
        pantry_count: pantryItems.length,
        dietary: state.dietary,
        avoid_count: parseListText(state.avoidText).length,
        must_include_count: parseListText(state.mustIncludeText).length,
      };

      void postOptional("/insights/telemetry/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: onboardingSessionId,
          event_name: "provider_onboarding_ttfr",
          properties: {
            ttfr_ms: ttfrMs,
            selections,
            recommendation_count: recommendations.length,
          },
        }),
      }).catch(() => {
        // non-blocking telemetry
      });

      void postOptional("/insights/telemetry/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: onboardingSessionId,
          event_name: "provider_onboarding_finished",
          properties: {
            ttfr_ms: ttfrMs,
          },
        }),
      }).catch(() => {
        // non-blocking telemetry
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [
    loadingRecommendations,
    onboardingSessionId,
    pantryItems.length,
    recommendations.length,
    startAtMs,
    state.avoidText,
    state.budgetPerMeal,
    state.dietary,
    state.hungerLevel,
    state.mustIncludeText,
    state.partySize,
    state.timeLimitMinutes,
  ]);

  const emitStepCompleted = (stepName: StepKey) => {
    void postOptional("/insights/telemetry/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: onboardingSessionId,
        event_name: "provider_onboarding_step_completed",
        properties: {
          step_name: stepName,
        },
      }),
    }).catch(() => {
      // non-blocking telemetry
    });
  };

  const loadCurrentPantry = async () => {
    setError("");
    setLoadingPantry(true);
    try {
      const data = await fetchPantry();
      const normalized = mapPantryToSupplyItems(data.items ?? []);
      setState((prev) => ({ ...prev, pantryText: normalized.join("\n") }));
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load pantry");
    } finally {
      setLoadingPantry(false);
    }
  };

  const nextFromTonight = () => {
    emitStepCompleted("tonight_mode");
    setState((prev) => ({ ...prev, step: 2 }));
  };

  const nextFromPantry = () => {
    emitStepCompleted("pantry_pulse");
    setState((prev) => ({ ...prev, step: 3 }));
  };

  const showBestOptions = async () => {
    setError("");
    setLoadingRecommendations(true);
    try {
      const data = await postJson<{ recommendations?: Recommendation[] }>("/onboarding/recipes/first", {
        session_id: onboardingSessionId,
        pantry_items: pantryItems,
        constraints: {
          diet: mapDietaryToApi(state.dietary),
          allergies: parseListText(state.avoidText),
          max_minutes: normalizeMinutes(state.timeLimitMinutes),
        },
      });
      setRecommendations(data.recommendations ?? []);
      emitStepCompleted("constraint_snap");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to fetch recommendations");
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const mustIncludeHints = useMemo(() => {
    const set = tokenSet(state.mustIncludeText);
    if (set.size === 0) return "No must-include filters applied.";
    const overlap = pantryItems.filter((item) => set.has(item.toLowerCase())).length;
    return `${overlap} must-include item(s) currently in pantry match.`;
  }, [pantryItems, state.mustIncludeText]);

  return (
    <main className="page-shell" style={shellStyle}>
      <header style={{ marginBottom: "0.9rem" }}>
        <h1 style={{ margin: 0, fontFamily: '"Space Grotesk", sans-serif' }}>Provider Onboarding</h1>
        <p style={{ margin: "0.35rem 0 0", color: "#475569" }}>
          3 steps to a first recommendation. <Link to="/provider">Back to Provider</Link>
        </p>
      </header>

      {error && (
        <div role="alert" style={{ ...cardStyle, borderColor: "#fecaca", background: "#fff1f2", color: "#991b1b", marginBottom: "0.9rem" }}>
          {error}
        </div>
      )}

      <section style={{ ...cardStyle, marginBottom: "0.9rem" }}>
        <strong>Step {state.step} of 3</strong>
        <div style={{ color: "#64748b", fontSize: "0.9rem", marginTop: "0.25rem" }}>
          {state.step === 1 ? "Tonight Mode" : state.step === 2 ? "Pantry Pulse" : "Constraint Snap"}
        </div>
      </section>

      {state.step === 1 && (
        <section style={{ ...cardStyle, display: "grid", gap: "0.7rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Tonight Mode</h2>

          <label style={{ display: "grid", gap: "0.25rem" }}>
            Party size
            <select value={state.partySize} onChange={(e) => setState((prev) => ({ ...prev, partySize: e.target.value as OnboardingState["partySize"] }))}>
              <option value="1_2">1-2</option>
              <option value="3_4">3-4</option>
              <option value="5_plus">5+</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: "0.25rem" }}>
            Hunger level
            <select value={state.hungerLevel} onChange={(e) => setState((prev) => ({ ...prev, hungerLevel: e.target.value as OnboardingState["hungerLevel"] }))}>
              <option value="light">light</option>
              <option value="normal">normal</option>
              <option value="big">big</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: "0.25rem" }}>
            Time limit (minutes)
            <input
              type="number"
              min={5}
              max={120}
              value={state.timeLimitMinutes}
              onChange={(e) => setState((prev) => ({ ...prev, timeLimitMinutes: normalizeMinutes(Number(e.target.value)) }))}
            />
          </label>

          <label style={{ display: "grid", gap: "0.25rem" }}>
            Budget per meal (optional)
            <input
              type="text"
              placeholder="$10"
              value={state.budgetPerMeal}
              onChange={(e) => setState((prev) => ({ ...prev, budgetPerMeal: e.target.value }))}
            />
          </label>

          <button type="button" onClick={nextFromTonight} style={{ width: "fit-content" }}>
            Continue to Pantry Pulse
          </button>
        </section>
      )}

      {state.step === 2 && (
        <section style={{ ...cardStyle, display: "grid", gap: "0.7rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Pantry Pulse</h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" onClick={loadCurrentPantry} disabled={loadingPantry}>
              {loadingPantry ? "Loading pantry..." : "Pull current pantry"}
            </button>
            <button type="button" onClick={() => setState((prev) => ({ ...prev, pantryText: prev.pantryText.trim() }))}>
              Use pasted pantry
            </button>
          </div>
          <textarea
            rows={8}
            placeholder={"Paste one ingredient per line\nchicken\nrice\nonion"}
            value={state.pantryText}
            onChange={(e) => setState((prev) => ({ ...prev, pantryText: e.target.value }))}
            style={{ width: "100%" }}
          />
          <div style={{ color: "#334155", fontSize: "0.92rem" }}>
            <strong>Coverage hints</strong>
            <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1rem" }}>
              {hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" onClick={() => setState((prev) => ({ ...prev, step: 1 }))}>
              Back
            </button>
            <button type="button" onClick={nextFromPantry}>
              Continue to Constraint Snap
            </button>
          </div>
        </section>
      )}

      {state.step === 3 && (
        <section style={{ ...cardStyle, display: "grid", gap: "0.7rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Constraint Snap</h2>

          <label style={{ display: "grid", gap: "0.25rem" }}>
            Dietary
            <select value={state.dietary} onChange={(e) => setState((prev) => ({ ...prev, dietary: e.target.value as OnboardingState["dietary"] }))}>
              <option value="any">any</option>
              <option value="vegetarian">vegetarian</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: "0.25rem" }}>
            Avoid list (freeform)
            <input
              type="text"
              placeholder="peanuts, shellfish"
              value={state.avoidText}
              onChange={(e) => setState((prev) => ({ ...prev, avoidText: e.target.value }))}
            />
          </label>

          <label style={{ display: "grid", gap: "0.25rem" }}>
            Must include (freeform)
            <input
              type="text"
              placeholder="chicken, rice"
              value={state.mustIncludeText}
              onChange={(e) => setState((prev) => ({ ...prev, mustIncludeText: e.target.value }))}
            />
          </label>

          <div style={{ color: "#475569", fontSize: "0.9rem" }}>{mustIncludeHints}</div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" onClick={() => setState((prev) => ({ ...prev, step: 2 }))}>
              Back
            </button>
            <button type="button" onClick={showBestOptions} disabled={loadingRecommendations}>
              {loadingRecommendations ? "Loading options..." : "Show best options"}
            </button>
          </div>
        </section>
      )}

      <section style={{ ...cardStyle, marginTop: "0.9rem" }}>
        <h3 style={{ margin: "0 0 0.4rem" }}>Recommendations</h3>
        {recommendations.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>No recommendations yet.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "1rem" }}>
            {recommendations.map((row) => (
              <li key={row.recipe_id} style={{ marginTop: "0.45rem" }}>
                <Link to={`/recipes/${row.recipe_id}`}>{row.recipe_name}</Link>
                {row.missing_ingredients.length > 0 ? ` (missing: ${row.missing_ingredients.join(", ")})` : " (ready now)"}
                <div style={{ color: "#475569", fontSize: "0.86rem" }}>{row.reasons.join(", ")}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default ProviderOnboardingPage;



