import { useMemo, useState } from "react";
import "./App.css";
import {
  matchPantry,
  type MatchRecipe,
  type MatchResponse,
  API_BASE_URL,
} from "./lib/api";

function normalizeRecipe(r: MatchRecipe) {
  const title = r.name ?? r.title ?? "Untitled recipe";
  const score = r.confidence ?? r.score ?? 0;
  const missing = r.missing_ingredients ?? r.missing ?? [];
  return { ...r, title, score, missing };
}

function toArray<T>(
  val: T[] | Record<string, T> | undefined | null
): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return Object.values(val);
}

function Section({
  title,
  items,
}: {
  title: string;
  items: ReturnType<typeof normalizeRecipe>[];
}) {
  return (
    <div
      style={{
        padding: 12,
        border: "1px solid #ddd",
        borderRadius: 10,
        marginTop: 12,
      }}
    >
      <h3 style={{ margin: 0 }}>
        {title} ({items.length})
      </h3>

      {items.length === 0 ? (
        <p style={{ marginTop: 8, opacity: 0.7 }}>None</p>
      ) : (
        <ul style={{ marginTop: 8 }}>
          {items.map((r, idx) => (
            <li
              key={(r.id ?? idx).toString()}
              style={{ marginBottom: 10 }}
            >
              <div style={{ fontWeight: 700 }}>
                {(r as any).title}
              </div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                score: {Number((r as any).score).toFixed(3)}
              </div>

              {(r as any).missing?.length > 0 && (
                <div style={{ fontSize: 13 }}>
                  missing:{" "}
                  <span style={{ opacity: 0.85 }}>
                    {(r as any).missing.join(", ")}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState(
    "eggs, milk, butter"
  );
  const [data, setData] =
    useState<MatchResponse | null>(null);
  const [error, setError] =
    useState<string>("");
  const [loading, setLoading] =
    useState(false);

  const pantry = useMemo(() => {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [input]);

  const grouped = useMemo(() => {
    if (!data) return null;

    const cookable = toArray(data.cookable).map(
      normalizeRecipe
    );

    const almost = toArray(data.almost).map(
      normalizeRecipe
    );

    const not = toArray(
      (data as any).not ??
        (data as any).not_cookable
    ).map(normalizeRecipe);

    const flat = toArray(
      data.results as any
    ).map(normalizeRecipe);

    return { cookable, almost, not, flat };
  }, [data]);

  async function onMatch() {
    setError("");
    setLoading(true);
    setData(null);

    try {
      const result = await matchPantry(pantry);
      setData(result);
    } catch (e: any) {
      setError(
        e?.message ??
          "Unknown error calling /match"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 900,
        margin: "40px auto",
        padding: 16,
        fontFamily: "system-ui, Arial",
      }}
    >
      <h1 style={{ marginTop: 0 }}>
        Pantry-to-Recipe
      </h1>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <input
          value={input}
          onChange={(e) =>
            setInput(e.target.value)
          }
          placeholder="comma-separated pantry items (e.g. eggs, milk, butter)"
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ccc",
          }}
        />

        <button
          onClick={onMatch}
          disabled={
            loading || pantry.length === 0
          }
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ccc",
            cursor: loading
              ? "not-allowed"
              : "pointer",
          }}
        >
          {loading
            ? "Matching..."
            : "Match"}
        </button>
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 13,
          opacity: 0.8,
        }}
      >
        API: {API_BASE_URL} · Endpoint:
        /match · Pantry items:{" "}
        {pantry.length}
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            background: "#ffe8e8",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {grouped && (
        <>
          {grouped.cookable.length +
            grouped.almost.length +
            grouped.not.length >
          0 ? (
            <>
              <Section
                title="Cookable now"
                items={grouped.cookable}
              />
              <Section
                title="Almost cookable"
                items={grouped.almost}
              />
              <Section
                title="Not cookable"
                items={grouped.not}
              />
            </>
          ) : (
            <Section
              title="Results"
              items={grouped.flat}
            />
          )}
        </>
      )}
    </div>
  );
}