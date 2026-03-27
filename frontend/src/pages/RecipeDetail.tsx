import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiClientError } from "../lib/apiClient";
import { cookRecipe as sendCookRecipe, fetchPantry, fetchRecipeDetail, type RecipeDetail } from "../lib/mvpApi";
import { trackCookClicked, trackIngredientsRequested, trackRecipeCookedConfirmed } from "../lib/tracking";
import { mapPantryToSupplyItems } from "../lib/providerApi";

type CookFeedback = {
  message: string;
  deducted: string[];
  missing: string[];
  isError: boolean;
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

function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [pantryItems, setPantryItems] = useState<string[]>([]);
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [cookFeedback, setCookFeedback] = useState<CookFeedback | null>(null);

  const formatMinutes = (value?: number | null) =>
    typeof value === "number" ? `${value} min` : null;

  const checklistStorageKey = id ? `recipe_checklist_${id}` : "";
  const steps = useMemo(() => {
    if (!recipe?.instructions) return [];
    return recipe.instructions
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }, [recipe?.instructions]);

  const ingredientStatuses = useMemo(() => {
    const pantrySet = new Set(pantryItems);
    return (recipe?.ingredients ?? []).map((ing) => {
      const normalized = normalizeIngredientName(ing.ingredient_name);
      const inPantry = pantrySet.has(normalized);
      return { ingredient: ing, inPantry };
    });
  }, [pantryItems, recipe?.ingredients]);

  const missingIngredients = useMemo(
    () => ingredientStatuses.filter((item) => !item.inPantry).map((item) => item.ingredient.ingredient_name),
    [ingredientStatuses],
  );

  useEffect(() => {
    const load = async () => {
      setError("");
      setLoading(true);
      try {
        if (!id) throw new Error("Recipe id is required.");
        const [recipeData, pantryData] = await Promise.all([fetchRecipeDetail(id), fetchPantry()]);
        setRecipe(recipeData);
        setPantryItems(mapPantryToSupplyItems(pantryData.items ?? []));
      } catch (requestError: unknown) {
        setError(requestError instanceof Error ? requestError.message : String(requestError));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [id]);

  const cookRecipe = async () => {
    if (!id) return;
    setCookFeedback(null);
    setBusy(true);
    void trackCookClicked(id, {
      source: "recipe_detail:button",
      missing_count: missingIngredients.length,
      missing_ingredients: missingIngredients,
    });
    try {
      const data = await sendCookRecipe(id);
      localStorage.setItem("onboarding_cooked_recipe", "1");
      setCookFeedback(parseCookFeedbackSuccess(data));
      void trackRecipeCookedConfirmed(id, {
        source: "recipe_detail:success",
        deducted: data.deducted,
      });
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
    if (!missingIngredients.length) return;
    setCopyStatus("");
    void trackIngredientsRequested(id ?? null, {
      source: "recipe_detail:copy_missing",
      missing_count: missingIngredients.length,
      missing_ingredients: missingIngredients,
    });
    try {
      await navigator.clipboard.writeText(missingIngredients.join("\n"));
      setCopyStatus("Missing items copied.");
    } catch {
      setCopyStatus("Could not copy. Clipboard permission may be blocked.");
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900 }}>
      <Link to="/recommendations">&lt;- Back to Recommendations</Link>

      {loading ? (
        <div style={{ marginTop: "1rem" }}>Loading recipe...</div>
      ) : error ? (
        <div style={{ marginTop: "1rem", color: "#b00020" }}>{error}</div>
      ) : recipe ? (
        <div style={{ marginTop: "1rem" }}>
          <h1>{recipe.name}</h1>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            {formatMinutes(recipe.total_time_minutes) && <span>Time: {formatMinutes(recipe.total_time_minutes)}</span>}
            {recipe.servings && <span>Servings: {recipe.servings}</span>}
            {recipe.cuisine && <span>Cuisine: {recipe.cuisine}</span>}
            {recipe.difficulty && <span>Difficulty: {recipe.difficulty}</span>}
            {recipe.cook_method && <span>Cook Method: {recipe.cook_method}</span>}
            {formatMinutes(recipe.prep_time_minutes) && <span>Prep Time: {formatMinutes(recipe.prep_time_minutes)}</span>}
            {formatMinutes(recipe.cook_time_minutes) && <span>Cook Time: {formatMinutes(recipe.cook_time_minutes)}</span>}
            {recipe.oven_temp_f && <span>Oven Temp: {recipe.oven_temp_f}F</span>}
            {recipe.air_fryer_temp_f && <span>Air Fryer Temp: {recipe.air_fryer_temp_f}F</span>}
          </div>

          <h2 style={{ marginTop: "1.5rem" }}>Ingredients</h2>
          {ingredientStatuses.length === 0 ? (
            <div>No ingredients found.</div>
          ) : (
            <ul>
              {ingredientStatuses.map(({ ingredient: ing, inPantry }) => (
                <li key={ing.ingredient_id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <strong>{ing.ingredient_name}</strong>
                  <span
                    style={{
                      padding: "0.1rem 0.45rem",
                      borderRadius: 12,
                      fontSize: "0.75rem",
                      border: "1px solid",
                      borderColor: inPantry ? "#2e7d32" : "#b00020",
                      color: inPantry ? "#2e7d32" : "#b00020",
                    }}
                  >
                    {inPantry ? "IN PANTRY" : "MISSING"}
                  </span>
                  <span style={{ color: "#666" }}>{ing.is_required ? "required" : "optional"}</span>
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            <button type="button" onClick={() => { void copyMissingItems(); }} disabled={missingIngredients.length === 0}>
              Copy missing items
            </button>
            <Link to="/pantry">Add missing to pantry</Link>
          </div>
          {copyStatus && <div style={{ marginTop: "0.5rem" }}>{copyStatus}</div>}

          {steps.length > 0 && (
            <>
              <h2 style={{ marginTop: "1.5rem" }}>Steps Checklist</h2>
              <div style={{ marginBottom: "0.5rem" }}>
                <button type="button" onClick={resetChecklist} disabled={checkedSteps.length === 0}>
                  Reset checklist
                </button>
              </div>
              <ol style={{ paddingLeft: "1.25rem" }}>
                {steps.map((line, idx) => (
                  <li key={`${idx}-${line.slice(0, 10)}`} style={{ marginBottom: "0.4rem" }}>
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
            </>
          )}

          <div style={{ marginTop: "1rem" }}>
            <button onClick={() => { void cookRecipe(); }} disabled={busy}>
              {busy ? "Cooking..." : "Cook This Recipe"}
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
          </div>
        </div>
      ) : (
        <div style={{ marginTop: "1rem" }}>Recipe not found.</div>
      )}
    </div>
  );
}

export default RecipeDetailPage;
