import { useMemo, useState } from "react";

type QuickStartOnboardingProps = {
  busy: boolean;
  error: string;
  pendingIngredients: string[];
  selectedIngredients: string[];
  selectionStatus: string;
  onSkip: () => void;
  onStart: () => void;
  onToggleIngredient: (ingredient: string) => void;
};

const QUICK_START_GROUPS = [
  { title: "Proteins", items: ["chicken", "beef", "eggs"] },
  { title: "Carbs", items: ["rice", "pasta", "bread"] },
  { title: "Basics", items: ["milk", "butter", "cheese"] },
  { title: "Vegetables", items: ["onion", "tomato", "spinach"] },
] as const;

const QUICK_START_ITEMS = QUICK_START_GROUPS.flatMap((group) => group.items);

function QuickStartOnboarding({
  busy,
  error,
  pendingIngredients,
  selectedIngredients,
  selectionStatus,
  onSkip,
  onStart,
  onToggleIngredient,
}: QuickStartOnboardingProps) {
  const [started, setStarted] = useState(false);
  const [search, setSearch] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIngredients.map((item) => item.toLowerCase())), [selectedIngredients]);
  const pendingSet = useMemo(() => new Set(pendingIngredients.map((item) => item.toLowerCase())), [pendingIngredients]);
  const normalizedSearch = search.trim().toLowerCase();
  const unlockReached = selectedIngredients.length >= 3;

  const filteredGroups = useMemo(
    () =>
      QUICK_START_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => item.includes(normalizedSearch)),
      })).filter((group) => group.items.length > 0),
    [normalizedSearch],
  );

  const suggestedMatches = useMemo(() => QUICK_START_ITEMS.filter((item) => item.includes(normalizedSearch)).slice(0, 6), [normalizedSearch]);

  if (!started && selectedIngredients.length === 0) {
    return (
      <section
        style={{
          marginTop: "1.4rem",
          display: "grid",
          gap: "1rem",
          border: "1px solid #dbe4ef",
          borderRadius: 22,
          padding: "1.25rem",
          background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(240,249,255,0.96) 100%)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ color: "#0f766e", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          First Dinner
        </div>
        <div style={{ display: "grid", gap: "0.55rem", maxWidth: 680 }}>
          <h2 style={{ margin: 0, color: "#0f172a", fontSize: "1.85rem", lineHeight: 1.05, fontFamily: '"Space Grotesk", sans-serif' }}>
            Turn what you already have into dinner
          </h2>
          <p style={{ margin: 0, color: "#475569", fontSize: "1rem" }}>
            Pick a few things you have, and we&apos;ll find your best option for tonight.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setStarted(true);
              onStart();
            }}
            style={{
              padding: "0.82rem 1.05rem",
              borderRadius: 12,
              border: "1px solid #0f766e",
              background: "#0f766e",
              color: "#ffffff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Start
          </button>
          <button
            type="button"
            onClick={onSkip}
            style={{
              padding: "0.82rem 1.05rem",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Skip for now
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        marginTop: "1.4rem",
        display: "grid",
        gap: "1rem",
        border: "1px solid #dbe4ef",
        borderRadius: 22,
        padding: "1.2rem",
        background: "#ffffff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "start" }}>
        <div style={{ display: "grid", gap: "0.35rem", maxWidth: 720 }}>
          <div style={{ color: "#0f766e", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Quick Pantry Start
          </div>
          <h2 style={{ margin: 0, color: "#0f172a", fontSize: "1.45rem" }}>
            {unlockReached ? "Keep adding ingredients to sharpen tonight's match" : "Pick 3 ingredients to unlock your first dinner idea"}
          </h2>
          <p style={{ margin: 0, color: "#475569" }}>
            {unlockReached
              ? "You've unlocked your first result. Keep tapping ingredients you have and we'll keep improving your matches."
              : "Tap a few pantry basics you already have and we'll unlock your first Cook Tonight recommendation."}
          </p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          style={{
            padding: "0.72rem 0.95rem",
            borderRadius: 12,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {unlockReached ? "Hide for now" : "Skip for now"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gap: "0.4rem",
          borderRadius: 18,
          border: "1px solid #bfdbfe",
          background: "#eff6ff",
          padding: "0.95rem",
        }}
      >
        <div style={{ color: "#1d4ed8", fontWeight: 700 }}>
          {unlockReached
            ? "You've unlocked your first result - add more ingredients to improve your matches."
            : `${selectedIngredients.length}/3 selected`}
        </div>
        <div style={{ color: "#334155", fontSize: "0.95rem" }}>
          {unlockReached
            ? "Minimal defaults are still fine here. Keep using the same quick taps, and you can fine-tune quantities later in Pantry if you want."
            : "Minimal defaults are fine here. You can fine-tune quantities later in Pantry if you want."}
        </div>
        {selectedIngredients.length > 0 && (
          <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", marginTop: "0.2rem" }}>
            {selectedIngredients.map((item) => (
              <span
                key={item}
                style={{
                  borderRadius: 999,
                  padding: "0.28rem 0.65rem",
                  border: "1px solid #93c5fd",
                  background: "#ffffff",
                  color: "#1e3a8a",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                }}
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      <label style={{ display: "grid", gap: "0.35rem", color: "#334155", fontWeight: 600 }}>
        Search ingredients
        <input
          aria-label="Search ingredients"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search chips"
          style={{ padding: "0.78rem", borderRadius: 12, border: "1px solid #cbd5e1" }}
          disabled={busy}
        />
      </label>

      {normalizedSearch && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {suggestedMatches.length > 0 ? (
            suggestedMatches.map((item) => {
              const selected = selectedSet.has(item);
              const pending = pendingSet.has(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    onToggleIngredient(item);
                  }}
                  disabled={busy || pending}
                  style={{
                    padding: "0.65rem 0.85rem",
                    borderRadius: 999,
                    border: selected ? "1px solid #0f766e" : "1px solid #cbd5e1",
                    background: selected ? "#f0fdfa" : "#ffffff",
                    color: selected ? "#115e59" : "#0f172a",
                    fontWeight: 700,
                    cursor: busy || pending ? "progress" : "pointer",
                  }}
                >
                  {pending ? `Saving ${item}...` : selected ? `${item} added` : item}
                </button>
              );
            })
          ) : (
            <div style={{ color: "#64748b", fontSize: "0.92rem" }}>No quick-start chips match that search yet.</div>
          )}
        </div>
      )}

      <div style={{ display: "grid", gap: "0.9rem" }}>
        {filteredGroups.map((group) => (
          <div key={group.title} style={{ display: "grid", gap: "0.5rem" }}>
            <div style={{ color: "#0f172a", fontWeight: 700 }}>{group.title}</div>
            <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
              {group.items.map((item) => {
                const selected = selectedSet.has(item);
                const pending = pendingSet.has(item);

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      onToggleIngredient(item);
                    }}
                    disabled={busy || pending}
                    style={{
                      padding: "0.72rem 0.95rem",
                      borderRadius: 999,
                      border: selected ? "1px solid #0f766e" : "1px solid #cbd5e1",
                      background: selected ? "#f0fdfa" : "#ffffff",
                      color: selected ? "#115e59" : "#0f172a",
                      fontWeight: 700,
                      cursor: busy || pending ? "progress" : "pointer",
                    }}
                  >
                    {pending ? `Saving ${item}...` : selected ? `${item} added` : item}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selectionStatus && <div style={{ color: "#166534", fontWeight: 600 }}>{selectionStatus}</div>}
      {error && <div style={{ color: "#991b1b" }}>{error}</div>}
    </section>
  );
}

export default QuickStartOnboarding;
