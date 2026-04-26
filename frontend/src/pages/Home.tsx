import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BestOptionAction from "../components/BestOptionAction";
import QuickStartOnboarding from "../components/QuickStartOnboarding";
import RecommendationGroups from "../components/RecommendationGroups";
import { buildBehaviorTrustNote, buildBestOptionComparison, buildEffortSummary, buildHeroTrustExplanation } from "../lib/homeRecommendations";
import { addPantryPresence, mutatePantry } from "../lib/mvpApi";
import { publishPantryChanged } from "../lib/pantryEvents";
import { trackEvent } from "../lib/tracking";
import { useSavedPantryRecommendations } from "../lib/useSavedPantryRecommendations";

function HomePage() {
  const {
    bestEntry,
    error,
    loading,
    pantryNames,
    recommendations: result,
    reload: loadSavedPantry,
  } = useSavedPantryRecommendations({
    genericErrorMessage: "Failed to load tonight's dinner options.",
    resetStateOnError: true,
  });

  const [initialPantryWasEmpty, setInitialPantryWasEmpty] = useState<boolean | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [onboardingJustCompleted, setOnboardingJustCompleted] = useState(false);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [onboardingError, setOnboardingError] = useState("");
  const [onboardingStatus, setOnboardingStatus] = useState("");
  const [pendingIngredients, setPendingIngredients] = useState<string[]>([]);
  const [preferenceFeedback, setPreferenceFeedback] = useState("");
  const [showRememberPrompt, setShowRememberPrompt] = useState(false);

  const alternatives = result?.alternatives ?? [];
  const closestOptions = result?.closest_options ?? alternatives;
  const hasStrongMatch = Boolean(result?.best_tonight);
  const generatedFrom = result?.generated_from;
  const snapshotPreview = (generatedFrom?.pantry_items ?? pantryNames).slice(0, 8);
  const pantryCoverage = bestEntry ? Math.round(bestEntry.recipe.pantry_coverage_pct) : null;
  const backupOptions = [...alternatives, ...closestOptions].filter((entry, index, entries) =>
    entry.recipe.recipe_id !== bestEntry?.recipe.recipe_id
    && entries.findIndex((candidate) => candidate.recipe.recipe_id === entry.recipe.recipe_id) === index,
  );
  const runnerUpEntry = backupOptions[0] ?? null;
  const trustExplanation = bestEntry ? buildHeroTrustExplanation(bestEntry, runnerUpEntry) : "";
  const behaviorApplied = Boolean(bestEntry?.score_breakdown?.behavior_applied);
  const comparisonNote = bestEntry ? buildBestOptionComparison(bestEntry, runnerUpEntry) : null;
  const behaviorNote = bestEntry ? buildBehaviorTrustNote(bestEntry) : null;
  const displayedAlternatives = backupOptions.slice(0, 3);
  const quickStartSelected = useMemo(() => pantryNames.map((item) => item.toLowerCase()), [pantryNames]);
  const showOnboarding = initialPantryWasEmpty === true && !onboardingDismissed;
  const isWelcomeState = !loading && (showOnboarding || pantryNames.length === 0);

  useEffect(() => {
    if (loading || initialPantryWasEmpty !== null) return;
    setInitialPantryWasEmpty(pantryNames.length === 0);
  }, [initialPantryWasEmpty, loading, pantryNames.length]);

  useEffect(() => {
    if (initialPantryWasEmpty !== true || onboardingJustCompleted || pantryNames.length < 3) return;
    setOnboardingJustCompleted(true);
    setOnboardingStatus("");
  }, [initialPantryWasEmpty, onboardingJustCompleted, pantryNames.length]);

  const toggleQuickStartIngredient = async (ingredient: string) => {
    const normalized = ingredient.trim().toLowerCase();
    if (!normalized) return;

    const alreadySelected = quickStartSelected.includes(normalized);
    setOnboardingBusy(true);
    setOnboardingError("");
    setOnboardingStatus("");
    setPendingIngredients((current) => (current.includes(normalized) ? current : [...current, normalized]));

    try {
      if (alreadySelected) {
        await mutatePantry("remove", {
          name: normalized,
          amount: 1,
        });
      } else {
        await addPantryPresence({
          name: normalized,
        });
      }
      publishPantryChanged();
      setOnboardingStatus(alreadySelected ? `Removed ${normalized}.` : `Added ${normalized}.`);
    } catch (requestError: unknown) {
      setOnboardingError(requestError instanceof Error ? requestError.message : "Could not update the quick-start pantry.");
    } finally {
      setPendingIngredients((current) => current.filter((item) => item !== normalized));
      setOnboardingBusy(false);
    }
  };

  const sendPreferenceSignal = async (signal: "recipe_liked" | "recipe_skipped") => {
    if (!bestEntry) return;

    const eventName = signal === "recipe_liked" ? "recipe_liked" : "recipe_skipped";
    const succeeded = await trackEvent(eventName, {
      recipeId: bestEntry.recipe.recipe_id,
      metadata: {
        source: "home_onboarding_feedback",
        recipe_name: bestEntry.recipe.recipe_name,
      },
    });

    setPreferenceFeedback(
      succeeded
        ? signal === "recipe_liked"
          ? "This adds a small positive tie-break signal in future close calls."
          : "This adds a small negative tie-break signal for this recipe in future close calls."
        : "We couldn't save that preference signal right now.",
    );
    setShowRememberPrompt(true);
  };

  const pantryPanel = (
    <section
      style={{
        display: "grid",
        gap: "1rem",
        border: "1px solid rgba(45, 75, 58, 0.12)",
        borderRadius: 28,
        padding: "1.35rem",
        background: "linear-gradient(180deg, rgba(255,255,252,0.98) 0%, rgba(248, 245, 237, 0.96) 100%)",
        boxShadow: "0 22px 44px rgba(25, 47, 36, 0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start", flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#1f6a41", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.18em", textTransform: "uppercase" }}>Your Pantry Tonight</div>
          <h2 style={{ margin: "0.35rem 0 0", fontSize: "1.35rem", color: "#163222", fontFamily: '"Space Grotesk", sans-serif' }}>Saved ingredients driving tonight&apos;s picks</h2>
        </div>
        <Link
          to="/pantry"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.7rem 0.95rem",
            borderRadius: 14,
            border: "1px solid rgba(45, 75, 58, 0.16)",
            color: "#163222",
            fontWeight: 700,
            background: "rgba(255,255,255,0.72)",
          }}
        >
          Edit Pantry
        </Link>
      </div>

      <p style={{ color: "#54645c", margin: 0 }}>
        {pantryNames.length > 0
          ? `${pantryNames.length} saved item${pantryNames.length === 1 ? "" : "s"} powering tonight's dinner picks.`
          : "No saved pantry yet. Add a few ingredients once so Home can suggest dinner right away."}
      </p>

      {snapshotPreview.length > 0 ? (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {snapshotPreview.map((item) => (
            <span
              key={item}
              style={{
                borderRadius: 999,
                padding: "0.42rem 0.76rem",
                background: "rgba(255,255,255,0.78)",
                border: "1px solid rgba(45, 75, 58, 0.1)",
                color: "#30463a",
                fontSize: "0.88rem",
              }}
            >
              {item}
            </span>
          ))}
          {(generatedFrom?.pantry_count ?? pantryNames.length) > snapshotPreview.length && (
            <span style={{ color: "#65756d", alignSelf: "center", fontSize: "0.88rem", fontWeight: 600 }}>
              +{(generatedFrom?.pantry_count ?? pantryNames.length) - snapshotPreview.length} more
            </span>
          )}
        </div>
      ) : (
        <div style={{ color: "#65756d" }}>
          Start with a simple list like <strong>eggs, rice, onion</strong>.
        </div>
      )}
    </section>
  );

  const emptyPantryPanel = (
    <section
      style={{
        display: "grid",
        gap: "0.95rem",
        border: "1px solid rgba(45, 75, 58, 0.12)",
        borderRadius: 28,
        padding: "1.35rem",
        background: "linear-gradient(180deg, rgba(255,255,250,0.98) 0%, rgba(246, 243, 232, 0.96) 100%)",
        boxShadow: "0 22px 44px rgba(25, 47, 36, 0.08)",
      }}
    >
      <div style={{ color: "#1f6a41", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.18em", textTransform: "uppercase" }}>Start Here</div>
      <div style={{ fontWeight: 700, color: "#163222", fontSize: "1.65rem", lineHeight: 1.05, fontFamily: '"Space Grotesk", sans-serif' }}>
        Add a few ingredients and get a dinner pick in seconds.
      </div>
      <div style={{ color: "#54645c", maxWidth: 460, fontSize: "0.98rem" }}>
        Save a few pantry items once, then Home can keep surfacing your best dinner option first.
      </div>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <Link
          to="/pantry"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.9rem 1.15rem",
            borderRadius: 16,
            background: "#163222",
            color: "#f8f6ef",
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 16px 28px rgba(22, 50, 34, 0.18)",
          }}
        >
          Add Ingredients
        </Link>
        <div style={{ color: "#65756d", fontSize: "0.92rem", maxWidth: 240 }}>Home will use your saved pantry automatically once it&apos;s set up.</div>
      </div>
    </section>
  );

  const heroPanel = showOnboarding ? (
    <QuickStartOnboarding
      busy={onboardingBusy}
      error={onboardingError}
      pendingIngredients={pendingIngredients}
      selectedIngredients={quickStartSelected}
      selectionStatus={onboardingStatus}
      onSkip={() => {
        setOnboardingDismissed(true);
        setOnboardingStatus("");
        setOnboardingError("");
      }}
      onStart={() => {
        setOnboardingStatus("");
      }}
      onToggleIngredient={(ingredient) => {
        void toggleQuickStartIngredient(ingredient);
      }}
    />
  ) : pantryNames.length === 0 ? (
    emptyPantryPanel
  ) : (
    pantryPanel
  );

  return (
    <div className="page-shell" style={{ maxWidth: 1180 }}>
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          padding: isWelcomeState ? "0.35rem 0.35rem 0" : "1.25rem",
          border: isWelcomeState ? "none" : "1px solid rgba(33, 63, 47, 0.1)",
          borderRadius: isWelcomeState ? 0 : 34,
          background: isWelcomeState
            ? "linear-gradient(180deg, rgba(255,251,246,0.98) 0%, rgba(248,241,233,0.96) 100%)"
            : "linear-gradient(135deg, rgba(255,250,242,0.96) 0%, rgba(250,247,237,0.96) 56%, rgba(241,251,226,0.92) 100%)",
          boxShadow: isWelcomeState ? "none" : "0 28px 70px rgba(22, 40, 30, 0.08)",
          minHeight: isWelcomeState ? "calc(100vh - 8rem)" : undefined,
        }}
      >
        {isWelcomeState && (
          <>
            <img
              src="/welcome-left-garnish.svg"
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "-0.75rem",
                bottom: "5rem",
                width: "min(21vw, 238px)",
                minWidth: 118,
                pointerEvents: "none",
                opacity: 0.78,
              }}
            />
            <img
              src="/welcome-right-garnish.svg"
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute",
                right: "-0.75rem",
                top: "1.55rem",
                width: "min(24vw, 286px)",
                minWidth: 148,
                pointerEvents: "none",
                opacity: 0.84,
              }}
            />
          </>
        )}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: isWelcomeState ? "auto auto 12% -2%" : "auto auto 18% -8%",
            width: isWelcomeState ? 230 : 220,
            height: isWelcomeState ? 230 : 220,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(200,255,123,0.16) 0%, rgba(200,255,123,0) 72%)",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: isWelcomeState ? 52 : 26,
            right: isWelcomeState ? "12%" : 32,
            width: isWelcomeState ? 110 : 140,
            height: isWelcomeState ? 110 : 140,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(28,102,64,0.08) 0%, rgba(28,102,64,0) 74%)",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: isWelcomeState ? 88 : 34,
            left: isWelcomeState ? "50%" : "48%",
            transform: isWelcomeState ? "translateX(-50%)" : undefined,
            width: isWelcomeState ? 168 : 120,
            height: 2,
            borderRadius: 999,
            background: "linear-gradient(90deg, rgba(195,255,100,0) 0%, rgba(195,255,100,0.9) 50%, rgba(195,255,100,0) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "grid",
            gap: isWelcomeState ? "1rem" : "1.2rem",
            gridTemplateColumns: isWelcomeState ? "1fr" : "repeat(auto-fit, minmax(300px, 1fr))",
            alignItems: "center",
            justifyItems: isWelcomeState ? "center" : undefined,
            paddingBottom: isWelcomeState ? "0.75rem" : 0,
          }}
        >
          <div style={{ display: "grid", gap: isWelcomeState ? "0.85rem" : "1rem", padding: isWelcomeState ? "0.15rem 1rem 0" : "0.35rem 0.3rem 0.35rem 0.15rem", textAlign: isWelcomeState ? "center" : undefined, justifyItems: isWelcomeState ? "center" : undefined }}>
            {isWelcomeState && (
              <div style={{ display: "grid", gap: "0.3rem", justifyItems: "center" }}>
                <div style={{ color: "#173224", fontFamily: '"Space Grotesk", sans-serif', fontSize: "clamp(1.8rem, 3.4vw, 2.8rem)", fontWeight: 500, letterSpacing: "-0.05em" }}>
                  Pantry to Plate
                </div>
                <svg width="156" height="22" viewBox="0 0 170 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M6 13C32 7 52 6 82 12C103 16 125 18 164 11" stroke="#CBE86B" strokeWidth="4" strokeLinecap="round" />
                  <path d="M104 16C118 18 129 18 144 16" stroke="#B8D85A" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            )}
            <div style={{ display: "grid", gap: isWelcomeState ? "0.35rem" : "0.45rem" }}>
              {!isWelcomeState && (
                <div style={{ color: "#1f6a41", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", fontSize: "0.76rem" }}>
                  Tonight
                </div>
              )}
              <h1 style={{ margin: 0, fontSize: isWelcomeState ? "clamp(2.45rem, 5vw, 4.2rem)" : "clamp(2.7rem, 6vw, 4.8rem)", lineHeight: isWelcomeState ? 1.02 : 0.96, color: "#163222", fontFamily: '"Space Grotesk", sans-serif', maxWidth: isWelcomeState ? 940 : 680, letterSpacing: isWelcomeState ? "-0.04em" : "-0.05em", fontWeight: isWelcomeState ? 500 : 700, whiteSpace: isWelcomeState ? "pre-line" : undefined }}>
                {isWelcomeState ? "Dinner Tonight.\nNo Shopping Required. Just Cook." : "Dinner from what you already have"}
              </h1>
              <p style={{ color: "#4f6258", margin: 0, fontSize: isWelcomeState ? "1.04rem" : "1.05rem", lineHeight: isWelcomeState ? 1.52 : 1.7, maxWidth: isWelcomeState ? 700 : 620 }}>
                {isWelcomeState
                  ? "Add a few ingredients you already have and we’ll find your best dinner option first."
                  : "See your strongest dinner pick first, based on your saved pantry. Extra options stay below if you want a backup plan."}
              </p>
            </div>

            {!isWelcomeState && <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <span
                style={{
                  borderRadius: 999,
                  padding: "0.46rem 0.78rem",
                  background: "rgba(255,255,255,0.72)",
                  border: "1px solid rgba(45, 75, 58, 0.12)",
                  color: "#234734",
                  fontSize: "0.86rem",
                  fontWeight: 700,
                }}
              >
                {pantryNames.length > 0 ? `${pantryNames.length} saved item${pantryNames.length === 1 ? "" : "s"}` : "Saved pantry powers Home automatically"}
              </span>
              {pantryCoverage !== null && (
                <span
                  style={{
                    borderRadius: 999,
                    padding: "0.46rem 0.78rem",
                    background: "rgba(23, 50, 34, 0.92)",
                    color: "#eff6d9",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                  }}
                >
                  {pantryCoverage}% pantry coverage
                </span>
              )}
              {displayedAlternatives.length > 0 && (
                <span
                  style={{
                    borderRadius: 999,
                    padding: "0.46rem 0.78rem",
                    background: "rgba(197,255,100,0.22)",
                    border: "1px solid rgba(160, 212, 79, 0.42)",
                    color: "#355129",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                  }}
                >
                  {displayedAlternatives.length} backup option{displayedAlternatives.length === 1 ? "" : "s"}
                </span>
              )}
            </div>}

            {!isWelcomeState && <div style={{ display: "grid", gap: "0.55rem", maxWidth: 640 }}>
              <div style={{ color: "#163222", fontWeight: 700, fontSize: "1rem" }}>A dinner decision engine with food soul.</div>
              <div style={{ color: "#66776e", fontSize: "0.95rem", lineHeight: 1.65 }}>
                Home keeps the strongest option up front, with pantry context and near-miss ideas supporting the decision instead of crowding it.
              </div>
            </div>}
          </div>

          <div style={{ position: "relative", zIndex: 1, width: isWelcomeState ? "min(100%, 1040px)" : undefined, marginTop: isWelcomeState ? "-0.2rem" : undefined }}>{heroPanel}</div>
        </div>

        {error && !loading && (
          <div
            style={{
              position: "relative",
              marginTop: "1rem",
              color: "#8a2424",
              whiteSpace: "pre-wrap",
              border: "1px solid rgba(202, 108, 96, 0.38)",
              background: "rgba(255, 242, 240, 0.92)",
              borderRadius: 22,
              padding: "1rem",
              display: "grid",
              gap: "0.7rem",
            }}
          >
            <div style={{ fontWeight: 700 }}>We couldn&apos;t load your dinner picks.</div>
            <div>{error}</div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  void loadSavedPantry();
                }}
                style={{
                  padding: "0.78rem 1rem",
                  borderRadius: 14,
                  border: "1px solid rgba(176, 70, 58, 0.45)",
                  background: "#ffffff",
                  color: "#8a2424",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </section>

      {loading ? (
        <section
          style={{
            marginTop: "1.35rem",
            border: "1px solid rgba(45, 75, 58, 0.1)",
            borderRadius: 30,
            padding: "1.35rem",
            color: "#4f6258",
            background: "rgba(255,255,252,0.88)",
            display: "grid",
            gap: "1rem",
            boxShadow: "0 22px 44px rgba(22, 40, 30, 0.06)",
          }}
        >
          <div>
            <div style={{ color: "#1f6a41", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              Building Tonight&apos;s Pick
            </div>
            <div style={{ marginTop: "0.35rem", fontSize: "1.5rem", fontWeight: 700, color: "#163222", fontFamily: '"Space Grotesk", sans-serif' }}>
              We&apos;re picking the best dinner from your pantry.
            </div>
            <div style={{ marginTop: "0.35rem", maxWidth: 680 }}>
              We&apos;re checking what you already have so your best option shows up first, with backups underneath.
            </div>
          </div>
          <div aria-hidden="true" style={{ display: "grid", gap: "0.75rem" }}>
            <div style={{ height: 18, width: "24%", borderRadius: 999, background: "rgba(197,255,100,0.34)" }} />
            <div style={{ height: 42, width: "58%", borderRadius: 16, background: "rgba(35, 71, 52, 0.13)" }} />
            <div style={{ height: 16, width: "88%", borderRadius: 999, background: "rgba(35, 71, 52, 0.12)" }} />
            <div style={{ height: 16, width: "72%", borderRadius: 999, background: "rgba(35, 71, 52, 0.08)" }} />
            <div style={{ height: 48, width: 220, borderRadius: 16, background: "rgba(22, 50, 34, 0.8)" }} />
          </div>
        </section>
      ) : result && bestEntry ? (
        <section style={{ marginTop: "1.5rem", display: "grid", gap: "1rem" }}>
          <div
            style={{
              border: "1px solid rgba(45, 75, 58, 0.14)",
              borderRadius: 30,
              padding: "1.45rem",
              background: "linear-gradient(160deg, rgba(255,255,251,0.98) 0%, rgba(245, 247, 238, 0.96) 58%, rgba(235, 246, 221, 0.96) 100%)",
              boxShadow: "0 24px 54px rgba(22, 40, 30, 0.08)",
            }}
          >
            <div style={{ color: "#1f6a41", fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.18em" }}>
              {hasStrongMatch ? "Best Tonight" : "Closest Tonight"}
            </div>
            <div style={{ marginTop: "0.8rem", display: "grid", gap: "1rem" }}>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", alignItems: "center" }}>
                <span
                  style={{
                    borderRadius: 999,
                    padding: "0.38rem 0.72rem",
                    background: "#163222",
                    color: "#f4f8ec",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                  }}
                >
                  {bestEntry.missing.count === 0 ? "Ready to cook now" : bestEntry.missing.summary}
                </span>
                {pantryCoverage !== null && <span style={{ borderRadius: 999, padding: "0.38rem 0.72rem", background: "rgba(197,255,100,0.2)", color: "#355129", fontWeight: 700, fontSize: "0.82rem" }}>{pantryCoverage}% pantry coverage</span>}
                {typeof bestEntry.recipe.estimated_time_minutes === "number" && <span style={{ borderRadius: 999, padding: "0.38rem 0.72rem", background: "rgba(255,255,255,0.88)", color: "#4f6258", border: "1px solid rgba(45, 75, 58, 0.12)", fontWeight: 700, fontSize: "0.82rem" }}>{bestEntry.recipe.estimated_time_minutes} minutes</span>}
                {bestEntry.confidence_label && <span style={{ borderRadius: 999, padding: "0.38rem 0.72rem", background: "rgba(255,255,255,0.88)", color: "#1f6a41", border: "1px solid rgba(45, 75, 58, 0.12)", fontWeight: 700, fontSize: "0.82rem", textTransform: "capitalize" }}>{bestEntry.confidence_label} confidence</span>}
                {behaviorApplied && <span style={{ borderRadius: 999, padding: "0.38rem 0.72rem", background: "rgba(231,252,208,0.9)", color: "#3f5a2f", border: "1px solid rgba(160, 212, 79, 0.4)", fontWeight: 700, fontSize: "0.82rem" }}>History broke a close call</span>}
              </div>
              <div style={{ display: "grid", gap: "0.7rem" }}>
                <Link
                  to={`/recipes/${bestEntry.recipe.recipe_id}`}
                  style={{ fontWeight: 700, color: "#163222", fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 0.98, textDecoration: "none", display: "inline-block", fontFamily: '"Space Grotesk", sans-serif', maxWidth: 760 }}
                  onClick={() => {
                    void trackEvent("recipe_selected", {
                      recipeId: bestEntry.recipe.recipe_id,
                      metadata: { source: "home_best_option:title" },
                    });
                  }}
                >
                  {bestEntry.recipe.recipe_name}
                </Link>
                <div style={{ color: "#203626", fontWeight: 700, fontSize: "1.08rem" }}>
                  {hasStrongMatch
                    ? (bestEntry.why_best ?? "This is your strongest dinner match for tonight.")
                    : (bestEntry.why_best ?? "This is the closest dinner option currently within reach from your pantry.")}
                </div>
                <div style={{ color: "#4f6258", maxWidth: 720, fontSize: "1rem", lineHeight: 1.7 }}>{bestEntry.explanation}</div>
                {hasStrongMatch ? (
                  <div style={{ color: "#30463a", maxWidth: 760, fontSize: "0.95rem", fontWeight: 600 }}>{trustExplanation}</div>
                ) : (
                  <div style={{ color: "#30463a", maxWidth: 760, fontSize: "0.95rem", fontWeight: 600 }}>
                    {bestEntry.missing.summary} It is still the closest realistic dinner from this pantry without overstating readiness.
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gap: "0.7rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <div style={{ borderRadius: 22, background: "rgba(255,255,255,0.78)", padding: "1rem", border: "1px solid rgba(45, 75, 58, 0.1)" }}>
                  <div style={{ color: "#6b7c72", fontSize: "0.77rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em" }}>{hasStrongMatch ? "Why it won" : "Why it surfaces"}</div>
                  <div style={{ marginTop: "0.45rem", color: "#163222", fontWeight: 700, lineHeight: 1.5 }}>
                    {hasStrongMatch
                      ? trustExplanation
                      : `${bestEntry.missing.summary} ${Math.round(bestEntry.recipe.pantry_coverage_pct)}% pantry coverage keeps it at the front of the near-ready options.`}
                  </div>
                </div>
                <div style={{ borderRadius: 22, background: "rgba(255,255,255,0.78)", padding: "1rem", border: "1px solid rgba(45, 75, 58, 0.1)" }}>
                  <div style={{ color: "#6b7c72", fontSize: "0.77rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em" }}>Time and effort</div>
                  <div style={{ marginTop: "0.45rem", color: "#163222", fontWeight: 700, lineHeight: 1.5 }}>{buildEffortSummary(bestEntry)}</div>
                </div>
                {hasStrongMatch && (comparisonNote || behaviorNote) && (
                  <div style={{ borderRadius: 22, background: "rgba(255,255,255,0.78)", padding: "1rem", border: "1px solid rgba(45, 75, 58, 0.1)" }}>
                    <div style={{ color: "#6b7c72", fontSize: "0.77rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.16em" }}>{comparisonNote ? "Why it beat the next option" : "History signal"}</div>
                    <div style={{ marginTop: "0.45rem", color: "#163222", fontWeight: 700, lineHeight: 1.5 }}>{comparisonNote ?? behaviorNote}</div>
                  </div>
                )}
              </div>

              {onboardingJustCompleted ? (
                <div style={{ display: "grid", gap: "0.8rem" }}>
                  <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", alignItems: "center" }}>
                    <Link
                      to={`/recipes/${bestEntry.recipe.recipe_id}`}
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0.88rem 1.12rem", borderRadius: 16, background: "#163222", color: "#f8f6ef", fontWeight: 700, textDecoration: "none", boxShadow: "0 16px 28px rgba(22, 50, 34, 0.18)" }}
                      onClick={() => {
                        setShowRememberPrompt(true);
                        void trackEvent("recipe_selected", {
                          recipeId: bestEntry.recipe.recipe_id,
                          metadata: { source: "home_onboarding_best_option:cook_this" },
                        });
                      }}
                    >
                      Cook this
                    </Link>
                    <a href="#home-alternatives" style={{ color: "#163222", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "0.22rem" }} onClick={() => { setShowRememberPrompt(true); }}>
                      See other options
                    </a>
                  </div>
                  <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ color: "#4f6258", fontSize: "0.92rem", fontWeight: 600 }}>Would you cook this?</span>
                    <button type="button" onClick={() => { void sendPreferenceSignal("recipe_liked"); }} style={{ padding: "0.58rem 0.88rem", borderRadius: 999, border: "1px solid rgba(45, 75, 58, 0.16)", background: "rgba(231,252,208,0.9)", color: "#355129", fontWeight: 700 }}>
                      👍
                    </button>
                    <button type="button" onClick={() => { void sendPreferenceSignal("recipe_skipped"); }} style={{ padding: "0.58rem 0.88rem", borderRadius: 999, border: "1px solid rgba(45, 75, 58, 0.14)", background: "#ffffff", color: "#4f6258", fontWeight: 700 }}>
                      👎
                    </button>
                  </div>
                  {preferenceFeedback && <div style={{ color: "#4f6258", fontSize: "0.92rem" }}>{preferenceFeedback}</div>}
                  {showRememberPrompt && (
                    <div style={{ borderRadius: 20, border: "1px solid rgba(45, 75, 58, 0.12)", background: "rgba(255,255,255,0.76)", padding: "0.95rem 1rem", color: "#30463a" }}>
                      <strong>Want us to remember your pantry for next time?</strong> We&apos;ll keep using your saved pantry to surface dinner picks first.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", alignItems: "center" }}>
                  <BestOptionAction entry={bestEntry} source="home_best_option" linkDestinationSource="home_best_option" externalBackground="#355129" internalBackground="#163222" marginTop="0.9rem" padding="0.88rem 1.12rem" hintFontSize="0.88rem" borderRadius={16} />
                  <Link
                    to={`/recipes/${bestEntry.recipe.recipe_id}`}
                    style={{ color: "#163222", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "0.22rem" }}
                    onClick={() => {
                      void trackEvent("recipe_selected", {
                        recipeId: bestEntry.recipe.recipe_id,
                        metadata: { source: "home_best_option:secondary_cta" },
                      });
                    }}
                  >
                    View Full Recipe
                  </Link>
                </div>
              )}
            </div>
          </div>

          {displayedAlternatives.length > 0 && (
            <section id="home-alternatives" style={{ border: "1px solid rgba(45, 75, 58, 0.12)", borderRadius: 26, padding: "1.1rem", background: "rgba(255,255,252,0.86)", boxShadow: "0 18px 36px rgba(22, 40, 30, 0.05)" }}>
              <div style={{ fontWeight: 700, color: "#163222", fontFamily: '"Space Grotesk", sans-serif', fontSize: "1.05rem" }}>More Good Options</div>
              <div style={{ marginTop: "0.2rem", color: "#66776e", fontSize: "0.92rem" }}>
                {hasStrongMatch
                  ? "These come from the same pantry check, but your top pick above is still the best place to start."
                  : "These come from the same pantry check. The surfaced option above is the closest fit, and these are the next realistic backups."}
              </div>
              <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.85rem" }}>
                {displayedAlternatives.map((entry) => (
                  <Link
                    key={entry.recipe.recipe_id}
                    to={`/recipes/${entry.recipe.recipe_id}`}
                    style={{ textDecoration: "none", padding: "1rem", borderRadius: 20, background: "rgba(248, 246, 238, 0.95)", border: "1px solid rgba(45, 75, 58, 0.1)", display: "grid", gap: "0.45rem" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start", flexWrap: "wrap" }}>
                      <span style={{ color: "#163222", fontWeight: 700 }}>{entry.recipe.recipe_name}</span>
                      <span style={{ color: "#355129", fontWeight: 700, fontSize: "0.88rem" }}>{buildEffortSummary(entry)}</span>
                    </div>
                    <div style={{ color: "#54645c", fontSize: "0.92rem" }}>{entry.why_best ?? entry.explanation}</div>
                    <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                      <span style={{ borderRadius: 999, padding: "0.24rem 0.6rem", background: "#ffffff", border: "1px solid rgba(45, 75, 58, 0.1)", color: "#30463a", fontSize: "0.82rem", fontWeight: 700 }}>
                        {entry.missing.summary}
                      </span>
                      <span style={{ borderRadius: 999, padding: "0.24rem 0.6rem", background: "#ffffff", border: "1px solid rgba(45, 75, 58, 0.1)", color: "#30463a", fontSize: "0.82rem", fontWeight: 700 }}>
                        {Math.round(entry.recipe.pantry_coverage_pct)}% pantry match
                      </span>
                      {typeof entry.recipe.estimated_time_minutes === "number" && (
                        <span style={{ borderRadius: 999, padding: "0.24rem 0.6rem", background: "#ffffff", border: "1px solid rgba(45, 75, 58, 0.1)", color: "#30463a", fontSize: "0.82rem", fontWeight: 700 }}>
                          {entry.recipe.estimated_time_minutes} min
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section style={{ display: "grid", gap: "0.55rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ color: "#163222", fontWeight: 700 }}>Need a wider dinner shortlist?</div>
                <div style={{ color: "#66776e", fontSize: "0.92rem", marginTop: "0.2rem" }}>
                  Home keeps the best answer first. Recommendations shows the fuller pantry-ranked field when you want to compare more realistic options.
                </div>
              </div>
              <Link
                to="/recommendations"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.72rem 0.98rem",
                  borderRadius: 14,
                  border: "1px solid rgba(45, 75, 58, 0.14)",
                  background: "rgba(255,255,255,0.82)",
                  color: "#163222",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                See full recommendations
              </Link>
            </div>
            <RecommendationGroups recommendations={result} emptyMessage="No dinner recommendations are available from this pantry yet." />
          </section>
        </section>
      ) : result ? (
        <section style={{ marginTop: "1.4rem", display: "grid", gap: "1rem" }}>
          <section style={{ display: "grid", gap: "0.8rem", border: "1px solid rgba(83, 106, 70, 0.22)", borderRadius: 24, padding: "1.15rem", background: "linear-gradient(180deg, rgba(250,247,237,0.96) 0%, rgba(240, 245, 230, 0.94) 100%)", boxShadow: "0 18px 36px rgba(39, 62, 44, 0.06)" }}>
            <div style={{ fontWeight: 700, color: "#355129", fontSize: "1.08rem", fontFamily: '"Space Grotesk", sans-serif' }}>No strong match tonight.</div>
            <div style={{ color: "#54645c", maxWidth: 700, lineHeight: 1.65 }}>Your pantry loaded correctly, but none of the current recipes qualifies as a confident Tonight winner. Here are the closest suggestions instead of forcing a best pick.</div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link to="/pantry" style={{ color: "#355129", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "0.22rem" }}>
                Edit Pantry
              </Link>
              <button
                type="button"
                onClick={() => {
                  void loadSavedPantry();
                }}
                style={{ border: "1px solid rgba(83, 106, 70, 0.22)", background: "#ffffff", color: "#30463a", fontWeight: 700, borderRadius: 14, padding: "0.7rem 0.95rem", cursor: "pointer" }}
              >
                Check Saved Pantry Again
              </button>
            </div>
          </section>

          {closestOptions.length > 0 && (
            <section style={{ border: "1px solid rgba(45, 75, 58, 0.12)", borderRadius: 24, padding: "1.05rem", background: "rgba(255,255,252,0.86)" }}>
              <div style={{ fontWeight: 700, color: "#163222", fontFamily: '"Space Grotesk", sans-serif' }}>Closest Suggestions From Your Pantry</div>
              <div style={{ marginTop: "0.2rem", color: "#66776e", fontSize: "0.92rem" }}>These are the nearest fits right now, but each still has meaningful gaps before it becomes a true Tonight winner.</div>
              <div style={{ display: "grid", gap: "0.65rem", marginTop: "0.8rem" }}>
                {closestOptions.map((entry) => (
                  <Link
                    key={entry.recipe.recipe_id}
                    to={`/recipes/${entry.recipe.recipe_id}`}
                    style={{ color: "#1f6a41", fontWeight: 600, textDecoration: "none", padding: "0.9rem 1rem", borderRadius: 18, background: "rgba(248, 246, 238, 0.95)", border: "1px solid rgba(45, 75, 58, 0.1)" }}
                  >
                    {entry.recipe.recipe_name} · {entry.missing.summary}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section style={{ display: "grid", gap: "0.55rem" }}>
            <div style={{ color: "#163222", fontWeight: 700 }}>More realistic options from this pantry run</div>
            <div style={{ color: "#66776e", fontSize: "0.92rem" }}>
              Tonight still stays centered on the closest fit first. Open Recommendations if you want the expanded pantry-ranked view.
            </div>
            <RecommendationGroups recommendations={result} emptyMessage="No dinner recommendations are available from this pantry yet." />
          </section>
        </section>
      ) : (
        <section style={{ marginTop: "1.4rem", display: "grid", gap: "0.8rem", border: "1px solid rgba(45, 75, 58, 0.12)", borderRadius: 24, padding: "1.05rem", background: "rgba(255,255,252,0.86)" }}>
          <div style={{ fontWeight: 700, color: "#163222", fontSize: "1.08rem", fontFamily: '"Space Grotesk", sans-serif' }}>We need a little more to find a strong dinner pick.</div>
          <div style={{ color: "#54645c", maxWidth: 640, lineHeight: 1.65 }}>Your pantry loaded, but there isn&apos;t a clear match yet. Add a few more ingredients to your saved pantry and check again for a stronger recommendation.</div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link to="/pantry" style={{ color: "#1f6a41", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: "0.22rem" }}>
              Edit Pantry
            </Link>
            <button
              type="button"
              onClick={() => {
                void loadSavedPantry();
              }}
              style={{ border: "1px solid rgba(45, 75, 58, 0.12)", background: "#ffffff", color: "#163222", fontWeight: 700, borderRadius: 14, padding: "0.7rem 0.95rem", cursor: "pointer" }}
            >
              Check Saved Pantry Again
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default HomePage;
