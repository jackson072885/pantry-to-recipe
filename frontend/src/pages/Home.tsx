import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type PantryResponse = {
  items: { ingredient: string; quantity: number; unit?: string }[];
};

function HomePage() {
  const [raw, setRaw] = useState("chicken, rice, salt");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string>("");
  const [hasPantryItems, setHasPantryItems] = useState(false);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const [cookedOnce, setCookedOnce] = useState(false);

  useEffect(() => {
    const loadChecklist = async () => {
      try {
        const response = await fetch("/pantry");
        if (response.ok) {
          const data = (await response.json()) as PantryResponse;
          setHasPantryItems((data.items ?? []).length > 0);
        }
      } catch {
        setHasPantryItems(false);
      }

      setSearchedOnce(localStorage.getItem("onboarding_search_visited") === "1");
      setCookedOnce(localStorage.getItem("onboarding_cooked_recipe") === "1");
    };

    loadChecklist();
  }, []);

  const completedCount = useMemo(() => {
    return Number(hasPantryItems) + Number(searchedOnce) + Number(cookedOnce);
  }, [cookedOnce, hasPantryItems, searchedOnce]);

  const testMatch = async () => {
    setError("");
    setResult(null);

    const pantry = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const response = await fetch("/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pantry }),
      });

      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}\n${text}`);

      setResult(JSON.parse(text));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900 }}>
      <h1>Pantry-to-Recipe</h1>
      <div style={{ marginTop: "1rem", border: "1px solid #e2e8f0", borderRadius: 12, padding: "1rem" }}>
        <h2 style={{ marginTop: 0, marginBottom: "0.4rem" }}>Onboarding Checklist</h2>
        <div style={{ color: "#64748b", marginBottom: "0.7rem" }}>
          {completedCount}/3 complete
        </div>
        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
          <li style={{ marginBottom: "0.35rem" }}>
            {hasPantryItems ? "Done" : "Todo"}: Add at least one pantry item
          </li>
          <li style={{ marginBottom: "0.35rem" }}>
            {searchedOnce ? "Done" : "Todo"}: Open Search and apply filters
          </li>
          <li>
            {cookedOnce ? "Done" : "Todo"}: Cook one recipe from results
          </li>
        </ul>
      </div>

      <label style={{ display: "block", marginTop: "1rem", fontWeight: 600 }}>
        Pantry items (comma-separated)
      </label>

      <input
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        style={{ width: "100%", padding: "0.75rem", fontSize: "1rem", marginTop: "0.5rem" }}
        placeholder="e.g. chicken, rice, salt"
      />

      <button onClick={testMatch} style={{ marginTop: "1rem", padding: "0.75rem 1rem" }}>
        Match Recipes
      </button>

      <div style={{ marginTop: "1rem" }}>
        <Link
          to="/search"
          style={{
            display: "inline-block",
            padding: "0.6rem 1rem",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            textDecoration: "none",
            color: "#1f2937",
          }}
        >
          Open Bubble Search
        </Link>
      </div>

      {error && (
        <pre style={{ marginTop: "1rem", whiteSpace: "pre-wrap" }}>
          ERROR:
          {"\n"}
          {error}
        </pre>
      )}

      <pre style={{ marginTop: "1rem" }}>{JSON.stringify(result, null, 2)}</pre>
    </div>
  );
}

export default HomePage;
