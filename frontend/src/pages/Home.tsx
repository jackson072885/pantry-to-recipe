import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import BestOptionAction from "../components/BestOptionAction";
import PageHero from "../components/PageHero";
import QuickStartOnboarding from "../components/QuickStartOnboarding";
import RecommendationGroups from "../components/RecommendationGroups";
import { buildBehaviorTrustNote, buildBestOptionComparison, buildEffortSummary, buildHeroTrustExplanation } from "../lib/homeRecommendations";
import {
  addPantryPresence,
  clearPantry,
  fetchDinnerTonightCandidates,
  mutatePantry,
  type DinnerTonightCandidate,
  type DinnerTonightCandidatesResponse,
} from "../lib/mvpApi";
import { publishPantryChanged } from "../lib/pantryEvents";
import { resetPantrySessionId } from "../lib/pantrySession";
import { getIngredientCoverageLabel, getReadinessBadgeLabel, isReadyToCook } from "../lib/recommendationReadinessCopy";
import { trackEvent } from "../lib/tracking";
import { useSavedPantryRecommendations } from "../lib/useSavedPantryRecommendations";

const SAMPLE_PANTRY_INGREDIENTS = ["chicken", "rice", "onion", "cheese", "egg", "salt", "pepper", "oil"];

const dinnerCandidateCardStyle: CSSProperties = {
  border: "1px solid rgba(45, 75, 58, 0.14)",
  borderRadius: 26,
  padding: "1.15rem",
  background: "rgba(255,255,252,0.92)",
  boxShadow: "0 18px 36px rgba(22, 40, 30, 0.05)",
  display: "grid",
  gap: "0.85rem",
};

function formatFeasibilityBucket(candidate: DinnerTonightCandidate): string {
  if (candidate.feasibility_bucket === "cookable_tonight" && candidate.critical_missing_ingredients.length === 0) {
    return "Cookable tonight";
  }
  if (candidate.feasibility_bucket === "almost_there") return "Almost there";
  if (candidate.feasibility_bucket === "inspiration") return "Inspiration";
  return "Needs review";
}

function buildExternalCandidateMessage(result: DinnerTonightCandidatesResponse | null, error: string): string {
  if (error) return "External recipe search is unavailable right now. Your saved/internal dinner flow is still available.";
  if (!result) return "";
  if (result.provider_status === "disabled") {
    return "External recipe search is not configured yet. Your saved/internal dinner flow is still available.";
  }
  if (result.provider_status === "missing_api_key") {
    return "External recipe search needs a provider key before live recipes can appear.";
  }
  if (result.provider_status === "error") {
    return result.error_message || "External recipe search is unavailable right now. Your saved/internal dinner flow is still available.";
  }
  if (!result.best) return "No strong external dinner candidate yet for these ingredients.";
  return "";
}

