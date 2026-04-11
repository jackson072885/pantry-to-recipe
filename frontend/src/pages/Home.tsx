import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BestOptionAction from "../components/BestOptionAction";
import QuickStartOnboarding from "../components/QuickStartOnboarding";
import RecommendationGroups from "../components/RecommendationGroups";
import { buildBehaviorTrustNote, buildBestOptionComparison, buildEffortSummary, buildHeroTrustExplanation } from "../lib/homeRecommendations";
import { mutatePantry } from "../lib/mvpApi";
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
  const generatedFrom = result?.generated_from;
  const snapshotPreview = (generatedFrom?.pantry_items ?? pantryNames).slice(0, 8);
  const pantryCoverage = bestEntry ? Math.round(bestEntry.recipe.pantry_coverage_pct) : null;
  const runnerUpEntry = alternatives[0] ?? closestOptions[0] ?? null;
  const trustExplanation = bestEntry ? buildHeroTrustExplanation(bestEntry, runnerUpEntry) : "";
  const behaviorApplied = Boolean(bestEntry?.score_breakdown?.behavior_applied);
  const comparisonNote = bestEntry ? buildBestOptionComparison(bestEntry, runnerUpEntry) : null;
  const behaviorNote = bestEntry ? buildBehaviorTrustNote(bestEntry) : null;
  const displayedAlternatives = alternatives.slice(0, 3);
  const quickStartSelected = useMemo(() => pantryNames.map((item) => item.toLowerCase()), [pantryNames]);
  const showOnboarding = initialPantryWasEmpty === true && !onboardingDismissed && !onboardingJustCompleted && pantryNames.length < 3;

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
      await mutatePantry(alreadySelected ? "remove" : "add", {
        name: normalized,
        amount: 1,
      });
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

  return (
    <div className="page-shell" style={{ maxWidth: 1100 }}>
      <section
        style={{
          padding: "1.4rem",
          border: "1px solid #dbe4ef",
          borderRadius: 22,
          background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(240,249,255,0.96) 100%)",
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ color: "#0f766e", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.76rem" }}>
          Tonight
        </div>
        <h1 style={{ margin: "0.45rem 0 0.6rem", fontSize: "2.45rem", lineHeight: 1.05, fontFamily: '"Space Grotesk", sans-serif' }}>
          Dinner from what you already have
        </h1>
        <p style={{ color: "#475569", margin: 0, fontSize: "1.02rem", maxWidth: 640 }}>
          See your strongest dinner pick first, based on your saved pantry. Extra options stay below if you want a backup plan.
        </p>

        {error && !loading && (
          <div
            style={{
              marginTop: "1rem",
              color: "#991b1b",
              whiteSpace: "pre-wrap",
              border: "1px solid #fecaca",
              background: "#fff1f2",
              borderRadius: 16,
              padding: "0.95rem",
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
                  padding: "0.75rem 0.95rem",
                  borderRadius: 12,
                  border: "1px solid #ef4444",
                  background: "#ffffff",
                  color: "#991b1b",
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

      <section style={{ marginTop: "1rem", border: "1px solid #dbe4ef", borderRadius: 20, padding: "1.1rem", background: "#ffffff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Your Pantry Tonight</h2>
            <p style={{ color: "#64748b", margin: "0.3rem 0 0" }}>
              {pantryNames.length > 0
                ? `${pantryNames.length} saved item${pantryNames.length === 1 ? "" : "s"} powering tonight's dinner picks.`
                : "No saved pantry yet. Add a few ingredients once so Home can suggest dinner right away."}
            </p>
          </div>
          <Link
            to="/pantry"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.65rem 0.95rem",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              fontWeight: 600,
              background: "#ffffff",
            }}
          >
            Edit Pantry
          </Link>
        </div>

        {snapshotPreview.length > 0 ? (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.9rem" }}>
            {snapshotPreview.map((item) => (
              <span
                key={item}
                style={{
                  borderRadius: 999,
                  padding: "0.35rem 0.7rem",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  color: "#334155",
                  fontSize: "0.88rem",
                }}
              >
                {item}
              </span>
            ))}
            {(generatedFrom?.pantry_count ?? pantryNames.length) > snapshotPreview.length && (
              <span style={{ color: "#64748b", alignSelf: "center", fontSize: "0.88rem" }}>
                +{(generatedFrom?.pantry_count ?? pantryNames.length) - snapshotPreview.length} more
              </span>
            )}
          </div>
        ) : (
          <div style={{ marginTop: "0.85rem", color: "#64748b" }}>
            Start with a simple list like <strong>eggs, rice, onion</strong>.
          </div>
        )}
      </section>

      {showOnboarding && (
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
      )}

      {loading ? (
        <section
          style={{
            marginTop: "1.4rem",
            border: "1px solid #dbe4ef",
            borderRadius: 22,
            padding: "1.25rem",
            color: "#475569",
            background: "#ffffff",
            display: "grid",
            gap: "1rem",
          }}
        >
          <div>
            <div style={{ color: "#0f766e", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Building Tonight&apos;s Pick
            </div>
            <div style={{ marginTop: "0.35rem", fontSize: "1.45rem", fontWeight: 700, color: "#0f172a" }}>
              We&apos;re picking the best dinner from your pantry.
            </div>
            <div style={{ marginTop: "0.35rem", maxWidth: 680 }}>
              We&apos;re checking what you already have so your best option shows up first, with backups underneath.
            </div>
          </div>
          <div aria-hidden="true" style={{ display: "grid", gap: "0.75rem" }}>
            <div style={{ height: 18, width: "24%", borderRadius: 999, background: "#dbeafe" }} />
            <div style={{ height: 38, width: "58%", borderRadius: 14, background: "#e2e8f0" }} />
            <div style={{ height: 16, width: "88%", borderRadius: 999, background: "#e2e8f0" }} />
            <div style={{ height: 16, width: "72%", borderRadius: 999, background: "#f1f5f9" }} />
            <div style={{ height: 44, width: 220, borderRadius: 14, background: "#99f6e4" }} />
          </div>
        </section>
      ) : pantryNames.length === 0 && !showOnboarding ? (
        <section style={{ marginTop: "1.4rem", display: "grid", gap: "0.9rem", border: "1px solid #dbe4ef", borderRadius: 22, padding: "1.2rem", background: "#ffffff" }}>
          <div style={{ color: "#0f766e", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.04em", textTransform: "uppercase" }}>Start Here</div>
          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "1.45rem" }}>Add a few ingredients and get a dinner pick in seconds.</div>
          <div style={{ color: "#475569", maxWidth: 640 }}>Save a few pantry items once, then Home can keep surfacing your best dinner option first.</div>
          <div>
            <Link
              to="/pantry"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.8rem 1rem",
                borderRadius: 12,
                background: "#0f766e",
                color: "#ffffff",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Add Ingredients
            </Link>
          </div>
        </section>
      ) : result && bestEntry ? (
        <section style={{ marginTop: "1.5rem", display: "grid", gap: "1rem" }}>
          <div
            style={{
              border: "1px solid #86efac",
              borderRadius: 24,
              padding: "1.4rem",
              background: "linear-gradient(180deg, #f0fdf4 0%, #ecfeff 100%)",
              boxShadow: "0 20px 44px rgba(15, 23, 42, 0.08)",
            }}
          >
            <div style={{ color: "#166534", fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Best Tonight
            </div>
            <div style={{ marginTop: "0.75rem", display: "grid", gap: "1rem" }}>
              <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", alignItems: "center" }}>
                <span
                  style={{
                    borderRadius: 999,
                    padding: "0.35rem 0.7rem",
                    background: "#ffffff",
                    color: "#166534",
                    border: "1px solid #86efac",
                    fontWeight: 700,
                    fontSize: "0.82rem",
                  }}
                >
                  {bestEntry.missing.count === 0 ? "Ready to cook now" : bestEntry.missing.summary}
                </span>
                {pantryCoverage !== null && <span style={{ borderRadius: 999, padding: "0.35rem 0.7rem", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: "0.82rem" }}>{pantryCoverage}% pantry coverage</span>}
                {typeof bestEntry.recipe.estimated_time_minutes === "number" && <span style={{ borderRadius: 999, padding: "0.35rem 0.7rem", background: "#ffffff", color: "#475569", border: "1px solid #cbd5e1", fontWeight: 600, fontSize: "0.82rem" }}>{bestEntry.recipe.estimated_time_minutes} minutes</span>}
                {bestEntry.confidence_label && <span style={{ borderRadius: 999, padding: "0.35rem 0.7rem", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, fontSize: "0.82rem", textTransform: "capitalize" }}>{bestEntry.confidence_label} confidence</span>}
                {behaviorApplied && <span style={{ borderRadius: 999, padding: "0.35rem 0.7rem", background: "#f5f3ff", color: "#6d28d9", fontWeight: 700, fontSize: "0.82rem" }}>History broke a close call</span>}
              </div>
              <div>
                <Link
                  to={`/recipes/${bestEntry.recipe.recipe_id}`}
                  style={{ fontWeight: 700, color: "#0f172a", fontSize: "2rem", lineHeight: 1.05, textDecoration: "none", display: "inline-block" }}
                  onClick={() => {
                    void trackEvent("recipe_selected", {
                      recipeId: bestEntry.recipe.recipe_id,
                      metadata: { source: "home_best_option:title" },
                    });
                  }}
                >
                  {bestEntry.recipe.recipe_name}
                </Link>
                <div style={{ marginTop: "0.7rem", color: "#0f172a", fontWeight: 700, fontSize: "1.08rem" }}>
                  {bestEntry.why_best ?? "This is your strongest dinner match for tonight."}
                </div>
                <div style={{ marginTop: "0.45rem", color: "#475569", maxWidth: 720, fontSize: "1rem" }}>{bestEntry.explanation}</div>
                <div style={{ marginTop: "0.55rem", color: "#334155", maxWidth: 760, fontSize: "0.95rem", fontWeight: 600 }}>{trustExplanation}</div>
              </div>
              <div style={{ display: "grid", gap: "0.65rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <div style={{ borderRadius: 16, background: "#ffffff", padding: "0.9rem", border: "1px solid rgba(148, 163, 184, 0.25)" }}>
                  <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Why it won</div>
                  <div style={{ marginTop: "0.35rem", color: "#0f172a", fontWeight: 700 }}>{trustExplanation}</div>
                </div>
                <div style={{ borderRadius: 16, background: "#ffffff", padding: "0.9rem", border: "1px solid rgba(148, 163, 184, 0.25)" }}>
                  <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Time and effort</div>
                  <div style={{ marginTop: "0.35rem", color: "#0f172a", fontWeight: 700 }}>{buildEffortSummary(bestEntry)}</div>
                </div>
                {(comparisonNote || behaviorNote) && (
                  <div style={{ borderRadius: 16, background: "#ffffff", padding: "0.9rem", border: "1px solid rgba(148, 163, 184, 0.25)" }}>
                    <div style={{ color: "#64748b", fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>{comparisonNote ? "Why it beat the next option" : "History signal"}</div>
                    <div style={{ marginTop: "0.35rem", color: "#0f172a", fontWeight: 700 }}>{comparisonNote ?? behaviorNote}</div>
                  </div>
                )}
              </div>

              {onboardingJustCompleted ? (
                <div style={{ display: "grid", gap: "0.8rem" }}>
                  <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", alignItems: "center" }}>
                    <Link
                      to={`/recipes/${bestEntry.recipe.recipe_id}`}
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0.8rem 1.05rem", borderRadius: 12, background: "#166534", color: "#ffffff", fontWeight: 700, textDecoration: "none" }}
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
                    <a href="#home-alternatives" style={{ color: "#0f172a", fontWeight: 700 }} onClick={() => { setShowRememberPrompt(true); }}>
                      See other options
                    </a>
                  </div>
                  <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ color: "#475569", fontSize: "0.92rem", fontWeight: 600 }}>Would you cook this?</span>
                    <button type="button" onClick={() => { void sendPreferenceSignal("recipe_liked"); }} style={{ padding: "0.55rem 0.8rem", borderRadius: 999, border: "1px solid #0f766e", background: "#f0fdfa", color: "#115e59", fontWeight: 700 }}>
                      👍
                    </button>
                    <button type="button" onClick={() => { void sendPreferenceSignal("recipe_skipped"); }} style={{ padding: "0.55rem 0.8rem", borderRadius: 999, border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontWeight: 700 }}>
                      👎
                    </button>
                  </div>
                  {preferenceFeedback && <div style={{ color: "#475569", fontSize: "0.92rem" }}>{preferenceFeedback}</div>}
                  {showRememberPrompt && (
                    <div style={{ borderRadius: 16, border: "1px solid #cbd5e1", background: "#ffffff", padding: "0.85rem 0.95rem", color: "#334155" }}>
                      <strong>Want us to remember your pantry for next time?</strong> We&apos;ll keep using your saved pantry to surface dinner picks first.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", alignItems: "center" }}>
                  <BestOptionAction entry={bestEntry} source="home_best_option" linkDestinationSource="home_best_option" externalBackground="#92400e" internalBackground="#166534" marginTop="0.9rem" padding="0.8rem 1.05rem" hintFontSize="0.88rem" borderRadius={12} />
                  <Link
                    to={`/recipes/${bestEntry.recipe.recipe_id}`}
                    style={{ color: "#0f172a", fontWeight: 700 }}
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
            <section id="home-alternatives" style={{ border: "1px solid #dbe4ef", borderRadius: 18, padding: "1rem", background: "#ffffff" }}>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>More Good Options</div>
              <div style={{ marginTop: "0.2rem", color: "#64748b", fontSize: "0.92rem" }}>These come from the same pantry check, but your top pick above is still the best place to start.</div>
              <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.8rem" }}>
                {displayedAlternatives.map((entry) => (
                  <Link
                    key={entry.recipe.recipe_id}
                    to={`/recipes/${entry.recipe.recipe_id}`}
                    style={{ textDecoration: "none", padding: "0.95rem", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0", display: "grid", gap: "0.45rem" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "start", flexWrap: "wrap" }}>
                      <span style={{ color: "#0f172a", fontWeight: 700 }}>{entry.recipe.recipe_name}</span>
                      <span style={{ color: "#0f766e", fontWeight: 700, fontSize: "0.88rem" }}>{buildEffortSummary(entry)}</span>
                    </div>
                    <div style={{ color: "#475569", fontSize: "0.92rem" }}>{entry.why_best ?? entry.explanation}</div>
                    <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                      <span style={{ borderRadius: 999, padding: "0.24rem 0.6rem", background: "#ffffff", border: "1px solid #cbd5e1", color: "#334155", fontSize: "0.82rem", fontWeight: 700 }}>
                        {entry.missing.summary}
                      </span>
                      <span style={{ borderRadius: 999, padding: "0.24rem 0.6rem", background: "#ffffff", border: "1px solid #cbd5e1", color: "#334155", fontSize: "0.82rem", fontWeight: 700 }}>
                        {Math.round(entry.recipe.pantry_coverage_pct)}% pantry match
                      </span>
                      {typeof entry.recipe.estimated_time_minutes === "number" && (
                        <span style={{ borderRadius: 999, padding: "0.24rem 0.6rem", background: "#ffffff", border: "1px solid #cbd5e1", color: "#334155", fontSize: "0.82rem", fontWeight: 700 }}>
                          {entry.recipe.estimated_time_minutes} min
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <RecommendationGroups recommendations={result} emptyMessage="No dinner recommendations are available from this pantry yet." />
        </section>
      ) : result ? (
        <section style={{ marginTop: "1.4rem", display: "grid", gap: "1rem" }}>
          <section style={{ display: "grid", gap: "0.8rem", border: "1px solid #fdba74", borderRadius: 18, padding: "1rem", background: "#fff7ed" }}>
            <div style={{ fontWeight: 700, color: "#9a3412", fontSize: "1.08rem" }}>No strong match tonight.</div>
            <div style={{ color: "#7c2d12", maxWidth: 700 }}>Your pantry loaded correctly, but none of the current recipes qualifies as a confident Tonight winner. Here are the closest suggestions instead of forcing a best pick.</div>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link to="/pantry" style={{ color: "#9a3412", fontWeight: 700 }}>
                Edit Pantry
              </Link>
              <button
                type="button"
                onClick={() => {
                  void loadSavedPantry();
                }}
                style={{ border: "1px solid #fdba74", background: "#ffffff", color: "#7c2d12", fontWeight: 700, borderRadius: 10, padding: "0.65rem 0.9rem", cursor: "pointer" }}
              >
                Check Saved Pantry Again
              </button>
            </div>
          </section>

          {closestOptions.length > 0 && (
            <section style={{ border: "1px solid #dbe4ef", borderRadius: 18, padding: "1rem", background: "#ffffff" }}>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>Closest Suggestions From Your Pantry</div>
              <div style={{ marginTop: "0.2rem", color: "#64748b", fontSize: "0.92rem" }}>These are the nearest fits right now, but each still has meaningful gaps before it becomes a true Tonight winner.</div>
              <div style={{ display: "grid", gap: "0.65rem", marginTop: "0.8rem" }}>
                {closestOptions.map((entry) => (
                  <Link
                    key={entry.recipe.recipe_id}
                    to={`/recipes/${entry.recipe.recipe_id}`}
                    style={{ color: "#0f766e", fontWeight: 600, textDecoration: "none", padding: "0.8rem 0.9rem", borderRadius: 14, background: "#f8fafc", border: "1px solid #e2e8f0" }}
                  >
                    {entry.recipe.recipe_name} · {entry.missing.summary}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <RecommendationGroups recommendations={result} emptyMessage="No dinner recommendations are available from this pantry yet." />
        </section>
      ) : (
        <section style={{ marginTop: "1.4rem", display: "grid", gap: "0.8rem", border: "1px solid #dbe4ef", borderRadius: 18, padding: "1rem", background: "#ffffff" }}>
          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "1.08rem" }}>We need a little more to find a strong dinner pick.</div>
          <div style={{ color: "#475569", maxWidth: 640 }}>Your pantry loaded, but there isn&apos;t a clear match yet. Add a few more ingredients to your saved pantry and check again for a stronger recommendation.</div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link to="/pantry" style={{ color: "#0f766e", fontWeight: 700 }}>
              Edit Pantry
            </Link>
            <button
              type="button"
              onClick={() => {
                void loadSavedPantry();
              }}
              style={{ border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", fontWeight: 700, borderRadius: 10, padding: "0.65rem 0.9rem", cursor: "pointer" }}
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
