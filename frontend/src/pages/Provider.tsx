import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ProviderSection from "../components/provider/ProviderSection";
import { postJson } from "../lib/apiClient";
import { fetchPantry } from "../lib/mvpApi";
import {
  createProviderSessionId,
  fetchMealSequence,
  fetchProviderInsights,
  fetchProviderPlan,
  fetchSupplyPlan,
  fetchUnlockSuggestions,
  mapPantryToSupplyItems,
  type MealSequenceRequest,
  type PlanRequest,
  type SupplyPlanRequest,
  trackProviderFirstResult,
  trackProviderSessionClose,
  trackProviderSessionStart,
} from "../lib/providerApi";

const shellStyle: React.CSSProperties = {
  maxWidth: 860,
  margin: "0 auto",
  padding: "1rem 0.9rem 2rem",
};

const controlButtonStyle: React.CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 999,
  padding: "0.4rem 0.8rem",
  fontWeight: 600,
};

const primaryActionStyle: React.CSSProperties = {
  border: "1px solid #0c4a6e",
  background: "#0e7490",
  color: "#ffffff",
  borderRadius: 10,
  padding: "0.55rem 0.9rem",
  fontWeight: 700,
};

type CommandCenterSummary = {
  supplyLastAt?: string;
  supplyRecommendations?: number;
  supplyBottleneck?: string;
  supplyTtfrMs?: number;
  simulateLastAt?: string;
  simulateAlternatives?: number;
  simulateSummary?: string;
  simulateTtfrMs?: number;
  sequenceLastAt?: string;
  sequenceSeed?: string;
  sequenceDays?: number;
  sequenceTtfrMs?: number;
};

const COMMAND_CENTER_STORAGE_KEY = "provider_command_center_summary_v1";
const ONBOARDING_STORAGE_KEY = "provider_onboarding_state_v1";
const ONBOARDING_TTFR_STORAGE_KEY = "provider_onboarding_ttfr_ms";

