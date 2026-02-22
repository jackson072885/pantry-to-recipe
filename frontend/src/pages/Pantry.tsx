import { useEffect, useState } from "react";

type PantryItem = {
  ingredient: string;
  quantity: number;
};

type PantryResponse = {
  items: PantryItem[];
};

function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(1);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const loadPantry = async () => {
    try {
      const response = await fetch("/pantry");
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}\n${text}`);
      const data = JSON.parse(text) as PantryResponse;
      setItems(data.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  useEffect(() => {
    loadPantry();
  }, []);

  const mutate = async (action: "add" | "remove") => {
    setError("");
    setStatus("");

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Ingredient name is required");
      return;
    }

    try {
      const response = await fetch(`/pantry/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, amount }),
      });

      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}\n${text}`);

      setStatus(`${action === "add" ? "Added" : "Removed"} ${trimmed}`);
      await loadPantry();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900 }}>
      <h1>Pantry</h1>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ingredient name"
          style={{ padding: "0.6rem", minWidth: 240 }}
        />
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
          style={{ padding: "0.6rem", width: 120 }}
        />
        <button onClick={() => mutate("add")} style={{ padding: "0.6rem 1rem" }}>
          Add
        </button>
        <button onClick={() => mutate("remove")} style={{ padding: "0.6rem 1rem" }}>
          Remove
        </button>
      </div>

      {status && <div style={{ marginTop: "0.75rem" }}>{status}</div>}
      {error && (
        <pre style={{ marginTop: "0.75rem", whiteSpace: "pre-wrap" }}>
          ERROR:
          {"\n"}
          {error}
        </pre>
      )}

      <h2 style={{ marginTop: "1.5rem" }}>Current Items</h2>
      {items.length === 0 ? (
        <div style={{ marginTop: "0.5rem" }}>No pantry items yet.</div>
      ) : (
        <ul style={{ marginTop: "0.5rem" }}>
          {items.map((item) => (
            <li key={item.ingredient}>
              {item.ingredient} — {item.quantity}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default PantryPage;
