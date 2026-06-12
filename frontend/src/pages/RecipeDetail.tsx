import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiClientError } from "../lib/apiClient";
import { cookRecipe as sendCookRecipe, fetchRecipeDetail, type RecipeDetail, type RecipeIngredient } from "../lib/mvpApi";
import { buildShoppingSearchUrl } from "../lib/shoppingLinks";
import { trackCookClicked, trackIngredientsRequested, trackRecipeCookedConfirmed, trackRecipeLiked, trackRecipeSkipped } from "../lib/tracking";

type CookFeedback = {
  message: string;
  deducted: string[];
  missing: string[];
  isError: boolean;
};

function parseMissingFromMessage(message: string): string[] {
  const missingMatch = message.match(/missing required ingredients:\s*(.+)$/i);
  if (!missingMatch?.[1]) return [];
  return missingMatch[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCookFeedbackSuccess(data: { recipe_name: string; deducted: string[] }): CookFeedback {
  return {
    message: `Cooked ${data.recipe_name}.`,
    deducted: data.deducted,
    missing: [],
    isError: false,
  };
}

function formatQuantity(value?: number | null): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (Math.abs(value - Math.round(value)) < 0.000001) return String(Math.round(value));
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function ingredientAmountLabel(ingredient: RecipeIngredient): string | null {
  const quantity = ingredient.display_quantity ?? ingredient.required_quantity ?? null;
  const unit = ingredient.display_unit ?? ingredient.unit ?? null;
  const quantityLabel = formatQuantity(quantity);
  if (!quantityLabel) return null;
  return unit ? `${quantityLabel} ${unit}` : quantityLabel;
}

function pantryAmountNote(ingredient: RecipeIngredient, requiredAmountLabel: string | null): string | null {
  if (!ingredient.pantry_status) return null;
  if (ingredient.pantry_match_kind === "family") {
    return ingredient.pantry_note ?? (
      ingredient.pantry_matched_name
        ? `You have ${ingredient.pantry_matched_name} saved; confirm it works for this recipe`
        : "Confirm your saved pantry item works for this recipe"
    );
  }
  if (ingredient.pantry_quantity_is_known === false) return "Pantry amount unknown";
  if (typeof ingredient.pantry_quantity !== "number") return null;

  const pantryQuantity = formatQuantity(ingredient.pantry_quantity);
  if (!pantryQuantity) return null;
  const pantryAmount = `${pantryQuantity} ${ingredient.pantry_unit ?? "ea"}`;

  if (ingredient.pantry_status === "needs_quantity_confirmation") {
    return requiredAmountLabel
      ? `Pantry saved as ${pantryAmount}; recipe needs ${requiredAmountLabel}, so check the amount manually`
      : `Pantry saved as ${pantryAmount}; check the amount manually`;
  }

  return `Pantry: ${pantryAmount}`;
}

function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [cookFeedback, setCookFeedback] = useState<CookFeedback | null>(null);
  const [preferenceFeedback, setPreferenceFeedback] = useState("");

  const formatMinutes = (value?: number | null) =>
    typeof value === "number" ? `${value} min` : null;

  const checklistStorageKey = id ? `recipe_checklist_${id}` : "";
  const steps = useMemo(() => {
    if (recipe?.steps?.length) {
      return recipe.steps.map((step) => step.instruction_text).filter(Boolean);
    }
    if (!recipe?.instructions) return [];
    return recipe.instructions
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }, [recipe?.instructions, recipe?.steps]);

  const readiness = recipe?.readiness;
  const missingRequiredIngredients = readiness?.missing_required_ingredients ?? [];
  const missingOptionalIngredients = readiness?.missing_optional_ingredients ?? [];
  const requiredQuantityConfirmations = readiness?.required_quantity_confirmation_ingredients ?? [];
  const optionalQuantityConfirmations = readiness?.optional_quantity_confirmation_ingredients ?? [];
  const requiredFamilyConfirmations = useMemo(
    () => new Set(
      (recipe?.ingredients ?? [])
        .filter((ingredient) => (
          ingredient.is_required
          && ingredient.pantry_status === "needs_quantity_confirmation"
          && ingredient.pantry_match_kind === "family"
        ))
        .map((ingredient) => ingredient.display_name ?? ingredient.ingredient_name),
    ),
    [recipe?.ingredients],
  );
  const shoppingIngredients = useMemo(
    () => [...missingRequiredIngredients],
    [missingRequiredIngredients],
  );
  const copyableBlockers = useMemo(
    () => [
      ...missingRequiredIngredients,
      ...requiredQuantityConfirmations,
      ...missingOptionalIngredients,
      ...optionalQuantityConfirmations,
    ],
    [
      missingOptionalIngredients,
      missingRequiredIngredients,
      optionalQuantityConfirmations,
      requiredQuantityConfirmations,
    ],
  );
  const canCookNow = readiness?.can_cook_now ?? false;
  const shoppingUrl = useMemo(() => buildShoppingSearchUrl(shoppingIngredients), [shoppingIngredients]);
  const requiredReadyCount = readiness?.required_ready_count ?? 0;
  const requiredCount = readiness?.required_count ?? 0;
  const readinessVerdict = canCookNow
    ? "You can cook this tonight"
    : missingRequiredIngredients.length === 0 || requiredReadyCount > 0
      ? "Almost there"
      : "Not worth starting yet";
  const readinessReason = canCookNow
    ? "Every required ingredient is covered by your pantry, so cooking can safely deduct what you use."
    : missingRequiredIngredients.length > 0
      ? `You still need this before cooking: ${missingRequiredIngredients.join(", ")}.`
      : requiredQuantityConfirmations.some((ingredient) => requiredFamilyConfirmations.has(ingredient))
        ? `Check the amount/type for ${requiredQuantityConfirmations.join(", ")} before cooking.`
      : `Check the amount for ${requiredQuantityConfirmations.join(", ")} before cooking.`;

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      if (!id) throw new Error("Recipe id is required.");
      const recipeData = await fetchRecipeDetail(id);
      setRecipe(recipeData);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const cookRecipe = async () => {
    if (!id || !canCookNow) return;
    setCookFeedback(null);
    setBusy(true);
    void trackCookClicked(id, {
      source: "recipe_detail:button",
      missing_count: copyableBlockers.length,
      missing_ingredients: copyableBlockers,
    });
    try {
      const data = await sendCookRecipe(id);
      localStorage.setItem("onboarding_cooked_recipe", "1");
      setCookFeedback(parseCookFeedbackSuccess(data));
      void trackRecipeCookedConfirmed(id, {
        source: "recipe_detail:success",
        deducted: data.deducted,
      });
      await load();
    } catch (requestError: unknown) {
      const message = requestError instanceof Error ? requestError.message : String(requestError);
      setCookFeedback({
        message,
        deducted: [],
        missing: requestError instanceof ApiClientError ? parseMissingFromMessage(message) : [],
        isError: true,
      });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!checklistStorageKey) return;
    try {
      const raw = localStorage.getItem(checklistStorageKey);
      if (!raw) {
        setCheckedSteps([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setCheckedSteps([]);
        return;
      }
      const validIndexes = parsed
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value < steps.length);
      setCheckedSteps(validIndexes);
    } catch {
      setCheckedSteps([]);
    }
  }, [checklistStorageKey, steps.length]);

  const toggleStep = (stepIndex: number) => {
    setCheckedSteps((prev) => {
      const exists = prev.includes(stepIndex);
      const next = exists ? prev.filter((idx) => idx !== stepIndex) : [...prev, stepIndex].sort((a, b) => a - b);
      if (checklistStorageKey) {
        localStorage.setItem(checklistStorageKey, JSON.stringify(next));
      }
      return next;
    });
  };

  const resetChecklist = () => {
    setCheckedSteps([]);
    if (checklistStorageKey) {
      localStorage.removeItem(checklistStorageKey);
    }
  };

  const copyMissingItems = async () => {
    if (!copyableBlockers.length) return;
    setCopyStatus("");
    void trackIngredientsRequested(id ?? null, {
      source: "recipe_detail:copy_missing",
      missing_count: copyableBlockers.length,
      missing_ingredients: copyableBlockers,
    });
    try {
      await navigator.clipboard.writeText(copyableBlockers.join("\n"));
      setCopyStatus("Blocked items copied.");
    } catch {
      setCopyStatus("Could not copy. Clipboard permission may be blocked.");
    }
  };

  const sendPreferenceSignal = async (signal: "recipe_liked" | "recipe_skipped") => {
    if (!id || !recipe) return;
    const track = signal === "recipe_liked" ? trackRecipeLiked : trackRecipeSkipped;
    const succeeded = await track(id, {
      source: "recipe_detail:preference_feedback",
      recipe_name: recipe.name,
    });
    setPreferenceFeedback(
      succeeded
        ? signal === "recipe_liked"
          ? "This adds a small positive tie-break signal in future close calls."
          : "This adds a small negative tie-break signal for this recipe in future close calls."
        : "We couldn’t save that preference signal right now.",
    );
  };

  const cookActionSection = (
    <section style={{ border: "1px solid #dbe4ef", borderRadius: 20, padding: "1rem", background: "#ffffff" }}>
      <h2 style={{ marginTop: 0 }}>Cook this recipe</h2>
      <div style={{ color: "#64748b", marginBottom: "0.75rem" }}>
        {canCookNow
          ? "Use this once you are ready. Pantry inventory will be deducted on success."
          : "Cooking stays blocked until the required ingredients are in your pantry with enough quantity."}
      </div>
      <div style={{ marginBottom: "0.75rem", color: canCookNow ? "#166534" : "#9a3412", fontWeight: 700 }}>
        {canCookNow ? "Ready to cook." : "Fix pantry before cooking."}
      </div>
      {canCookNow && (
        <div>
          <button
            onClick={() => { void cookRecipe(); }}
            disabled={busy}
            style={{
              padding: "0.8rem 1rem",
              borderRadius: 12,
              border: "1px solid #166534",
              background: "#166534",
              color: "#ffffff",
              fontWeight: 700,
            }}
          >
            {busy ? "Cooking..." : "Cook this recipe"}
          </button>
        </div>
      )}
      {cookFeedback && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            border: "1px solid",
            borderColor: cookFeedback.isError ? "#b00020" : "#2e7d32",
            borderRadius: 8,
          }}
        >
          <div style={{ color: cookFeedback.isError ? "#b00020" : "#2e7d32" }}>{cookFeedback.message}</div>
          {cookFeedback.deducted.length > 0 && (
            <div style={{ marginTop: "0.5rem" }}>
              <strong>Used from pantry:</strong> {cookFeedback.deducted.join(", ")}
            </div>
          )}
          {cookFeedback.missing.length > 0 && (
            <div style={{ marginTop: "0.5rem" }}>
              <strong>Missing:</strong> {cookFeedback.missing.join(", ")}
            </div>
          )}
        </div>
      )}
    </section>
  );

  const stepsSection = steps.length > 0 ? (
    <section style={{ border: "1px solid #dbe4ef", borderRadius: 20, padding: "1rem", background: "#ffffff" }}>
      <h2 style={{ marginTop: 0 }}>Cooking steps preview</h2>
      <div style={{ color: "#64748b", marginBottom: "0.75rem" }}>
        {canCookNow ? "Use these as a checklist while you cook." : "Preview the steps now, then fix the pantry before cooking."}
      </div>
      <div style={{ marginBottom: "0.6rem" }}>
        <button type="button" onClick={resetChecklist} disabled={checkedSteps.length === 0} style={{ padding: "0.65rem 0.9rem", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff" }}>
          Reset checklist
        </button>
      </div>
      <ol style={{ paddingLeft: "1.25rem" }}>
        {steps.map((line, idx) => (
          <li key={`${idx}-${line.slice(0, 10)}`} style={{ marginBottom: "0.45rem" }}>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={checkedSteps.includes(idx)}
                onChange={() => toggleStep(idx)}
                style={{ marginTop: 2 }}
              />
              <span style={{ textDecoration: checkedSteps.includes(idx) ? "line-through" : "none" }}>{line}</span>
            </label>
          </li>
        ))}
      </ol>
    </section>
  ) : null;

  return (
    <div className="page-shell" style={{ maxWidth: 980 }}>
      <Link to="/recommendations" style={{ color: "#0f766e", fontWeight: 600 }}>
        &lt;- Back to Tonight&apos;s Matches
      </Link>

      {loading ? (
        <div style={{ marginTop: "1rem", border: "1px solid #dbe4ef", borderRadius: 12, padding: "0.9rem", background: "#ffffff", color: "#475569" }}>
          Checking whether you can cook this tonight...
        </div>
      ) : error ? (
        <div style={{ marginTop: "1rem", color: "#b00020", border: "1px solid #fecaca", background: "#fff1f2", padding: "0.85rem", borderRadius: 12 }}>{error}</div>
      ) : recipe ? (
        <div style={{ marginTop: "1rem", display: "grid", gap: "1rem" }}>
          <section style={{ border: "1px solid #dbe4ef", borderRadius: 20, padding: "1.15rem", background: "#ffffff" }}>
            <h1 style={{ margin: 0, fontFamily: '"Space Grotesk", sans-serif' }}>{recipe.name}</h1>
            {recipe.short_description && <div style={{ marginTop: "0.45rem", color: "#334155" }}>{recipe.short_description}</div>}
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.55rem", color: "#475569" }}>
              {formatMinutes(recipe.total_time_minutes) && <span>Time: {formatMinutes(recipe.total_time_minutes)}</span>}
              {recipe.servings && <span>Servings: {recipe.servings}</span>}
              {recipe.cuisine && <span>Cuisine: {recipe.cuisine}</span>}
              {recipe.difficulty && <span>Difficulty: {recipe.difficulty}</span>}
              {recipe.meal_type && <span>Meal type: {recipe.meal_type}</span>}
              {recipe.cook_method && <span>Cook method: {recipe.cook_method}</span>}
              {formatMinutes(recipe.prep_time_minutes) && <span>Prep: {formatMinutes(recipe.prep_time_minutes)}</span>}
              {formatMinutes(recipe.cook_time_minutes) && <span>Cook: {formatMinutes(recipe.cook_time_minutes)}</span>}
              {recipe.oven_temp_f && <span>Oven: {recipe.oven_temp_f}F</span>}
              {recipe.air_fryer_temp_f && <span>Air fryer: {recipe.air_fryer_temp_f}F</span>}
            </div>
            <div style={{ marginTop: "0.85rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => {
                  void sendPreferenceSignal("recipe_liked");
                }}
                style={{ padding: "0.65rem 0.9rem", borderRadius: 12, border: "1px solid #0f766e", background: "#f0fdfa", color: "#115e59", fontWeight: 700 }}
              >
                More Like This
              </button>
              <button
                type="button"
                onClick={() => {
                  void sendPreferenceSignal("recipe_skipped");
                }}
                style={{ padding: "0.65rem 0.9rem", borderRadius: 12, border: "1px solid #cbd5e1", background: "#ffffff", color: "#475569", fontWeight: 700 }}
              >
                Not Tonight
              </button>
              <span style={{ color: "#64748b", fontSize: "0.92rem" }}>
                These only nudge close recommendation calls later.
              </span>
            </div>
            {preferenceFeedback && <div style={{ marginTop: "0.55rem", color: "#475569" }}>{preferenceFeedback}</div>}
          </section>

          <section style={{ border: "1px solid #dbe4ef", borderRadius: 20, padding: "1rem", background: canCookNow ? "#f0fdf4" : "#fff7ed" }}>
            <div style={{ color: canCookNow ? "#166534" : "#9a3412", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.76rem" }}>
              Can I cook this tonight?
            </div>
            <div style={{ marginTop: "0.25rem", fontSize: "1.55rem", lineHeight: 1.1, fontWeight: 800, color: canCookNow ? "#166534" : "#9a3412", fontFamily: '"Space Grotesk", sans-serif' }}>
              {readinessVerdict}
            </div>
            <div style={{ marginTop: "0.35rem", color: "#475569" }}>
              {readinessReason}
            </div>
            <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.7rem" }}>
              <span style={{ borderRadius: 999, padding: "0.22rem 0.65rem", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 700, fontSize: "0.82rem" }}>
                You have: {requiredReadyCount}/{requiredCount} required
              </span>
              <span style={{ borderRadius: 999, padding: "0.22rem 0.65rem", background: "#ffffff", border: "1px solid #cbd5e1", color: canCookNow ? "#166534" : "#9a3412", fontWeight: 700, fontSize: "0.82rem" }}>
                {canCookNow
                  ? "Cook button ready"
                  : missingRequiredIngredients.length > 0
                    ? `${missingRequiredIngredients.length} missing`
                    : `${requiredQuantityConfirmations.length} amount${requiredQuantityConfirmations.length === 1 ? "" : "s"} to check`}
              </span>
              {(missingOptionalIngredients.length > 0 || optionalQuantityConfirmations.length > 0) && (
                <span style={{ borderRadius: 999, padding: "0.22rem 0.65rem", background: "#ffffff", border: "1px solid #cbd5e1", color: "#475569", fontWeight: 700, fontSize: "0.82rem" }}>
                  Optional gaps: {missingOptionalIngredients.length + optionalQuantityConfirmations.length}
                </span>
              )}
            </div>
            <div style={{ marginTop: "0.7rem", padding: "0.75rem 0.85rem", borderRadius: 14, background: "#ffffff", border: "1px solid #dbe4ef" }}>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>Next step</div>
              <div style={{ marginTop: "0.25rem", color: "#475569" }}>
                {canCookNow
                  ? "Start cooking when you're ready. Pantry inventory changes only after the cook succeeds."
                  : shoppingIngredients.length > 0
                    ? "Get what is missing or fix the pantry quantities first, then come back here to cook with confidence."
                    : "Update the pantry amounts that need checking first, then come back here to cook with confidence."}
              </div>
            </div>
            {missingOptionalIngredients.length > 0 && (
              <div style={{ marginTop: "0.45rem", color: "#64748b", fontSize: "0.92rem" }}>
                Optional missing: {missingOptionalIngredients.join(", ")}
              </div>
            )}
            {requiredQuantityConfirmations.length > 0 && (
              <div style={{ marginTop: "0.45rem", color: "#64748b", fontSize: "0.92rem" }}>
                Check amount: {requiredQuantityConfirmations.join(", ")}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.9rem" }}>
              {shoppingUrl && !canCookNow && shoppingIngredients.length > 0 && (
                <a
                  href={shoppingUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid #92400e", background: "#92400e", color: "#ffffff", fontWeight: 700, textDecoration: "none" }}
                  onClick={() => {
                    void trackIngredientsRequested(id ?? null, {
                      source: "recipe_detail:shop_missing",
                      missing_count: shoppingIngredients.length,
                      missing_ingredients: shoppingIngredients,
                    });
                  }}
                >
                  Search Walmart for missing items
                </a>
              )}
              <button type="button" onClick={() => { void copyMissingItems(); }} disabled={copyableBlockers.length === 0} style={{ padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid #cbd5e1", background: "#ffffff" }}>
                Copy missing/check list
              </button>
              <Link to="/pantry" style={{ display: "inline-flex", alignItems: "center", padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid #92400e", background: "#92400e", color: "#ffffff", fontWeight: 700 }}>
                Fix pantry
              </Link>
            </div>
            {copyStatus && <div style={{ marginTop: "0.55rem", color: "#475569" }}>{copyStatus}</div>}
          </section>

          <section style={{ border: "1px solid #dbe4ef", borderRadius: 20, padding: "1rem", background: "#ffffff" }}>
            <h2 style={{ marginTop: 0 }}>Ingredients</h2>
            {recipe.ingredients.length === 0 ? (
              <div>No ingredients found.</div>
            ) : (
              <ul>
                {recipe.ingredients.map((ingredient) => {
                  const label = ingredient.display_name ?? ingredient.ingredient_name;
                  const amountLabel = ingredientAmountLabel(ingredient);
                  const pantryLabel = pantryAmountNote(ingredient, amountLabel);
                  const hasEnough = ingredient.pantry_has_enough === true;
                  const needsQuantityConfirmation = ingredient.pantry_status === "needs_quantity_confirmation";
                  const needsFamilyCheck = ingredient.pantry_match_kind === "family";
                  const isRequired = ingredient.is_required;
                  const statusColor = hasEnough
                    ? "#2e7d32"
                    : isRequired
                      ? needsQuantityConfirmation ? "#92400e" : "#b00020"
                      : "#64748b";
                  return (
                    <li key={ingredient.ingredient_id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                      <strong>{label}</strong>
                      {amountLabel && <span style={{ color: "#475569" }}>{amountLabel}</span>}
                      <span
                        style={{
                          padding: "0.1rem 0.45rem",
                          borderRadius: 12,
                          fontSize: "0.75rem",
                          border: "1px solid",
                          borderColor: statusColor,
                          color: statusColor,
                        }}
                      >
                        {hasEnough ? "You have this" : needsQuantityConfirmation ? isRequired ? needsFamilyCheck ? ingredient.pantry_quantity_is_known === false ? "Check amount/type" : "Check type" : "Check amount" : "Optional check" : isRequired ? "Missing" : "Optional"}
                      </span>
                      <span style={{ color: "#666" }}>
                        {hasEnough
                          ? "ready in pantry"
                          : needsQuantityConfirmation
                            ? isRequired ? needsFamilyCheck ? "saved cheese needs a quick check" : "saved amount needs a quick check" : "optional amount is unknown"
                            : isRequired
                              ? "still needed"
                              : "optional"}
                      </span>
                      {pantryLabel && <span style={{ color: "#64748b", fontSize: "0.88rem" }}>{pantryLabel}</span>}
                      {ingredient.notes && <span style={{ color: "#64748b", fontSize: "0.88rem" }}>{ingredient.notes}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {cookActionSection}
          {stepsSection}
        </div>
      ) : (
        <div style={{ marginTop: "1rem" }}>Recipe not found.</div>
      )}
    </div>
  );
}

export default RecipeDetailPage;
