import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getPantryDisplayName } from "../lib/pantryDisplay";
import { fetchPantry, mutatePantry, type PantryItem } from "../lib/mvpApi";

type BulkItem = {
  name: string;
  amount: number;
};

function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(1);
  const [bulkText, setBulkText] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  const formatQuantity = (value: number) => {
    if (!Number.isFinite(value)) return String(value);
    if (Math.abs(value - Math.round(value)) < 0.000001) return String(Math.round(value));
    return value.toFixed(2).replace(/\.?0+$/, "");
  };

  const formatItemAmount = (item: PantryItem) => {
    const qty = formatQuantity(item.quantity);
    const unit = item.unit?.trim() || "ea";
    if (unit === "ea") {
      return `${qty} each`;
    }
    return `${qty} ${unit}`;
  };

  const loadPantry = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await fetchPantry();
      setItems(data.items ?? []);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPantry();
    nameRef.current?.focus();
  }, []);

  const sendMutation = async (action: "add" | "remove", itemName: string, itemAmount: number) => {
    return mutatePantry(action, { name: itemName, amount: itemAmount });
  };

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
      const data = await sendMutation(action, trimmed, amount);
      setItems(data.items ?? []);
      setStatus(`${action === "add" ? "Added" : "Removed"} ${trimmed}`);

      if (action === "add") {
        setName("");
        nameRef.current?.focus();
      }
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setBusy(false);
    }
  };

  const parseBulkItems = (raw: string): { items: BulkItem[]; errors: string[] } => {
    const lines = raw
      .split(/\n|,/)
      .map((line) => line.trim())
      .filter(Boolean);

    const parsed: BulkItem[] = [];
    const errors: string[] = [];

    lines.forEach((line, index) => {
      let namePart = line;
      let qty = 1;

      const colonMatch = line.match(/^(.*?)[=:]\s*(\d+)$/);
      if (colonMatch) {
        namePart = colonMatch[1].trim();
        qty = Number(colonMatch[2]);
      } else {
        const suffixMatch = line.match(/^(.*?)(?:\s+x|\s+)(\d+)$/i);
        if (suffixMatch) {
          namePart = suffixMatch[1].trim();
          qty = Number(suffixMatch[2]);
        }
      }

      if (!namePart) {
        errors.push(`Line ${index + 1}: missing ingredient name.`);
        return;
      }

      if (!Number.isFinite(qty) || qty < 1) {
        errors.push(`Line ${index + 1}: invalid quantity "${qty}".`);
        return;
      }

      parsed.push({ name: namePart, amount: qty });
    });

    return { items: parsed, errors };
  };

  const importBulk = async () => {
    setBulkStatus("");
    setBulkErrors([]);
    setError("");
    setStatus("");

    const { items: parsed, errors } = parseBulkItems(bulkText);
    if (errors.length) {
      setBulkErrors(errors);
      return;
    }
    if (!parsed.length) {
      setBulkErrors(["Nothing to import. Paste a list first."]);
      return;
    }

    setBulkBusy(true);
    const failed: string[] = [];
    try {
      for (const item of parsed) {
        try {
          const data = await sendMutation("add", item.name, item.amount);
          setItems(data.items ?? []);
        } catch (requestError: unknown) {
          failed.push(`${item.name}: ${requestError instanceof Error ? requestError.message : String(requestError)}`);
        }
      }
      if (failed.length) {
        setBulkErrors(failed);
        setBulkStatus(`Imported ${parsed.length - failed.length} items with ${failed.length} errors.`);
      } else {
        setBulkStatus(`Imported ${parsed.length} items.`);
        setBulkText("");
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void mutate("add");
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
        <button onClick={() => { void mutate("add"); }} style={{ padding: "0.6rem 1rem" }} disabled={busy}>
          {busy ? "Working..." : "Add"}
        </button>
        <button onClick={() => { void mutate("remove"); }} style={{ padding: "0.6rem 1rem" }} disabled={busy}>
          Remove
        </button>
        <Link to="/recommendations" style={{ display: "inline-flex", alignItems: "center", padding: "0.6rem 1rem" }}>
          View recommendations
        </Link>
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Bulk Import</h2>
        <p style={{ marginTop: 0 }}>
          Paste one ingredient per line or comma-separated. Optionally add quantities like <strong>rice:2</strong> or <strong>tomato x3</strong>.
        </p>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={`e.g.\nchicken\nrice:2\nsalt x3`}
          rows={5}
          style={{ width: "100%", padding: "0.75rem", fontSize: "0.95rem" }}
          disabled={bulkBusy}
        />
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <button onClick={() => { void importBulk(); }} style={{ padding: "0.6rem 1rem" }} disabled={bulkBusy}>
            {bulkBusy ? "Importing..." : "Import List"}
          </button>
          <button
            onClick={() => {
              setBulkText("");
              setBulkErrors([]);
              setBulkStatus("");
            }}
            style={{ padding: "0.6rem 1rem" }}
            disabled={bulkBusy}
          >
            Clear
          </button>
        </div>
        {bulkStatus && <div style={{ marginTop: "0.5rem" }}>{bulkStatus}</div>}
        {bulkErrors.length > 0 && (
          <ul style={{ marginTop: "0.5rem", color: "#b00020" }}>
            {bulkErrors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>

      {loading && <div style={{ marginTop: "0.75rem" }}>Loading pantry...</div>}
      {!loading && status && <div style={{ marginTop: "0.75rem" }}>{status}</div>}
      {error && <div style={{ marginTop: "0.75rem", color: "#b00020" }}>{error}</div>}

      <h2 style={{ marginTop: "1.5rem" }}>Current Items</h2>
      {loading ? null : items.length === 0 ? (
        <div style={{ marginTop: "0.5rem" }}>Your pantry is empty. Add something to get started.</div>
      ) : (
        <ul style={{ marginTop: "0.5rem" }}>
          {items.map((item, index) => (
            <li key={`${getPantryDisplayName(item)}-${item.quantity}-${index}`}>
              {getPantryDisplayName(item) || "unknown ingredient"} - {formatItemAmount(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default PantryPage;
