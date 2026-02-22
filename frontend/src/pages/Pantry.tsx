import { useEffect, useRef, useState } from "react";

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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  const loadPantry = async () => {
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/pantry");
      const text = await response.text();
      if (!response.ok) {
        let message = text;
        try {
          const parsed = JSON.parse(text);
          message = parsed?.error ?? text;
        } catch {
          // keep raw text
        }
        throw new Error(`HTTP ${response.status} ${response.statusText}\n${message}`);
      }
      const data = JSON.parse(text) as PantryResponse;
      setItems(data.items ?? []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPantry();
    nameRef.current?.focus();
  }, []);

  const mutate = async (action: "add" | "remove") => {
    setError("");
    setStatus("");

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Ingredient name is required");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/pantry/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, amount }),
      });

      const text = await response.text();
      if (!response.ok) {
        let message = text;
        try {
          const parsed = JSON.parse(text);
          message = parsed?.error ?? text;
        } catch {
          // keep raw text
        }
        throw new Error(`HTTP ${response.status} ${response.statusText}\n${message}`);
      }

      const data = JSON.parse(text) as PantryResponse;
      setItems(data.items ?? []);
      setStatus(`${action === "add" ? "Added" : "Removed"} ${trimmed}`);

      if (action === "add") {
        setName("");
        nameRef.current?.focus();
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      mutate("add");
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900 }}>
      <h1>Pantry</h1>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ingredient name"
          style={{ padding: "0.6rem", minWidth: 240 }}
          disabled={busy}
        />
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
          style={{ padding: "0.6rem", width: 120 }}
          disabled={busy}
        />
        <button onClick={() => mutate("add")} style={{ padding: "0.6rem 1rem" }} disabled={busy}>
          {busy ? "Working..." : "Add"}
        </button>
        <button onClick={() => mutate("remove")} style={{ padding: "0.6rem 1rem" }} disabled={busy}>
          Remove
        </button>
      </div>

      {loading && <div style={{ marginTop: "0.75rem" }}>Loading pantry...</div>}
      {!loading && status && <div style={{ marginTop: "0.75rem" }}>{status}</div>}
      {error && (
        <div style={{ marginTop: "0.75rem", color: "#b00020" }}>{error}</div>
      )}

      <h2 style={{ marginTop: "1.5rem" }}>Current Items</h2>
      {loading ? null : items.length === 0 ? (
        <div style={{ marginTop: "0.5rem" }}>Your pantry is empty. Add something to get started.</div>
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
