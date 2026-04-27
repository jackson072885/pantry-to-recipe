import { type CSSProperties, useMemo, useState } from "react";
import { QUICK_START_ITEMS, QUICK_START_SECTIONS } from "./quickStartCatalog";

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

const shellStyle: CSSProperties = {
  position: "relative",
  marginTop: 0,
  display: "grid",
  gap: "1rem",
  overflow: "hidden",
  borderRadius: 28,
  border: "1px solid rgba(15, 23, 42, 0.08)",
  padding: "1.25rem",
  background: "linear-gradient(180deg, rgba(255, 253, 248, 0.98) 0%, rgba(248, 244, 233, 0.98) 100%)",
  boxShadow: "0 24px 52px rgba(15, 23, 42, 0.09), inset 0 1px 0 rgba(255, 255, 255, 0.75)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#102018",
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: "clamp(1.9rem, 4vw, 2.5rem)",
  lineHeight: 0.98,
  letterSpacing: "-0.04em",
};

const bodyStyle: CSSProperties = {
  margin: 0,
  color: "#50615a",
  fontSize: "1rem",
  lineHeight: 1.55,
};

const primaryButtonStyle: CSSProperties = {
  minHeight: 46,
  padding: "0.9rem 1.15rem",
  borderRadius: 14,
  border: "1px solid #143728",
  background: "linear-gradient(180deg, #214f3a 0%, #143728 100%)",
  color: "#ffffff",
  boxShadow: "0 10px 24px rgba(20, 55, 40, 0.18)",
  fontWeight: 700,
  letterSpacing: "0.01em",
  cursor: "pointer",
  transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease",
};

const secondaryButtonStyle: CSSProperties = {
  minHeight: 46,
  padding: "0.9rem 1.15rem",
  borderRadius: 14,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  background: "rgba(255, 255, 255, 0.74)",
  color: "#102018",
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.05)",
  fontWeight: 650,
  cursor: "pointer",
  transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease",
};

const cardStyle: CSSProperties = {
  display: "grid",
  gap: "1rem",
  borderRadius: 24,
  border: "1px solid rgba(33, 79, 58, 0.12)",
  padding: "1.1rem",
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(250, 247, 239, 0.98) 100%)",
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.75)",
};

const statusPillStyle: CSSProperties = {
  borderRadius: 999,
  padding: "0.32rem 0.68rem",
  border: "1px solid rgba(33, 79, 58, 0.14)",
  background: "rgba(203, 232, 107, 0.18)",
  color: "#214f3a",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const subtleTagStyle: CSSProperties = {
  color: "#214f3a",
  fontWeight: 700,
  fontSize: "0.78rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const inputStyle: CSSProperties = {
  padding: "0.82rem 0.9rem",
  borderRadius: 14,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  background: "rgba(255, 255, 255, 0.9)",
  color: "#102018",
  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.8)",
};