function ProviderPage() {
  const sessionId = useMemo(() => createProviderSessionId(), []);
  const firstResultTracked = useRef(false);

  const [focus, setFocus] = useState<PlanRequest["focus"]>("stability");
  const [horizonDays, setHorizonDays] = useState<PlanRequest["horizonDays"]>(7);

  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingUnlock, setLoadingUnlock] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingSupply, setLoadingSupply] = useState(false);
  const [loadingSequence, setLoadingSequence] = useState(false);

  const [error, setError] = useState("");
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [insights, setInsights] = useState<Awaited<ReturnType<typeof fetchProviderInsights>> | null>(null);
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof fetchProviderPlan>> | null>(null);
  const [supplyPlan, setSupplyPlan] = useState<Awaited<ReturnType<typeof fetchSupplyPlan>> | null>(null);
  const [sequencePlan, setSequencePlan] = useState<Awaited<ReturnType<typeof fetchMealSequence>> | null>(null);
  const [unlock, setUnlock] = useState<Awaited<ReturnType<typeof fetchUnlockSuggestions>>>([]);
  const [sequenceDays, setSequenceDays] = useState<MealSequenceRequest["days"]>(3);
  const [sequenceHouseholdBand, setSequenceHouseholdBand] = useState<MealSequenceRequest["householdBand"]>("3_4");
  const [sequenceTimeBand, setSequenceTimeBand] = useState<MealSequenceRequest["timeBand"]>("standard");
  const [sequenceBudgetBand, setSequenceBudgetBand] = useState<MealSequenceRequest["budgetBand"]>("normal");
  const [loadingSimulate, setLoadingSimulate] = useState(false);
  const [commandSummary, setCommandSummary] = useState<CommandCenterSummary>(() => {
    try {
      const raw = localStorage.getItem(COMMAND_CENTER_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as CommandCenterSummary;
      return parsed ?? {};
    } catch {
      return {};
    }
  });

  const onboardingStatus = useMemo(() => {
    let step = 1;
    try {
      const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { step?: number };
        if (parsed.step && [1, 2, 3].includes(parsed.step)) {
          step = parsed.step;
        }
      }
    } catch {
      // keep defaults
    }
    const ttfrRaw = localStorage.getItem(ONBOARDING_TTFR_STORAGE_KEY);
    const ttfr = ttfrRaw ? Number(ttfrRaw) : undefined;
    return { step, ttfr: Number.isFinite(ttfr) ? ttfr : undefined };
  }, []);

  const markFirstResult = useCallback(
    (source: string) => {
      if (firstResultTracked.current) return;
      firstResultTracked.current = true;
      void trackProviderFirstResult(sessionId, source);
    },
    [sessionId],
  );

  const refreshInsightsAndUnlock = useCallback(async () => {
    setError("");
    setLoadingInsights(true);
    setLoadingUnlock(true);

    const [insightsResult, unlockResult] = await Promise.allSettled([
      fetchProviderInsights(),
      fetchUnlockSuggestions(),
    ]);

    if (insightsResult.status === "fulfilled") {
      setInsights(insightsResult.value);
      markFirstResult("insights");
    } else {
      setError(insightsResult.reason instanceof Error ? insightsResult.reason.message : "Failed to load insights.");
    }

    if (unlockResult.status === "fulfilled") {
      setUnlock(unlockResult.value);
      markFirstResult("unlock");
    } else {
      setError((prev) => prev || (unlockResult.reason instanceof Error ? unlockResult.reason.message : "Failed to load unlock suggestions."));
    }

    setLoadingInsights(false);
    setLoadingUnlock(false);
  }, [markFirstResult]);

  const generatePlan = useCallback(async () => {
    setError("");
    setLoadingPlan(true);

    try {
      const response = await fetchProviderPlan({ focus, horizonDays });
      setPlan(response);
      markFirstResult("plan");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to generate plan");
    } finally {
      setLoadingPlan(false);
    }
  }, [focus, horizonDays, markFirstResult]);

  const loadPantryItems = useCallback(async (): Promise<string[]> => {
    const data = await fetchPantry();
    const names = mapPantryToSupplyItems(data.items ?? []);
    setPantryItems(names);
    return names;
  }, []);

  const generateSupplyPlan = useCallback(async () => {
    setError("");
    setLoadingSupply(true);
    const startedAt = Date.now();
    try {
      const currentPantry = await loadPantryItems();
      const payload: SupplyPlanRequest = {
        pantryItems: currentPantry,
        householdBand: "3_4",
        daysTarget: horizonDays,
        budgetSensitivity: "normal",
      };
      const response = await fetchSupplyPlan(payload);
      setSupplyPlan(response);
      const finishedAt = Date.now();
      setCommandSummary((prev) => ({
        ...prev,
        supplyLastAt: new Date(finishedAt).toISOString(),
        supplyRecommendations: response.recommendations.length,
        supplyBottleneck: response.bottleneckIngredient,
        supplyTtfrMs: Math.max(finishedAt - startedAt, 0),
      }));
      markFirstResult("supply_plan");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to generate supply plan");
    } finally {
      setLoadingSupply(false);
    }
  }, [horizonDays, loadPantryItems, markFirstResult]);

  const generateMealSequence = useCallback(async () => {
    setError("");
    setLoadingSequence(true);
    const startedAt = Date.now();
    try {
      const currentPantry = await loadPantryItems();
      const response = await fetchMealSequence({
        days: sequenceDays,
        householdBand: sequenceHouseholdBand,
        timeBand: sequenceTimeBand,
        budgetBand: sequenceBudgetBand,
        pantryItems: currentPantry,
        allowMissingMax: 2,
      });
      setSequencePlan(response);
      const finishedAt = Date.now();
      setCommandSummary((prev) => ({
        ...prev,
        sequenceLastAt: new Date(finishedAt).toISOString(),
        sequenceSeed: response.deterministicSeed,
        sequenceDays: response.plan.length,
        sequenceTtfrMs: Math.max(finishedAt - startedAt, 0),
      }));
      markFirstResult("sequence");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to build meal sequence");
    } finally {
      setLoadingSequence(false);
    }
  }, [loadPantryItems, markFirstResult, sequenceBudgetBand, sequenceDays, sequenceHouseholdBand, sequenceTimeBand]);

  const runSupplySimulation = useCallback(async () => {
    setError("");
    setLoadingSimulate(true);
    const startedAt = Date.now();
    try {
      const currentPantry = await loadPantryItems();
      const data = await postJson<{
        alternatives?: unknown[];
        baseline_plan?: { recommendations?: unknown[] };
      }>("/supply/simulate", {
        pantry: currentPantry,
        days: sequenceDays,
        goal: "balanced",
        locked_items: [],
        excluded_items: [],
      });
      const finishedAt = Date.now();
      const alternatives = Array.isArray(data.alternatives) ? data.alternatives.length : 0;
      const baselineRows = Array.isArray(data.baseline_plan?.recommendations) ? data.baseline_plan.recommendations.length : 0;
      setCommandSummary((prev) => ({
        ...prev,
        simulateLastAt: new Date(finishedAt).toISOString(),
        simulateAlternatives: alternatives,
        simulateSummary: `Baseline ${baselineRows} item(s), alternatives ${alternatives}.`,
        simulateTtfrMs: Math.max(finishedAt - startedAt, 0),
      }));
      markFirstResult("supply_simulate");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to run supply simulation");
    } finally {
      setLoadingSimulate(false);
    }
  }, [loadPantryItems, markFirstResult, sequenceDays]);

  useEffect(() => {
    localStorage.setItem(COMMAND_CENTER_STORAGE_KEY, JSON.stringify(commandSummary));
  }, [commandSummary]);

  useEffect(() => {
    void trackProviderSessionStart(sessionId);
    void refreshInsightsAndUnlock();
    void loadPantryItems().catch(() => {
      // Pantry grounding is best-effort on first load.
    });

    const onBeforeUnload = () => {
      void trackProviderSessionClose(sessionId, "beforeunload");
    };

    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void trackProviderSessionClose(sessionId, "unmount");
    };
  }, [loadPantryItems, refreshInsightsAndUnlock, sessionId]);

  return (
    <main className="page-shell" style={shellStyle}>
      <header style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontFamily: '"Space Grotesk", sans-serif' }}>Provider</h1>
        <p style={{ margin: "0.4rem 0 0", color: "#475569", fontSize: "0.96rem" }}>
          Mobile-first briefing for insights, weekly movement, nudges, and unlock opportunities.
        </p>
        <p style={{ margin: "0.4rem 0 0", fontSize: "0.9rem" }}>
          <Link to="/provider/onboarding">Run 3-step onboarding</Link>
        </p>
      </header>

      <section
        style={{
          border: "1px solid #dbe4ef",
          borderRadius: 14,
          padding: "0.9rem",
          marginBottom: "0.95rem",
          background: "#ffffff",
          display: "grid",
          gap: "0.7rem",
        }}
      >
        <strong style={{ fontSize: "0.96rem" }}>Command Center</strong>
        <div style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <article style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "0.7rem", background: "#f8fafc" }}>
            <div style={{ fontWeight: 700 }}>Onboarding</div>
            <div style={{ color: "#475569", fontSize: "0.86rem", marginTop: "0.2rem" }}>
              Step {onboardingStatus.step}/3
              {onboardingStatus.ttfr ? ` • TTFR ${onboardingStatus.ttfr}ms` : ""}
            </div>
            {onboardingStatus.step >= 3 ? (
              <button type="button" style={{ ...controlButtonStyle, marginTop: "0.45rem" }} onClick={generateSupplyPlan}>
                Next: Build Supply Plan
              </button>
            ) : (
              <Link to="/provider/onboarding" style={{ display: "inline-block", marginTop: "0.45rem" }}>
                Continue Onboarding
              </Link>
            )}
          </article>

          <article style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "0.7rem", background: "#f8fafc" }}>
            <div style={{ fontWeight: 700 }}>Chef Assist</div>
            <div style={{ color: "#475569", fontSize: "0.86rem", marginTop: "0.2rem" }}>
              Generate a constrained dinner from pantry context.
            </div>
            <Link to="/provider/chef-assist" style={{ display: "inline-block", marginTop: "0.45rem" }}>
              Open Chef Assist
            </Link>
          </article>

          <article style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "0.7rem", background: "#f8fafc" }}>
            <div style={{ fontWeight: 700 }}>Supply Plan</div>
            <div style={{ color: "#475569", fontSize: "0.86rem", marginTop: "0.2rem" }}>
              {commandSummary.supplyRecommendations !== undefined
                ? `${commandSummary.supplyRecommendations} item(s) • bottleneck ${commandSummary.supplyBottleneck ?? "n/a"}`
                : "No plan yet"}
            </div>
            <button type="button" style={{ ...controlButtonStyle, marginTop: "0.45rem" }} onClick={generateSupplyPlan} disabled={loadingSupply}>
              {loadingSupply ? "Building..." : "Build Supply Plan"}
            </button>
          </article>

          <article style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "0.7rem", background: "#f8fafc" }}>
            <div style={{ fontWeight: 700 }}>Simulate</div>
            <div style={{ color: "#475569", fontSize: "0.86rem", marginTop: "0.2rem" }}>
              {commandSummary.simulateSummary ?? "No simulation yet"}
            </div>
            <button type="button" style={{ ...controlButtonStyle, marginTop: "0.45rem" }} onClick={runSupplySimulation} disabled={loadingSimulate}>
              {loadingSimulate ? "Simulating..." : "Run Alternatives"}
            </button>
          </article>

          <article style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "0.7rem", background: "#f8fafc" }}>
            <div style={{ fontWeight: 700 }}>Sequencing</div>
            <div style={{ color: "#475569", fontSize: "0.86rem", marginTop: "0.2rem" }}>
              {commandSummary.sequenceDays !== undefined
                ? `${commandSummary.sequenceDays} day(s) • seed ${commandSummary.sequenceSeed ?? "n/a"}`
                : "No sequence yet"}
            </div>
            <button type="button" style={{ ...controlButtonStyle, marginTop: "0.45rem" }} onClick={generateMealSequence} disabled={loadingSequence}>
              {loadingSequence ? "Building..." : "Build Next Dinners"}
            </button>
          </article>
        </div>
      </section>

      <section
        style={{
          border: "1px solid #dbe4ef",
          borderRadius: 14,
          padding: "0.9rem",
          marginBottom: "0.95rem",
          background: "#f8fbff",
          display: "grid",
          gap: "0.8rem",
        }}
      >
        <strong style={{ fontSize: "0.96rem" }}>Plan Controls</strong>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ color: "#475569", fontSize: "0.85rem" }}>Focus</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {(["stability", "growth", "efficiency"] as const).map((value) => {
              const selected = focus === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFocus(value)}
                  style={{
                    ...controlButtonStyle,
                    background: selected ? "#e0f2fe" : "#ffffff",
                    borderColor: selected ? "#0284c7" : "#cbd5e1",
                    color: selected ? "#075985" : "#0f172a",
                  }}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gap: "0.35rem" }}>
          <span style={{ color: "#475569", fontSize: "0.85rem" }}>Horizon</span>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {([7, 14, 30] as const).map((value) => {
              const selected = horizonDays === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setHorizonDays(value)}
                  style={{
                    ...controlButtonStyle,
                    background: selected ? "#ecfeff" : "#ffffff",
                    borderColor: selected ? "#0891b2" : "#cbd5e1",
                    color: selected ? "#155e75" : "#0f172a",
                  }}
                >
                  {value}d
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button type="button" style={primaryActionStyle} onClick={generatePlan} disabled={loadingPlan}>
            {loadingPlan ? "Building plan..." : "Generate Forecast Nudges"}
          </button>
          <button type="button" style={primaryActionStyle} onClick={generateSupplyPlan} disabled={loadingSupply}>
            {loadingSupply ? "Building supply plan..." : "Build Supply Plan"}
          </button>
          <button type="button" style={primaryActionStyle} onClick={generateMealSequence} disabled={loadingSequence}>
            {loadingSequence ? "Building sequence..." : "Build Next Dinners"}
          </button>
          <button
            type="button"
            onClick={() => {
              void refreshInsightsAndUnlock();
            }}
            style={{ ...controlButtonStyle, borderRadius: 10 }}
            disabled={loadingInsights || loadingUnlock}
          >
            {loadingInsights || loadingUnlock ? "Refreshing..." : "Refresh Insights"}
          </button>
        </div>

        <div style={{ borderTop: "1px solid #dbe4ef", paddingTop: "0.75rem", display: "grid", gap: "0.55rem" }}>
          <strong style={{ fontSize: "0.9rem" }}>Sequencing Controls</strong>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ color: "#475569", fontSize: "0.85rem" }}>Days</span>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {([3, 5, 7] as const).map((value) => {
                const selected = sequenceDays === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSequenceDays(value)}
                    style={{
                      ...controlButtonStyle,
                      background: selected ? "#f0fdfa" : "#ffffff",
                      borderColor: selected ? "#0d9488" : "#cbd5e1",
                      color: selected ? "#115e59" : "#0f172a",
                    }}
                  >
                    {value} days
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ color: "#475569", fontSize: "0.85rem" }}>Time band</span>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {(["quick", "standard", "i_got_time"] as const).map((value) => {
                const selected = sequenceTimeBand === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSequenceTimeBand(value)}
                    style={{
                      ...controlButtonStyle,
                      background: selected ? "#ecfeff" : "#ffffff",
                      borderColor: selected ? "#0891b2" : "#cbd5e1",
                      color: selected ? "#155e75" : "#0f172a",
                    }}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ color: "#475569", fontSize: "0.85rem" }}>Budget band</span>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {(["stretch", "normal", "flexible"] as const).map((value) => {
                const selected = sequenceBudgetBand === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSequenceBudgetBand(value)}
                    style={{
                      ...controlButtonStyle,
                      background: selected ? "#fffbeb" : "#ffffff",
                      borderColor: selected ? "#d97706" : "#cbd5e1",
                      color: selected ? "#92400e" : "#0f172a",
                    }}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "grid", gap: "0.35rem" }}>
            <span style={{ color: "#475569", fontSize: "0.85rem" }}>Household band</span>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {(["1_2", "3_4", "5_plus"] as const).map((value) => {
                const selected = sequenceHouseholdBand === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSequenceHouseholdBand(value)}
                    style={{
                      ...controlButtonStyle,
                      background: selected ? "#f8fafc" : "#ffffff",
                      borderColor: selected ? "#334155" : "#cbd5e1",
                      color: selected ? "#0f172a" : "#334155",
                    }}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          style={{ marginBottom: "0.95rem", border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", padding: "0.75rem", borderRadius: 10 }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "grid", gap: "0.9rem" }}>
        <ProviderSection
          title="What's the Damage"
          subtitle={insights?.whatsTheDamage.headline ?? "Loading damage signal..."}
          highlights={insights?.whatsTheDamage.bullets ?? ["Waiting for /insights response"]}
        >
          <p style={{ margin: 0, color: "#334155" }}>{insights?.whatsTheDamage.detail ?? ""}</p>
        </ProviderSection>

        <ProviderSection
          title="Scarcity Simulation"
          subtitle={insights?.scarcitySimulation.headline ?? "Loading scarcity simulation..."}
          highlights={insights?.scarcitySimulation.bullets ?? ["Waiting for /insights response"]}
        >
          <p style={{ margin: 0, color: "#334155" }}>{insights?.scarcitySimulation.detail ?? ""}</p>
        </ProviderSection>

        <ProviderSection
          title="Provider Weekly Summary"
          subtitle={insights?.weeklySummary.headline ?? "Loading weekly summary..."}
          highlights={insights?.weeklySummary.bullets ?? ["Waiting for /insights response"]}
        >
          <p style={{ margin: 0, color: "#334155" }}>{insights?.weeklySummary.detail ?? ""}</p>
        </ProviderSection>

        <ProviderSection
          title="Forecast Nudges"
          subtitle={plan?.generatedAt ? `Generated ${new Date(plan.generatedAt).toLocaleString()}` : "Generate a plan to see nudges"}
          highlights={plan?.forecastNudges ?? ["No forecast nudges yet"]}
        />

        <ProviderSection
          title="Supply Plan"
          subtitle={
            supplyPlan
              ? `Bottleneck: ${supplyPlan.bottleneckIngredient} | Protein exhaustion day: ${supplyPlan.proteinExhaustionDay} | Pantry items: ${pantryItems.length}`
              : "Generate a supply move to stabilize your week"
          }
          highlights={
            supplyPlan
              ? supplyPlan.recommendations.map(
                  (row) =>
                    `${row.ingredient}: +${row.coverageDeltaDays} day(s), +${row.mealsUnlocked} meals, ${row.estimatedSpendBand}`,
                )
              : ["No supply move yet"]
          }
        />

        <ProviderSection
          title="Sequencing"
          subtitle={
            sequencePlan
              ? `Seed ${sequencePlan.deterministicSeed} | coverage ${sequencePlan.planSummary.coverageBand} | waste ${sequencePlan.planSummary.wasteRiskBand} | protein ${sequencePlan.planSummary.proteinStabilityBand}`
              : "Build next dinners to simulate pantry depletion across upcoming days"
          }
          highlights={sequencePlan?.planSummary.notes ?? ["No dinner sequence yet"]}
        >
          <div style={{ display: "grid", gap: "0.55rem" }}>
            {(sequencePlan?.plan ?? []).map((day) => (
              <article
                key={day.dayIndex}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "0.65rem",
                  background: "#f8fafc",
                }}
              >
                <div style={{ fontWeight: 700, color: "#0f172a" }}>
                  Day {day.dayIndex}: {day.recipeName}
                </div>
                <div style={{ fontSize: "0.86rem", color: "#475569", marginTop: "0.25rem" }}>
                  Missing required: {day.missingRequiredCount}
                  {day.missingRequired.length > 0 ? ` (${day.missingRequired.join(", ")})` : ""}
                </div>
                <ul style={{ margin: "0.45rem 0 0", paddingLeft: "1rem" }}>
                  {day.reasons.map((reason) => (
                    <li key={`${day.dayIndex}-${reason}`} style={{ color: "#1e293b", marginTop: "0.2rem" }}>
                      {reason}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </ProviderSection>

        <ProviderSection
          title="Archetype Fit"
          subtitle={insights?.archetypeFit.headline ?? "Loading archetype fit..."}
          highlights={insights?.archetypeFit.bullets ?? ["Waiting for /insights response"]}
        >
          <p style={{ margin: 0, color: "#334155" }}>{insights?.archetypeFit.detail ?? ""}</p>
        </ProviderSection>

        <ProviderSection
          title="Unlock suggestions"
          subtitle="Pulled from /unlock"
          highlights={unlock.map((item) => `${item.title}: ${item.reason}`)}
        >
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {unlock.map((item) => (
              <span
                key={`${item.title}-${item.action}`}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 999,
                  padding: "0.25rem 0.65rem",
                  background: "#ffffff",
                  fontSize: "0.84rem",
                  color: "#1f2937",
                }}
              >
                {item.action}
              </span>
            ))}
          </div>
        </ProviderSection>
      </div>
    </main>
  );
}

export default ProviderPage;


