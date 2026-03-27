import { useMemo, useState } from "react";

import { fetchChefAssistGenerate, fetchPantryForChefAssist, type ChefAssistResponse } from "../lib/chefAssistApi";
import { mapPantryToSupplyItems } from "../lib/providerApi";

const containerStyle: React.CSSProperties = {
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

function ChefAssistPage() {
  const [rawPrompt, setRawPrompt] = useState("Quick skillet dinner with pantry staples");
  const [timeBand, setTimeBand] = useState<"quick" | "standard" | "i_got_time">("standard");
  const [budgetBand, setBudgetBand] = useState<"stretch" | "normal" | "flexible">("normal");
  const [householdBand, setHouseholdBand] = useState<"1_2" | "3_4" | "5_plus">("3_4");
  const [allowMissing, setAllowMissing] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ChefAssistResponse | null>(null);

  const pantryBadgeCount = useMemo(() => result?.pantryAlignment.usedFromPantry.length ?? 0, [result]);

  const onGenerate = async () => {
    setError("");
    setLoading(true);
    try {
      const pantry = await fetchPantryForChefAssist();
      const normalizedPantry = mapPantryToSupplyItems(pantry.items ?? []);
      const response = await fetchChefAssistGenerate({
        rawPrompt,
        pantryItems: normalizedPantry,
        timeBand,
        budgetBand,
        householdBand,
        allowMissing,
      });
      setResult(response);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to generate recipe");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-shell" style={containerStyle}>
      <header style={{ marginBottom: "0.9rem" }}>
        <h1 style={{ margin: 0, fontFamily: '"Space Grotesk", sans-serif' }}>Chef Assist</h1>
        <p style={{ margin: "0.35rem 0 0", color: "#475569" }}>
          Tell me what you want tonight and get a deterministic pantry-grounded recipe.
        </p>
      </header>

      <section style={{ ...cardStyle, display: "grid", gap: "0.7rem", marginBottom: "0.9rem" }}>
        <label htmlFor="chef-assist-prompt" style={{ fontWeight: 700 }}>
          Tell me what you want tonight
        </label>
        <textarea
          id="chef-assist-prompt"
          value={rawPrompt}
          onChange={(event) => setRawPrompt(event.target.value)}
          rows={4}
          style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", padding: "0.7rem", fontSize: "0.96rem" }}
        />

        <div style={{ display: "grid", gap: "0.6rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {(["quick", "standard", "i_got_time"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTimeBand(value)}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 999,
                  padding: "0.4rem 0.75rem",
                  background: timeBand === value ? "#ecfeff" : "#ffffff",
                  color: "#0f172a",
                }}
              >
                {value}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {(["stretch", "normal", "flexible"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setBudgetBand(value)}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 999,
                  padding: "0.4rem 0.75rem",
                  background: budgetBand === value ? "#fffbeb" : "#ffffff",
                  color: "#0f172a",
                }}
              >
                {value}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {(["1_2", "3_4", "5_plus"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setHouseholdBand(value)}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 999,
                  padding: "0.4rem 0.75rem",
                  background: householdBand === value ? "#f8fafc" : "#ffffff",
                  color: "#0f172a",
                }}
              >
                {value}
              </button>
            ))}
          </div>
          <label style={{ color: "#334155", fontSize: "0.9rem" }}>
            allow missing:
            <input
              type="number"
              min={0}
              max={4}
              step={1}
              value={allowMissing}
              onChange={(event) => setAllowMissing(Math.max(0, Math.min(4, Number(event.target.value) || 0)))}
              style={{ marginLeft: "0.5rem", width: 70, border: "1px solid #cbd5e1", borderRadius: 8, padding: "0.25rem 0.4rem" }}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={onGenerate}
          disabled={loading || !rawPrompt.trim()}
          style={{
            border: "1px solid #0c4a6e",
            borderRadius: 10,
            padding: "0.55rem 0.9rem",
            background: "#0e7490",
            color: "#ffffff",
            fontWeight: 700,
            width: "fit-content",
          }}
        >
          {loading ? "Generating..." : "Generate Recipe"}
        </button>
      </section>

      {error && (
        <div role="alert" style={{ ...cardStyle, borderColor: "#fecaca", background: "#fff1f2", color: "#991b1b", marginBottom: "0.9rem" }}>
          {error}
        </div>
      )}

      {result && (
        <section style={{ ...cardStyle, display: "grid", gap: "0.7rem" }}>
          <div>
            <h2 style={{ margin: 0 }}>{result.title}</h2>
            <p style={{ margin: "0.3rem 0 0", color: "#475569" }}>
              {result.archetype} • {result.timeMinutes} min • {result.servingsBand}
            </p>
          </div>

          <div>
            <strong>Ingredients</strong>
            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1rem" }}>
              {result.ingredients.map((ingredient) => (
                <li key={`${ingredient.name}-${ingredient.qty}`} style={{ marginTop: "0.2rem" }}>
                  {ingredient.name} ({ingredient.qty}){" "}
                  <span style={{ fontSize: "0.82rem", color: ingredient.fromPantry ? "#166534" : "#9a3412" }}>
                    [{ingredient.fromPantry ? "pantry" : "missing"}]
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <strong>Steps</strong>
            <ol style={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem" }}>
              {result.steps.map((step) => (
                <li key={step} style={{ marginTop: "0.25rem" }}>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div>
            <strong>Why this works</strong>
            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1rem" }}>
              {result.whyThisWorks.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>

          <div>
            <strong>Safety notes</strong>
            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1rem" }}>
              {result.safetyNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>

          <div style={{ color: "#475569", fontSize: "0.9rem" }}>
            Pantry used: {pantryBadgeCount} • Missing: {result.pantryAlignment.missing.length} • Validation:{" "}
            {result.validation.passed ? "passed" : "failed"}
          </div>
        </section>
      )}
    </main>
  );
}

export default ChefAssistPage;
