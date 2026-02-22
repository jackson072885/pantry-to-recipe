import { useState } from "react";

function HomePage() {
  const [raw, setRaw] = useState("chicken, rice, salt");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>("");

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
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900 }}>
      <h1>Pantry-to-Recipe</h1>

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
