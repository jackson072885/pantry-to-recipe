import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiClientError } from "../lib/apiClient";
import { cookRecipe as sendCookRecipe, fetchPantry, fetchRecipeDetail, type PantryItem, type RecipeDetail, type RecipeIngredient } from "../lib/mvpApi";
import { pantryHasEnough } from "../lib/quantityMatch";
import { buildShoppingSearchUrl } from "../lib/shoppingLinks";
import { trackCookClicked, trackIngredientsRequested, trackRecipeCookedConfirmed, trackRecipeLiked, trackRecipeSkipped } from "../lib/tracking";
import { mapPantryToSupplyItems } from "../lib/providerApi";

type CookFeedback = {
  message: string;
  deducted: string[];
  missing: string[];
  isError: boolean;
};

type IngredientStatus = {
  ingredient: RecipeIngredient;
  pantryItem: PantryItem | null;
  hasEnough: boolean;
};

function normalizeIngredientName(name: string): string {
  const normalized = mapPantryToSupplyItems([{ ingredient: name }]);
  return normalized[0] ?? name.trim().toLowerCase();
}

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

function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
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

  const ingredientStatuses = useMemo<IngredientStatus[]>(() => {
    const pantryMap = new Map<string, PantryItem>();
    for (const item of pantryItems) {
      const label = item.ingredient ?? item.name ?? item.title ?? "";
      if (!label) continue;
      pantryMap.set(normalizeIngredientName(label), item);
    }

    return (recipe?.ingredients ?? []).map((ingredient) => {
      const key = normalizeIngredientName(ingredient.pantry_name ?? ingredient.ingredient_name);
      const pantryItem = pantryMap.get(key) ?? null;
      return {
        ingredient,
        pantryItem,
        hasEnough: pantryHasEnough(pantryItem, ingredient),
      };
    });
  }, [pantryItems, recipe?.ingredients]);

  const missingRequiredIngredients = useMemo(
    () => ingredientStatuses.filter((item) => !item.hasEnough && item.ingredient.is_required).map((item) => item.ingredient.display_name ?? item.ingredient.ingredient_name),
    [ingredientStatuses],
  );

  const missingOptionalIngredients = useMemo(
    () => ingredientStatuses.filter((item) => !item.hasEnough && !item.ingredient.is_required).map((item) => item.ingredient.display_name ?? item.ingredient.ingredient_name),
    [ingredientStatuses],
  );

  const allMissingIngredients = useMemo(
    () => [...missingRequiredIngredients, ...missingOptionalIngredients],
    [missingOptionalIngredients, missingRequiredIngredients],
  );

  const canCookNow = missingRequiredIngredients.length === 0;
  const shoppingUrl = useMemo(() => buildShoppingSearchUrl(allMissingIngredients), [allMissingIngredients]);
  const requiredReadyCount = useMemo(
    () => ingredientStatuses.filter((item) => item.ingredient.is_required && item.hasEnough).length,
    [ingredientStatuses],
  );
  const requiredCount = useMemo(
    () => ingredientStatuses.filter((item) => item.ingredient.is_required).length,
    [ingredientStatuses],
  );

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      if (!id) throw new Error("Recipe id is required.");
      const [recipeData, pantryData] = await Promise.all([fetchRecipeDetail(id), fetchPantry()]);
      setRecipe(recipeData);
      setPantryItems(pantryData.items ?? []);
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
      missing_count: allMissingIngredients.length,
      missing_ingredients: allMissingIngredients,
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
    if (!allMissingIngredients.length) return;
    setCopyStatus("");
    void trackIngredientsRequested(id ?? null, {
      source: "recipe_detail:copy_missing",
      missing_count: allMissingIngredients.length,
      missing_ingredients: allMissingIngredients,
    });
    try {
      await navigator.clipboard.writeText(allMissingIngredients.join("\n"));
      setCopyStatus("Missing items copied.");
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
          ? "We’ll use this as a small positive tie-break signal for similar dinners."
          : "We’ll use this as a small negative signal for this recipe in close calls."
        : "We couldn’t save that preference signal right now.",
    );
  };

  return (
    <div className="page-shell" style={{ maxWidth: 980 }}>
      <Link to="/recommendations" style={{ color: "#0f766e", fontWeight: 600 }}>
        &lt;- Back to Recommendations
      </Link>

      {loading ? (
        <div style={{ marginTop: "1rem", border: "1px solid #dbe4ef", borderRadius: 12, padding: "0.9rem", background: "#ffffff", color: "#475569" }}>
          Loading recipe details and checking your pantry quantities...
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
              Tonight&apos;s readiness
            </div>
            <div style={{ fontWeight: 700, color: canCookNow ? "#166534" : "#9a3412" }}>
              {canCookNow ? "Ready to cook from your pantry" : `You still need ${missingRequiredIngredients.length} required item${missingRequiredIngredients.length === 1 ? "" : "s"}`}
            </div>
            <div style={{ marginTop: "0.35rem", color: "#475569" }}>
              {canCookNow
                ? "Every required ingredient is available in the needed quantity, so the cook action is safe to use."
                : `Required missing or insufficient: ${missingRequiredIngredients.join(", ")}.`}
            </div>
            <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.7rem" }}>
              <span style={{ borderRadius: 999, padding: "0.22rem 0.65rem", background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 700, fontSize: "0.82rem" }}>
                Required ready: {requiredReadyCount}/{requiredCount}
              </span>
              <span style={{ borderRadius: 999, padding: "0.22rem 0.65rem", background: "#ffffff", border: "1px solid #cbd5e1", color: canCookNow ? "#166534" : "#9a3412", fontWeight: 700, fontSize: "0.82rem" }}>
                {canCookNow ? "Cook action unlocked" : `${missingRequiredIngredients.length} required item${missingRequiredIngredients.length === 1 ? "" : "s"} blocking`}
              </span>
              {missingOptionalIngredients.length > 0 && (
                <span style={{ borderRadius: 999, padding: "0.22rem 0.65rem", background: "#ffffff", border: "1px solid #cbd5e1", color: "#475569", fontWeight: 700, fontSize: "0.82rem" }}>
                  Optional missing: {missingOptionalIngredients.length}
                </span>
              )}
            </div>
            <div style={{ marginTop: "0.7rem", padding: "0.75rem 0.85rem", borderRadius: 14, background: "#ffffff", border: "1px solid #dbe4ef" }}>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>Next step</div>
              <div style={{ marginTop: "0.25rem", color: "#475569" }}>
                {canCookNow
                  ? "Start cooking when you're ready. The cook button below only deducts pantry inventory after a successful cook."
                  : "Get the blocked required items or fix the pantry quantities first, then come back here to cook with confidence."}
              </div>
            </div>
            {missingOptionalIngredients.length > 0 && (
              <div style={{ marginTop: "0.45rem", color: "#64748b", fontSize: "0.92rem" }}>
                Optional missing: {missingOptionalIngredients.join(", ")}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.9rem" }}>
              {shoppingUrl && !canCookNow && (
                <a
                  href={shoppingUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid #92400e", background: "#92400e", color: "#ffffff", fontWeight: 700, textDecoration: "none" }}
                  onClick={() => {
                    void trackIngredientsRequested(id ?? null, {
                      source: "recipe_detail:shop_missing",
                      missing_count: allMissingIngredients.length,
                      missing_ingredients: allMissingIngredients,
                    });
                  }}
                >
                  Search Walmart for Missing Items
                </a>
              )}
              <button type="button" onClick={() => { void copyMissingItems(); }} disabled={allMissingIngredients.length === 0} style={{ padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid #cbd5e1", background: "#ffffff" }}>
                Copy Missing List
              </button>
              <Link to="/pantry" style={{ display: "inline-flex", alignItems: "center", padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: 600 }}>
                Fix Pantry First
              </Link>
            </div>
            {copyStatus && <div style={{ marginTop: "0.55rem", color: "#475569" }}>{copyStatus}</div>}
          </section>

          <section style={{ border: "1px solid #dbe4ef", borderRadius: 20, padding: "1rem", background: "#ffffff" }}>
            <h2 style={{ marginTop: 0 }}>Ingredients</h2>
            {ingredientStatuses.length === 0 ? (
              <div>No ingredients found.</div>
            ) : (
              <ul>
                {ingredientStatuses.map(({ ingredient, pantryItem, hasEnough }) => {
                  const label = ingredient.display_name ?? ingredient.ingredient_name;
                  const amountLabel = ingredientAmountLabel(ingredient);
                  const pantryLabel = pantryItem ? `${formatQuantity(pantryItem.quantity)} ${pantryItem.unit ?? "ea"}` : null;
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
                          borderColor: hasEnough ? "#2e7d32" : "#b00020",
                          color: hasEnough ? "#2e7d32" : "#b00020",
                        }}
                      >
                        {hasEnough ? "READY" : ingredient.is_required ? "NEED MORE" : "OPTIONAL"}
                      </span>
                      <span style={{ color: "#666" }}>
                        {hasEnough ? "enough in pantry" : ingredient.is_required ? "required" : "optional"}
                      </span>
                      {pantryLabel && <span style={{ color: "#64748b", fontSize: "0.88rem" }}>Pantry: {pantryLabel}</span>}
                      {ingredient.notes && <span style={{ color: "#64748b", fontSize: "0.88rem" }}>{ingredient.notes}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {steps.length > 0 && (
            <section style={{ border: "1px solid #dbe4ef", borderRadius: 20, padding: "1rem", background: "#ffffff" }}>
              <h2 style={{ marginTop: 0 }}>Cook through the steps</h2>
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
          )}

          <section style={{ border: "1px solid #dbe4ef", borderRadius: 20, padding: "1rem", background: "#ffffff" }}>
            <h2 style={{ marginTop: 0 }}>Cook action</h2>
            <div style={{ color: "#64748b", marginBottom: "0.75rem" }}>
              {canCookNow
                ? "Use the cook action once you are ready. Pantry inventory will be deducted on success."
                : "The cook action stays blocked until the required ingredients are back in your pantry with enough quantity."}
            </div>
            <div style={{ marginBottom: "0.75rem", color: canCookNow ? "#166534" : "#9a3412", fontWeight: 700 }}>
              {canCookNow ? "Status: ready to cook." : "Status: blocked until pantry is ready."}
            </div>
            <button
              onClick={() => { void cookRecipe(); }}
              disabled={busy || !canCookNow}
              style={{
                padding: "0.8rem 1rem",
                borderRadius: 12,
                border: "1px solid",
                borderColor: canCookNow ? "#166534" : "#cbd5e1",
                background: canCookNow ? "#166534" : "#e2e8f0",
                color: canCookNow ? "#ffffff" : "#64748b",
                fontWeight: 700,
              }}
            >
              {busy ? "Cooking..." : canCookNow ? "Cook This Recipe" : "Missing Ingredients First"}
            </button>
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
                    <strong>Deducted:</strong> {cookFeedback.deducted.join(", ")}
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
        </div>
      ) : (
        <div style={{ marginTop: "1rem" }}>Recipe not found.</div>
      )}
    </div>
  );
}

export default RecipeDetailPage;