const chipBaseStyle: CSSProperties = {
  minHeight: 42,
  padding: "0.7rem 0.95rem",
  borderRadius: 999,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  background: "rgba(255, 255, 255, 0.92)",
  color: "#102018",
  boxShadow: "0 8px 18px rgba(15, 23, 42, 0.04)",
  fontWeight: 700,
  cursor: "pointer",
  transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease",
};

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
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const selectedSet = useMemo(() => new Set(selectedIngredients.map((item) => item.toLowerCase())), [selectedIngredients]);
  const pendingSet = useMemo(() => new Set(pendingIngredients.map((item) => item.toLowerCase())), [pendingIngredients]);
  const normalizedSearch = search.trim().toLowerCase();
  const unlockReached = selectedIngredients.length >= 3;

  const filteredGroups = useMemo(
    () =>
      QUICK_START_SECTIONS.map((section) => {
        const expanded = expandedSections.includes(section.title);
        const sourceItems = normalizedSearch
          ? section.allItems
          : expanded
            ? section.allItems
            : section.defaultItems;
        return {
          ...section,
          expanded,
          items: sourceItems.filter((item) => item.includes(normalizedSearch)),
        };
      }).filter((section) => section.items.length > 0),
    [expandedSections, normalizedSearch],
  );

  const suggestedMatches = useMemo(() => QUICK_START_ITEMS.filter((item) => item.includes(normalizedSearch)).slice(0, 6), [normalizedSearch]);

  if (!started && selectedIngredients.length === 0) {
    return (
      <section
        style={{
          ...shellStyle,
          gap: "0.95rem",
          maxWidth: 980,
          marginInline: "auto",
          borderRadius: 30,
          padding: "1.35rem 1.55rem 1.25rem",
          background: "linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(249, 244, 236, 0.96) 100%)",
          boxShadow: "0 18px 40px rgba(18, 40, 28, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            pointerEvents: "none",
            position: "absolute",
            inset: "-28% -18% auto auto",
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(185, 255, 89, 0.12) 0%, rgba(185, 255, 89, 0.03) 40%, transparent 72%)",
            filter: "blur(4px)",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            pointerEvents: "none",
            position: "absolute",
            inset: "0 auto auto 0",
            width: "100%",
            height: 2,
            background: "linear-gradient(90deg, rgba(33, 79, 58, 0) 0%, rgba(33, 79, 58, 0.45) 22%, rgba(185, 255, 89, 0.75) 55%, rgba(33, 79, 58, 0) 88%)",
          }}
        />
        <div style={{ display: "grid", gap: "0.75rem", justifyItems: "center", textAlign: "center" }}>
          <div style={{ display: "flex", gap: "0.7rem", alignItems: "center", justifyContent: "center", flexWrap: "wrap", fontSize: "clamp(1.35rem, 2vw, 1.72rem)", color: "#163222", fontWeight: 700 }}>
            <span
              aria-hidden="true"
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                border: "5px solid #CBE86B",
                boxShadow: "0 0 0 4px rgba(203, 232, 107, 0.12)",
                background: "#fffdfa",
              }}
            />
            <span style={{ color: "#30463A", fontWeight: 500 }}>Phase 1:</span>
            <span>Add what you already have</span>
          </div>
          <p style={{ ...bodyStyle, fontSize: "clamp(0.98rem, 1.55vw, 1.04rem)", maxWidth: 760, textAlign: "center" }}>
            Start with a few pantry items so we can suggest the best dinner for tonight.
          </p>
        </div>
        <div style={{ height: 1, background: "rgba(31, 61, 46, 0.08)" }} />
        <div style={{ display: "grid", gap: "0.9rem", justifyItems: "center" }}>
          <button
            type="button"
            onClick={() => {
              setStarted(true);
              onStart();
            }}
            style={{ ...primaryButtonStyle, width: "min(100%, 430px)", minHeight: 60, borderRadius: 16, fontSize: "clamp(1rem, 1.8vw, 1.18rem)" }}
          >
            Build My Pantry
          </button>
          <button type="button" onClick={onSkip} style={{ ...secondaryButtonStyle, width: "min(100%, 430px)", minHeight: 56, borderRadius: 16, border: "2px solid rgba(190, 214, 95, 0.9)", fontSize: "clamp(0.98rem, 1.6vw, 1.08rem)" }}>
            Try a Sample Pantry
          </button>
          <div style={{ color: "#5b6861", fontSize: "clamp(0.92rem, 1.45vw, 1rem)", textAlign: "center" }}>
            Try simple items like eggs, rice, onion, chicken, pasta, cheese.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={shellStyle}>
      <div
        aria-hidden="true"
        style={{
          pointerEvents: "none",
          position: "absolute",
          inset: "-26% auto auto -12%",
          width: 200,
          height: 200,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(185, 255, 89, 0.12) 0%, rgba(185, 255, 89, 0.03) 40%, transparent 72%)",
          filter: "blur(6px)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          pointerEvents: "none",
          position: "absolute",
          inset: "auto 0 0",
          height: 1,
          background: "linear-gradient(90deg, rgba(33, 79, 58, 0) 0%, rgba(33, 79, 58, 0.18) 24%, rgba(33, 79, 58, 0.06) 100%)",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", alignItems: "start" }}>
        <div style={{ display: "grid", gap: "0.35rem", maxWidth: 720 }}>
          <div style={subtleTagStyle}>Quick Pantry Start</div>
          <h2 style={{ ...titleStyle, fontSize: "clamp(1.35rem, 2.8vw, 1.7rem)", lineHeight: 1.1 }}>
            {unlockReached ? "Keep adding ingredients to sharpen tonight's match" : "Pick 3 ingredients to unlock your first dinner idea"}
          </h2>
          <p style={{ ...bodyStyle, maxWidth: 720 }}>
            {unlockReached
              ? "You've unlocked your first result. Keep tapping ingredients you have and we'll keep improving your matches."
              : "Tap a few pantry basics you already have and we'll unlock your first Cook Tonight recommendation."}
          </p>
        </div>
        <button type="button" onClick={onSkip} style={secondaryButtonStyle}>
          {unlockReached ? "Hide for now" : "Skip for now"}
        </button>
      </div>

      <div style={cardStyle}>
        <div style={statusPillStyle}>{unlockReached ? "Unlocked" : `${selectedIngredients.length}/3 selected`}</div>
        <div style={{ color: "#4d6158", fontSize: "0.96rem", lineHeight: 1.5 }}>
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
                  padding: "0.32rem 0.7rem",
                  border: "1px solid rgba(33, 79, 58, 0.14)",
                  background: "rgba(255, 255, 255, 0.85)",
                  color: "#214f3a",
                  fontWeight: 650,
                  fontSize: "0.88rem",
                }}
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </div>

      <label style={{ display: "grid", gap: "0.4rem", color: "#334155", fontWeight: 650 }}>
        Search ingredients
        <input
          aria-label="Search ingredients"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search ingredients"
          style={inputStyle}
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
                    ...chipBaseStyle,
                    border: selected ? "1px solid rgba(33, 79, 58, 0.22)" : chipBaseStyle.border,
                    background: selected
                      ? "linear-gradient(180deg, rgba(33, 79, 58, 0.10) 0%, rgba(255, 255, 255, 0.95) 100%)"
                      : chipBaseStyle.background,
                    color: selected ? "#214f3a" : "#102018",
                    boxShadow: selected ? "0 10px 22px rgba(20, 55, 40, 0.08)" : chipBaseStyle.boxShadow,
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
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ color: "#102018", fontWeight: 700 }}>{group.title}</div>
              {group.allItems.length > group.defaultItems.length && !normalizedSearch && (
                <button
                  type="button"
                  aria-label={`${group.expanded ? "Show less" : "See all"} ${group.title.toLowerCase()}`}
                  onClick={() => {
                    setExpandedSections((current) =>
                      current.includes(group.title) ? current.filter((item) => item !== group.title) : [...current, group.title],
                    );
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#214f3a",
                    fontWeight: 700,
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  {group.expanded ? "Show less" : "See all"}
                </button>
              )}
            </div>
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
                      ...chipBaseStyle,
                      border: selected ? "1px solid rgba(33, 79, 58, 0.22)" : chipBaseStyle.border,
                      background: selected
                        ? "linear-gradient(180deg, rgba(33, 79, 58, 0.10) 0%, rgba(255, 255, 255, 0.95) 100%)"
                        : chipBaseStyle.background,
                      color: selected ? "#214f3a" : "#102018",
                      boxShadow: selected ? "0 10px 22px rgba(20, 55, 40, 0.08)" : chipBaseStyle.boxShadow,
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

      {selectionStatus && <div style={{ color: "#214f3a", fontWeight: 650 }}>{selectionStatus}</div>}
      {error && <div style={{ color: "#991b1b", fontWeight: 600 }}>{error}</div>}
    </section>
  );
}

export default QuickStartOnboarding;
