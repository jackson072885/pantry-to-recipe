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
  cook_time_minutes?: number | null;
  difficulty?: string | null;
  cuisine?: string | null;
  ingredients: RecipeIngredient[];
};

function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cookStatus, setCookStatus] = useState("");

  useEffect(() => {
    const load = async () => {
      setError("");
      setLoading(true);
      try {
        const response = await fetch(`/recipes/${id}`);
        const text = await response.text();
        if (!response.ok) throw new Error(text || "Failed to load recipe");
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
      if (!response.ok) throw new Error(text || "Cook failed");
      const data = JSON.parse(text) as { deducted: string[] };
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
            {recipe.cook_time_minutes && <span>Cook Time: {recipe.cook_time_minutes} min</span>}
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