function IngredientList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: "0.35rem" }}>
      <div style={{ color: "#6b7c72", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>{title}</div>
      <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
        {items.map((item) => (
          <span key={`${title}-${item}`} style={{ borderRadius: 999, padding: "0.28rem 0.62rem", background: "#ffffff", border: "1px solid rgba(45, 75, 58, 0.1)", color: "#30463a", fontSize: "0.82rem", fontWeight: 700 }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const demoFreshResetStartedRef = useRef(false);
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
  const [samplePantryActive, setSamplePantryActive] = useState(false);
  const [demoResetBusy, setDemoResetBusy] = useState(false);
  const [demoResetError, setDemoResetError] = useState("");
  const [demoResetStatus, setDemoResetStatus] = useState("");
  const [preferenceFeedback, setPreferenceFeedback] = useState("");
  const [showRememberPrompt, setShowRememberPrompt] = useState(false);
  const [dinnerCandidates, setDinnerCandidates] = useState<DinnerTonightCandidatesResponse | null>(null);
  const [dinnerCandidatesLoading, setDinnerCandidatesLoading] = useState(false);
  const [dinnerCandidatesError, setDinnerCandidatesError] = useState("");

  const alternatives = result?.alternatives ?? [];
  const closestOptions = result?.closest_options ?? alternatives;
  const hasStrongMatch = Boolean(result?.best_tonight && bestEntry && isReadyToCook(bestEntry));
  const generatedFrom = result?.generated_from;
  const snapshotPreview = (generatedFrom?.pantry_items ?? pantryNames).slice(0, 8);
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
  const dinnerCandidateIngredients = useMemo(
    () => Array.from(new Set(pantryNames.map((item) => item.trim()).filter(Boolean))),
    [pantryNames],
  );
  const dinnerCandidateIngredientKey = dinnerCandidateIngredients.join("\n");
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

  useEffect(() => {
    if (dinnerCandidateIngredients.length === 0) {
      setDinnerCandidates(null);
      setDinnerCandidatesError("");
      setDinnerCandidatesLoading(false);
      return;
    }

    let cancelled = false;
    setDinnerCandidatesLoading(true);
    setDinnerCandidatesError("");

    void fetchDinnerTonightCandidates({
      ingredients: dinnerCandidateIngredients,
      limit: 6,
      filter_mode: "cookable_tonight",
    })
      .then((response) => {
        if (cancelled) return;
        setDinnerCandidates(response);
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        setDinnerCandidates(null);
        setDinnerCandidatesError(requestError instanceof Error ? requestError.message : "External recipe search failed.");
      })
      .finally(() => {
        if (!cancelled) {
          setDinnerCandidatesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dinnerCandidateIngredientKey, dinnerCandidateIngredients]);

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

  const loadSamplePantry = async () => {
    const missingSampleIngredients = SAMPLE_PANTRY_INGREDIENTS.filter((ingredient) => !quickStartSelected.includes(ingredient));
    if (missingSampleIngredients.length === 0) {
      setSamplePantryActive(true);
      setOnboardingStatus("Sample pantry loaded. Checking dinner matches now.");
      void loadSavedPantry();
      return;
    }

    setSamplePantryActive(true);
    setOnboardingDismissed(false);
    setOnboardingBusy(true);
    setOnboardingError("");
    setOnboardingStatus("Loading a sample pantry with chicken, rice, onion, cheese, egg, salt, pepper, and oil.");
    setPendingIngredients((current) => Array.from(new Set([...current, ...missingSampleIngredients])));

    try {
      for (const ingredient of missingSampleIngredients) {
        await addPantryPresence({ name: ingredient });
      }
      publishPantryChanged();
      setOnboardingStatus("Sample pantry loaded. Checking dinner matches now.");
    } catch (requestError: unknown) {
      setOnboardingError(requestError instanceof Error ? requestError.message : "Could not load the sample pantry.");
      setOnboardingStatus("");
    } finally {
      setPendingIngredients((current) => current.filter((item) => !missingSampleIngredients.includes(item)));
      setOnboardingBusy(false);
    }
  };

  const startFreshDemoSession = useCallback(async () => {
    setDemoResetBusy(true);
    setDemoResetError("");
    setDemoResetStatus("");
    setOnboardingError("");
    setOnboardingStatus("");
    setPreferenceFeedback("");
    setShowRememberPrompt(false);

    try {
      await clearPantry();
      resetPantrySessionId();
      setSamplePantryActive(false);
      setOnboardingDismissed(false);
      setOnboardingJustCompleted(false);
      setInitialPantryWasEmpty(true);
      setPendingIngredients([]);
      setDemoResetStatus("Fresh demo session ready. This browser now starts with an empty pantry.");
      publishPantryChanged();
    } catch (requestError: unknown) {
      setDemoResetError(requestError instanceof Error ? requestError.message : "Could not start a fresh demo session.");
    } finally {
      setDemoResetBusy(false);
    }
  }, []);

  useEffect(() => {
    if (searchParams.get("demo") !== "fresh" || demoFreshResetStartedRef.current) return;

    demoFreshResetStartedRef.current = true;
    void (async () => {
      await startFreshDemoSession();
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete("demo");
      setSearchParams(nextSearchParams, { replace: true });
    })();
  }, [searchParams, setSearchParams, startFreshDemoSession]);

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
        <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
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
          <button
            type="button"
            onClick={() => {
              void startFreshDemoSession();
            }}
            disabled={demoResetBusy || onboardingBusy || loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.7rem 0.95rem",
              borderRadius: 14,
              border: "1px solid rgba(176, 70, 58, 0.26)",
              color: "#8a3b24",
              fontWeight: 700,
              background: "rgba(255,247,237,0.82)",
              cursor: demoResetBusy ? "wait" : "pointer",
            }}
          >
            {demoResetBusy ? "Starting Fresh..." : "Start Fresh Demo"}
          </button>
        </div>
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
      className="home-empty-card"
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
      <div className="home-empty-card__kicker" style={{ color: "#1f6a41", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.18em", textTransform: "uppercase" }}>Start Here</div>
      <div className="home-empty-card__title" style={{ fontWeight: 700, color: "#163222", fontSize: "1.65rem", lineHeight: 1.05, fontFamily: '"Space Grotesk", sans-serif' }}>
        Add a few ingredients and get a dinner pick in seconds.
      </div>
      <div className="home-empty-card__copy" style={{ color: "#54645c", maxWidth: 460, fontSize: "0.98rem" }}>
        Save a few pantry items once, then Home can keep surfacing your best dinner option first.
      </div>
      <div className="home-empty-card__actions" style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <Link
          className="home-empty-card__primary"
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
        <div className="home-empty-card__note" style={{ color: "#65756d", fontSize: "0.92rem", maxWidth: 240 }}>Home will use your saved pantry automatically once it&apos;s set up.</div>
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
      onTrySample={() => {
        void loadSamplePantry();
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

  const externalCandidate = dinnerCandidates?.best ?? null;
  const externalCandidateMessage = buildExternalCandidateMessage(dinnerCandidates, dinnerCandidatesError);
  const dinnerCandidateSurface = dinnerCandidateIngredients.length > 0 ? (
    <section style={{ marginTop: "1.35rem", display: "grid", gap: "0.8rem" }} aria-label="External Dinner Candidate">
      {dinnerCandidatesLoading && !dinnerCandidates && (
        <div style={dinnerCandidateCardStyle}>
          <div style={{ color: "#1f6a41", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.18em", textTransform: "uppercase" }}>External Dinner Search</div>
          <div style={{ color: "#4f6258" }}>Checking pantry-aware live recipe candidates.</div>
        </div>
      )}

      {externalCandidate ? (
        <div style={{ ...dinnerCandidateCardStyle, background: "linear-gradient(160deg, rgba(255,255,251,0.98) 0%, rgba(242, 247, 236, 0.96) 100%)" }}>
          <div style={{ display: "grid", gap: "0.45rem" }}>
            <div style={{ color: "#1f6a41", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.18em", textTransform: "uppercase" }}>Pantry-Aware External Candidate</div>
            <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ borderRadius: 999, padding: "0.34rem 0.7rem", background: "#163222", color: "#f4f8ec", fontWeight: 700, fontSize: "0.82rem" }}>
                {formatFeasibilityBucket(externalCandidate)}
              </span>
              <span style={{ borderRadius: 999, padding: "0.34rem 0.7rem", background: "rgba(255,255,255,0.88)", color: "#4f6258", border: "1px solid rgba(45, 75, 58, 0.12)", fontWeight: 700, fontSize: "0.82rem", textTransform: "capitalize" }}>
                {dinnerCandidates?.provider || externalCandidate.source}
              </span>
              {typeof externalCandidate.ready_minutes === "number" && (
                <span style={{ borderRadius: 999, padding: "0.34rem 0.7rem", background: "rgba(255,255,255,0.88)", color: "#4f6258", border: "1px solid rgba(45, 75, 58, 0.12)", fontWeight: 700, fontSize: "0.82rem" }}>
                  {externalCandidate.ready_minutes} minutes
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.6rem" }}>
            {externalCandidate.source_url ? (
              <a href={externalCandidate.source_url} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: "#163222", fontSize: "clamp(1.55rem, 3vw, 2.2rem)", lineHeight: 1, textDecoration: "none", fontFamily: '"Space Grotesk", sans-serif', maxWidth: 760 }}>
                {externalCandidate.title}
              </a>
            ) : (
              <div style={{ fontWeight: 700, color: "#163222", fontSize: "clamp(1.55rem, 3vw, 2.2rem)", lineHeight: 1, fontFamily: '"Space Grotesk", sans-serif', maxWidth: 760 }}>
                {externalCandidate.title}
              </div>
            )}
            {externalCandidate.feasibility_reasons.length > 0 && (
              <div style={{ color: "#4f6258", maxWidth: 760, lineHeight: 1.65 }}>
                {externalCandidate.feasibility_reasons.join(" ")}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: "0.8rem", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
            <IngredientList title="Uses from pantry" items={externalCandidate.used_ingredients} />
            <IngredientList title="Critical gaps" items={externalCandidate.critical_missing_ingredients} />
            <IngredientList title="Moderate gaps" items={externalCandidate.moderate_missing_ingredients} />
            <IngredientList title="Minor gaps" items={externalCandidate.minor_missing_ingredients} />
          </div>

          {dinnerCandidates && dinnerCandidates.alternatives.length > 0 && (
            <div style={{ color: "#54645c", fontWeight: 650 }}>
              {dinnerCandidates.alternatives.length} more external option{dinnerCandidates.alternatives.length === 1 ? "" : "s"} available behind this pick.
            </div>
          )}
        </div>
      ) : externalCandidateMessage ? (
        <div style={dinnerCandidateCardStyle}>
          <div style={{ color: "#1f6a41", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.18em", textTransform: "uppercase" }}>External Dinner Search</div>
          <div style={{ color: dinnerCandidatesError || dinnerCandidates?.provider_status === "error" ? "#8a2424" : "#4f6258", lineHeight: 1.55 }}>
            {externalCandidateMessage}
          </div>
        </div>
      ) : null}
    </section>
  ) : null;

  return (
    <div className="page-shell home-page" style={{ maxWidth: 1180 }}>
      <PageHero
        pageTitle="Dinner Tonight."
        tagline="No Shopping Required. Just Cook."
        className="home-hero"
      />
      <section
        className="home-first-run-shell"
        style={{
          position: "relative",
          marginTop: "1.25rem",
        }}
      >
        <div className={isWelcomeState ? "home-first-run-panel home-first-run-panel--welcome" : "home-first-run-panel"}>
          {heroPanel}
        </div>

        {showOnboarding && pantryNames.length > 0 && (
          <div
            style={{
              marginTop: "1rem",
              border: "1px solid rgba(176, 70, 58, 0.2)",
              background: "rgba(255, 247, 237, 0.92)",
              borderRadius: 22,
              padding: "0.95rem 1rem",
              color: "#7c2d12",
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontWeight: 700 }}>Reusing this browser for a private demo?</div>
            <button
              type="button"
              onClick={() => {
                void startFreshDemoSession();
              }}
              disabled={demoResetBusy || onboardingBusy || loading}
              style={{
                padding: "0.7rem 0.95rem",
                borderRadius: 14,
                border: "1px solid rgba(176, 70, 58, 0.34)",
                background: "#ffffff",
                color: "#8a3b24",
                fontWeight: 700,
                cursor: demoResetBusy ? "wait" : "pointer",
              }}
            >
              {demoResetBusy ? "Starting Fresh..." : "Start Fresh Demo"}
            </button>
          </div>
        )}

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
        {(demoResetStatus || demoResetError) && (
          <div
            style={{
              marginTop: "1rem",
              border: demoResetError ? "1px solid rgba(202, 108, 96, 0.38)" : "1px solid rgba(45, 75, 58, 0.16)",
              background: demoResetError ? "rgba(255, 242, 240, 0.92)" : "rgba(255, 255, 252, 0.92)",
              borderRadius: 22,
              padding: "0.95rem 1rem",
              color: demoResetError ? "#8a2424" : "#30463a",
            }}
          >
            {demoResetError || demoResetStatus}
          </div>
        )}
        {samplePantryActive && (
          <div
            style={{
              marginTop: "1rem",
              border: "1px solid rgba(45, 75, 58, 0.16)",
              background: "rgba(255, 255, 252, 0.92)",
              borderRadius: 22,
              padding: "0.95rem 1rem",
              color: "#30463a",
              display: "grid",
              gap: "0.45rem",
            }}
          >
            <div style={{ color: "#163222", fontWeight: 700 }}>Sample pantry mode</div>
            <div style={{ lineHeight: 1.55 }}>
              We loaded a demo pantry for this browser session: {SAMPLE_PANTRY_INGREDIENTS.join(", ")}. Replace it with your own ingredients whenever you are ready.
            </div>
          </div>
        )}
      </section>

      {dinnerCandidateSurface}

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
                  {getReadinessBadgeLabel(bestEntry)}
                </span>
                <span style={{ borderRadius: 999, padding: "0.38rem 0.72rem", background: "rgba(197,255,100,0.2)", color: "#355129", fontWeight: 700, fontSize: "0.82rem" }}>{getIngredientCoverageLabel(bestEntry)}</span>
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
                      : `${bestEntry.missing.summary} ${getIngredientCoverageLabel(bestEntry)} keeps it at the front of the near-ready options.`}
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
                      {hasStrongMatch ? "Cook this" : "View recipe"}
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
                        {getIngredientCoverageLabel(entry)}
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
      ) : pantryNames.length > 0 ? (
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
      ) : null}
    </div>
  );
}

export default HomePage;
