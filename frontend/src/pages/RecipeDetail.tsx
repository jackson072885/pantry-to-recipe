import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

type RecipeIngredient = {
  ingredient_id: number;
  ingredient_name: string;
  is_required: boolean;
};

type RecipeDetail = {
  id: number;
  name: string;
  cuisine?: string | null;
  difficulty?: string | null;
  cook_method?: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  total_time_minutes?: number | null;
  oven_temp_f?: number | null;
  air_fryer_temp_f?: number | null;
  servings?: number | null;
  instructions?: string | null;
  ingredients: RecipeIngredient[];
};

function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cookStatus, setCookStatus] = useState("");

  const parseErrorMessage = (text: string) => {
    try {
      const data = JSON.parse(text) as { detail?: string; error?: string };
      return data.detail || data.error || text;
    } catch {
      return text;
    }
  };

  const formatMinutes = (value?: number | null) =>
    typeof value === "number" ? `${value} min` : null;

  useEffect(() => {
    const load = async () => {
      setError("");
      setLoading(true);
      try {
        const response = await fetch(`/recipes/${id}`);
        const text = await response.text();
        if (!response.ok) throw new Error(parseErrorMessage(text) || "Failed to load recipe");
        setRecipe(JSON.parse(text));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    };

    if (id) load();
  }, [id]);

  const cookRecipe = async () => {
    if (!id) return;
    setCookStatus("");
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/cook/${id}`, { method: "POST" });
      const text = await response.text();
      if (!response.ok) throw new Error(parseErrorMessage(text) || "Cook failed");
      const data = JSON.parse(text) as { deducted: string[] };
      localStorage.setItem("onboarding_cooked_recipe", "1");
      setCookStatus(`Cooked! Deducted: ${data.deducted.join(", ") || "none"}.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900 }}>
      <Link to="/search">← Back to Search</Link>

      {loading ? (
        <div style={{ marginTop: "1rem" }}>Loading recipe...</div>
      ) : error ? (
        <div style={{ marginTop: "1rem", color: "#b00020" }}>{error}</div>
      ) : recipe ? (
        <div style={{ marginTop: "1rem" }}>
          <h1>{recipe.name}</h1>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            {recipe.cuisine && <span>Cuisine: {recipe.cuisine}</span>}
            {recipe.difficulty && <span>Difficulty: {recipe.difficulty}</span>}
            {recipe.cook_method && <span>Cook Method: {recipe.cook_method}</span>}
            {formatMinutes(recipe.prep_time_minutes) && (
              <span>Prep Time: {formatMinutes(recipe.prep_time_minutes)}</span>
            )}
            {formatMinutes(recipe.cook_time_minutes) && (
              <span>Cook Time: {formatMinutes(recipe.cook_time_minutes)}</span>
            )}
            {formatMinutes(recipe.total_time_minutes) && (
              <span>Total Time: {formatMinutes(recipe.total_time_minutes)}</span>
            )}
            {recipe.oven_temp_f && <span>Oven Temp: {recipe.oven_temp_f}°F</span>}
            {recipe.air_fryer_temp_f && <span>Air Fryer Temp: {recipe.air_fryer_temp_f}°F</span>}
            {recipe.servings && <span>Servings: {recipe.servings}</span>}
          </div>

          <h2 style={{ marginTop: "1.5rem" }}>Ingredients</h2>
          {recipe.ingredients.length === 0 ? (
            <div>No ingredients found.</div>
          ) : (
            <ul>
              {recipe.ingredients.map((ing) => (
                <li key={ing.ingredient_id}>
                  {ing.ingredient_name}
                  {ing.is_required ? " (required)" : " (optional)"}
                </li>
              ))}
            </ul>
          )}

          {recipe.instructions && (
            <>
              <h2 style={{ marginTop: "1.5rem" }}>Instructions</h2>
              <ol>
                {recipe.instructions
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line, idx) => (
                    <li key={`${idx}-${line.slice(0, 10)}`}>{line}</li>
                  ))}
              </ol>
            </>
          )}

          <div style={{ marginTop: "1rem" }}>
            <button onClick={cookRecipe} disabled={busy}>
              {busy ? "Cooking..." : "Cook This Recipe"}
            </button>
            {cookStatus && <div style={{ marginTop: "0.5rem" }}>{cookStatus}</div>}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: "1rem" }}>Recipe not found.</div>
      )}
    </div>
  );
}

export default RecipeDetailPage;
