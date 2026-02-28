import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProviderSection from "../components/provider/ProviderSection";
import {
  createProviderSessionId,
  fetchProviderInsights,
  fetchProviderPlan,
  fetchSupplyPlan,
  fetchUnlockSuggestions,
  mapPantryToSupplyItems,
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

function ProviderPage() {
  const sessionId = useMemo(() => createProviderSessionId(), []);
  const firstResultTracked = useRef(false);

  const [focus, setFocus] = useState<PlanRequest["focus"]>("stability");
  const [horizonDays, setHorizonDays] = useState<PlanRequest["horizonDays"]>(7);

  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingUnlock, setLoadingUnlock] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingSupply, setLoadingSupply] = useState(false);

  const [error, setError] = useState("");
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [insights, setInsights] = useState<Awaited<ReturnType<typeof fetchProviderInsights>> | null>(null);
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof fetchProviderPlan>> | null>(null);
  const [supplyPlan, setSupplyPlan] = useState<Awaited<ReturnType<typeof fetchSupplyPlan>> | null>(null);
  const [unlock, setUnlock] = useState<Awaited<ReturnType<typeof fetchUnlockSuggestions>>>([]);

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
    const response = await fetch("/pantry");
    if (!response.ok) throw new Error("Failed to load pantry for supply planning");
    const data = (await response.json()) as { items?: Array<{ ingredient?: unknown; name?: unknown }> };
    const names = mapPantryToSupplyItems(data.items ?? []);
    setPantryItems(names);
    return names;
  }, []);

  const generateSupplyPlan = useCallback(async () => {
    setError("");
    setLoadingSupply(true);
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
      markFirstResult("supply_plan");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to generate supply plan");
    } finally {
      setLoadingSupply(false);
    }
  }, [horizonDays, loadPantryItems, markFirstResult]);

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
      </header>

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
