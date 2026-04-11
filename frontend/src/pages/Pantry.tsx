import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getPantryDisplayName } from "../lib/pantryDisplay";
import {
  clearPantry,
  commitPantryImport,
  fetchPantry,
  mutatePantry,
  previewPantryImport,
  setPantryUseSoon,
  type PantryImportLineResult,
  type PantryItem,
} from "../lib/mvpApi";
import { publishPantryChanged } from "../lib/pantryEvents";

function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  const formatQuantity = (value: number) => {
    if (!Number.isFinite(value)) return String(value);
    if (Math.abs(value - Math.round(value)) < 0.000001) return String(Math.round(value));
    return value.toFixed(2).replace(/\.?0+$/, "");
  };

  const formatItemAmount = (item: PantryItem) => {
    if (item.quantity_is_known === false) {
      return "amount unknown";
    }
    const qty = formatQuantity(typeof item.quantity === "number" ? item.quantity : Number(item.quantity));
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

  const normalizeUnitInput = (value: string) => {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  };

  const splitBulkLines = (raw: string) =>
    raw
      .split(/\r?\n|,/)
      .map((line) => line.trim())
      .filter(Boolean);

  const formatBulkIssues = (results: PantryImportLineResult[]) =>
    results.flatMap((result, index) =>
      result.status === "accepted" ? [] : [`Line ${index + 1}: ${result.reason_message}`],
    );

  const getFormUnitFromItem = (item: PantryItem) => {
    const trimmed = item.unit?.trim() ?? "";
    return trimmed === "ea" ? "" : trimmed;
  };

  const sendMutation = async (action: "add" | "remove", itemName: string, itemAmount: number, itemUnit?: string) => {
    return mutatePantry(action, { name: itemName, amount: itemAmount, unit: itemUnit });
  };

  const mutate = async (action: "add" | "remove") => {
    setError("");
    setStatus("");

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Ingredient name is required.");
      return;
    }

    setBusy(true);
    try {
      const data = await sendMutation(action, trimmed, amount, normalizeUnitInput(unit));
      setItems(data.items ?? []);
      setStatus(`${action === "add" ? "Added" : "Removed"} ${trimmed}.`);
      publishPantryChanged();

      if (action === "add") {
        setName("");
        setUnit("");
        nameRef.current?.focus();
      }
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setBusy(false);
    }
  };

  const fillFormFromItem = (item: PantryItem) => {
    const displayName = getPantryDisplayName(item) || "ingredient";
    setName(displayName);
    setAmount(typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1);
    setUnit(getFormUnitFromItem(item));
    setError("");
    setStatus(
      item.quantity_is_known === false
        ? `Ready to correct ${displayName}. Add the real amount and unit when you know it, or remove the saved row.`
        : `Ready to adjust ${displayName}. Update the amount, then add or remove.`,
    );
    nameRef.current?.focus();
  };

  const removeEntireRow = async (item: PantryItem) => {
    const displayName = getPantryDisplayName(item).trim();
    if (!displayName) {
      setError("Ingredient name is required.");
      return;
    }

    setError("");
    setStatus("");
    setBusy(true);
    try {
      const removalAmount = typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1;
      const data = await sendMutation("remove", displayName, removalAmount, item.unit?.trim() || undefined);
      setItems(data.items ?? []);
      setStatus(`Removed ${displayName}.`);
      publishPantryChanged();
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setBusy(false);
    }
  };

  const toggleUseSoon = async (item: PantryItem) => {
    const displayName = getPantryDisplayName(item).trim();
    if (!displayName) {
      setError("Ingredient name is required.");
      return;
    }

    const nextUseSoon = !item.use_soon;
    setError("");
    setStatus("");
    setBusy(true);
    try {
      const data = await setPantryUseSoon({ name: displayName, use_soon: nextUseSoon });
      setItems(data.items ?? []);
      setStatus(nextUseSoon ? `Marked ${displayName} as use soon.` : `Cleared use soon for ${displayName}.`);
      publishPantryChanged();
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setBusy(false);
    }
  };

  const importBulk = async () => {
    setBulkStatus("");
    setBulkErrors([]);
    setError("");
    setStatus("");

    const lines = splitBulkLines(bulkText);
    if (!lines.length) {
      setBulkErrors(["Nothing to import. Paste a list first."]);
      return;
    }

    setBulkBusy(true);
    try {
      const preview = await previewPantryImport({ lines });
      const previewIssues = formatBulkIssues(preview.results);

      if (preview.summary.accepted_count === 0) {
        setBulkErrors(previewIssues.length > 0 ? previewIssues : ["No pantry lines were safe to import."]);
        setBulkStatus("No pantry lines were safe to import.");
        return;
      }

      const commit = await commitPantryImport({ lines });
      const commitIssues = formatBulkIssues(commit.results);
      const reviewCount = commit.summary.review_count;
      const rejectedCount = commit.summary.rejected_count;
      const pluralizedItem = commit.committed_count === 1 ? "item" : "items";
      const issueFragments: string[] = [];

      if (reviewCount > 0) {
        issueFragments.push(`${reviewCount} line${reviewCount === 1 ? "" : "s"} need review`);
      }
      if (rejectedCount > 0) {
        issueFragments.push(`${rejectedCount} line${rejectedCount === 1 ? "" : "s"} were rejected`);
      }

      setItems(commit.items ?? []);
      setBulkErrors(commitIssues);
      setBulkStatus(
        issueFragments.length > 0
          ? `Imported ${commit.committed_count} ${pluralizedItem}. ${issueFragments.join(" and ")}.`
          : `Imported ${commit.committed_count} ${pluralizedItem}.`,
      );

      if (commit.committed_count > 0) {
        publishPantryChanged();
      }
      if (commitIssues.length === 0) {
        setBulkText("");
      }
    } catch (requestError: unknown) {
      setBulkErrors([requestError instanceof Error ? requestError.message : String(requestError)]);
      setBulkStatus("Bulk import failed.");
    } finally {
      setBulkBusy(false);
    }
  };

  const clearAllItems = async () => {
    setError("");
    setStatus("");
    setBulkStatus("");
    setBulkErrors([]);
    setClearBusy(true);

    try {
      await clearPantry();
      setItems([]);
      setStatus("Pantry cleared.");
      setConfirmingClear(false);
      publishPantryChanged();
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setClearBusy(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void mutate("add");
    }
  };

  return (
    <div className="page-shell" style={{ maxWidth: 1100 }}>
      <section style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start" }}>
        <div style={{ border: "1px solid #dbe4ef", borderRadius: 20, padding: "1.1rem", background: "#ffffff" }}>
          <div style={{ color: "#0f766e", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.76rem" }}>
            Pantry
          </div>
          <h1 style={{ margin: "0.35rem 0 0.45rem", fontFamily: '"Space Grotesk", sans-serif', fontSize: "2rem" }}>Add what you already have</h1>
          <p style={{ color: "#64748b", margin: 0 }}>
            Keep this list simple. Pantry-to-Recipe uses it to decide what is realistic for tonight.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <Link to="/" style={{ display: "inline-flex", alignItems: "center", padding: "0.7rem 0.95rem", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: 600 }}>
              Back to Tonight
            </Link>
            <Link to="/recommendations" style={{ display: "inline-flex", alignItems: "center", padding: "0.7rem 0.95rem", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: 600 }}>
              View Recommendations
            </Link>
            <button
              type="button"
              onClick={() => {
                setError("");
                setStatus("");
                setConfirmingClear((current) => !current);
              }}
              style={{ display: "inline-flex", alignItems: "center", padding: "0.7rem 0.95rem", borderRadius: 10, border: "1px solid #fca5a5", background: "#fff7ed", color: "#9a3412", fontWeight: 600 }}
              disabled={busy || bulkBusy || clearBusy || loading}
            >
              Clear Pantry
            </button>
          </div>

          {confirmingClear && (
            <div style={{ marginTop: "1rem", borderRadius: 16, border: "1px solid #fed7aa", background: "#fff7ed", padding: "0.95rem", display: "grid", gap: "0.75rem" }}>
              <div style={{ fontWeight: 700, color: "#9a3412" }}>Clear all pantry items?</div>
              <div style={{ color: "#7c2d12" }}>
                This will remove every saved pantry item and refresh tonight&apos;s recommendations to match the empty pantry.
              </div>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingClear(false);
                  }}
                  style={{ padding: "0.72rem 1rem", borderRadius: 12, border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: 600 }}
                  disabled={clearBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void clearAllItems();
                  }}
                  style={{ padding: "0.72rem 1rem", borderRadius: 12, border: "1px solid #b91c1c", background: "#b91c1c", color: "#ffffff", fontWeight: 700 }}
                  disabled={clearBusy}
                >
                  {clearBusy ? "Clearing..." : "Yes, Clear Pantry"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ border: "1px solid #dbe4ef", borderRadius: 20, padding: "1.1rem", background: "#f8fafc" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Quick add</h2>
          <p style={{ color: "#64748b", margin: "0.35rem 0 0.8rem" }}>
            Add one ingredient at a time for a fast pantry update. Optional units help keep grams, milliliters, and counts aligned with what is already saved.
          </p>
          <div
            style={{
              marginBottom: "0.85rem",
              borderRadius: 14,
              border: "1px solid #bfdbfe",
              background: "#eff6ff",
              padding: "0.85rem 0.95rem",
              display: "grid",
              gap: "0.35rem",
            }}
          >
            <div style={{ fontWeight: 700, color: "#1d4ed8" }}>Fraction-friendly amounts work here</div>
            <div style={{ color: "#334155", fontSize: "0.95rem" }}>
              Use amounts like <strong>0.25</strong>, <strong>0.5</strong>, or <strong>1.5</strong> when you want a more realistic pantry count.
            </div>
            <div style={{ color: "#475569", fontSize: "0.9rem" }}>
              Example: <strong>milk + 0.5 + cup</strong> or <strong>rice + 250 + g</strong>.
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <label style={{ display: "grid", gap: "0.35rem", color: "#334155", fontWeight: 600 }}>
              Ingredient
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ingredient name"
              style={{ padding: "0.75rem", minWidth: 240, borderRadius: 12, border: "1px solid #cbd5e1" }}
              disabled={busy || clearBusy}
            />
            </label>
            <label style={{ display: "grid", gap: "0.35rem", color: "#334155", fontWeight: 600 }}>
              Amount
            <input
              type="number"
              min={1}
              step="any"
              value={amount}
              onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
              style={{ padding: "0.75rem", width: 120, borderRadius: 12, border: "1px solid #cbd5e1" }}
              disabled={busy || clearBusy}
            />
            </label>
            <label style={{ display: "grid", gap: "0.35rem", color: "#334155", fontWeight: 600 }}>
              Unit
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="unit (optional)"
              style={{ padding: "0.75rem", width: 160, borderRadius: 12, border: "1px solid #cbd5e1" }}
              disabled={busy || clearBusy}
            />
            </label>
            <button onClick={() => { void mutate("add"); }} style={{ padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid #0f766e", background: "#0f766e", color: "#ffffff", fontWeight: 700 }} disabled={busy || clearBusy}>
              {busy ? "Working..." : "Add Item"}
            </button>
            <button onClick={() => { void mutate("remove"); }} style={{ padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid #cbd5e1", background: "#ffffff" }} disabled={busy || clearBusy}>
              Subtract From Pantry
            </button>
          </div>
          <div style={{ marginTop: "0.65rem", color: "#64748b", fontSize: "0.92rem" }}>
            Tip: use <strong>Subtract From Pantry</strong> for partial corrections and <strong>Remove Saved Item</strong> below when you want to delete the saved ingredient completely.
          </div>
        </div>
      </section>

      <section style={{ marginTop: "1rem", border: "1px solid #dbe4ef", borderRadius: 20, padding: "1.1rem", background: "#ffffff" }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Bulk import</h2>
        <p style={{ marginTop: "0.45rem", color: "#64748b" }}>
          Paste one ingredient per line or comma-separated. The backend validates each line so exact quantities and units only save when they can be preserved honestly.
        </p>
        <p style={{ marginTop: "-0.25rem", color: "#64748b", fontSize: "0.92rem" }}>
          If a line cannot be preserved safely, it will be flagged here instead of being guessed.
        </p>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={`e.g.\nchicken\nrice:2\nsalt x3`}
          rows={5}
          style={{ width: "100%", padding: "0.85rem", fontSize: "0.95rem", borderRadius: 12, border: "1px solid #cbd5e1" }}
          disabled={bulkBusy || clearBusy}
        />
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <button onClick={() => { void importBulk(); }} style={{ padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid #0f172a", background: "#0f172a", color: "#ffffff", fontWeight: 700 }} disabled={bulkBusy || clearBusy}>
            {bulkBusy ? "Importing..." : "Import Pantry List"}
          </button>
          <button
            onClick={() => {
              setBulkText("");
              setBulkErrors([]);
              setBulkStatus("");
            }}
            style={{ padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid #cbd5e1", background: "#ffffff" }}
            disabled={bulkBusy || clearBusy}
          >
            Clear
          </button>
        </div>
        {bulkStatus && <div style={{ marginTop: "0.6rem", color: bulkErrors.length > 0 ? "#b45309" : "#166534" }}>{bulkStatus}</div>}
        {bulkErrors.length > 0 && (
          <ul style={{ marginTop: "0.6rem", color: "#b00020" }}>
            {bulkErrors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>

      {loading && <div style={{ marginTop: "0.85rem" }}>Loading pantry...</div>}
      {!loading && status && <div style={{ marginTop: "0.85rem", color: "#166534" }}>{status}</div>}
      {error && <div style={{ marginTop: "0.85rem", color: "#b00020" }}>{error}</div>}

      <section style={{ marginTop: "1.2rem", border: "1px solid #dbe4ef", borderRadius: 20, padding: "1.1rem", background: "#ffffff" }}>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Current pantry</h2>
          {!loading && (
            <div style={{ color: "#64748b", fontSize: "0.92rem", fontWeight: 600 }}>
              {items.length} saved {items.length === 1 ? "item" : "items"}
            </div>
          )}
        </div>
        <p style={{ margin: "0.45rem 0 0", color: "#64748b" }}>
          Load a saved item into the form for a quick correction, mark it use soon when you want it considered in close calls, or remove it completely when it is no longer in the pantry.
        </p>
        {loading ? null : items.length === 0 ? (
          <div style={{ marginTop: "0.65rem", color: "#475569" }}>Your pantry is empty. Add a few basics to start tonight&apos;s recommendation flow.</div>
        ) : (
          <ul style={{ marginTop: "0.75rem", paddingLeft: 0, listStyle: "none", display: "grid", gap: "0.75rem" }}>
            {items.map((item, index) => {
              const displayName = getPantryDisplayName(item) || "unknown ingredient";

              return (
                <li
                  key={`${displayName}-${item.quantity ?? "unknown"}-${index}`}
                  style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: "0.85rem 0.95rem", display: "flex", gap: "0.75rem", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}
                >
                  <div style={{ display: "grid", gap: "0.2rem" }}>
                    <div style={{ display: "flex", gap: "0.45rem", alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{displayName}</div>
                      {item.use_soon && (
                        <span style={{ borderRadius: 999, padding: "0.18rem 0.55rem", background: "#fef3c7", color: "#92400e", fontWeight: 700, fontSize: "0.78rem" }}>
                          Use soon
                        </span>
                      )}
                    </div>
                    <div style={{ color: "#475569" }}>{formatItemAmount(item)}</div>
                    <div style={{ color: "#64748b", fontSize: "0.9rem" }}>
                      {item.use_soon
                        ? "This only gives close recommendation calls a small nudge when the recipe uses this item."
                        : "Mark use soon if you want this item to gently break close recommendation ties."}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      aria-label={item.use_soon ? `Clear use soon for ${displayName}` : `Mark ${displayName} use soon`}
                      onClick={() => {
                        void toggleUseSoon(item);
                      }}
                      style={{
                        padding: "0.65rem 0.9rem",
                        borderRadius: 10,
                        border: item.use_soon ? "1px solid #fbbf24" : "1px solid #cbd5e1",
                        background: item.use_soon ? "#fef3c7" : "#ffffff",
                        color: item.use_soon ? "#92400e" : "#0f172a",
                        fontWeight: 700,
                      }}
                      disabled={busy || bulkBusy || clearBusy}
                    >
                      {item.use_soon ? "Clear Use Soon" : "Mark Use Soon"}
                    </button>
                    <button
                      type="button"
                      aria-label={`Use ${displayName} values`}
                      onClick={() => {
                        fillFormFromItem(item);
                      }}
                      style={{ padding: "0.65rem 0.9rem", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", fontWeight: 600 }}
                      disabled={busy || bulkBusy || clearBusy}
                    >
                      Load Into Form
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove all ${displayName}`}
                      onClick={() => {
                        void removeEntireRow(item);
                      }}
                      style={{ padding: "0.65rem 0.9rem", borderRadius: 10, border: "1px solid #fca5a5", background: "#fff7ed", color: "#9a3412", fontWeight: 700 }}
                      disabled={busy || bulkBusy || clearBusy}
                    >
                      Remove Saved Item
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default PantryPage;
