import { useEffect, useMemo, useState } from "react";

type Tag = {
  id: number;
  group_name: string;
  display_name: string;
  slug: string;
  parent_id: number | null;
  weight: number;
};

type TagGroup = {
  name: string;
  tags: Tag[];
};

type TagsResponse = {
  groups: TagGroup[];
};

type SearchRecipe = {
  recipe_id: number;
  recipe_name: string;
  matched_tags: string[];
};

type SearchResponse = {
  cook_now: SearchRecipe[];
  almost_there: SearchRecipe[];
  not_practical: SearchRecipe[];
};

type TagState = "neutral" | "include" | "exclude";

type SelectionState = Record<string, TagState>;

const cycleState = (state: TagState): TagState => {
  if (state === "neutral") return "include";
  if (state === "include") return "exclude";
  return "neutral";
};

const stateLabel = (state: TagState) => {
  if (state === "include") return "Include";
  if (state === "exclude") return "Exclude";
  return "Neutral";
};

function SearchPage() {
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [selection, setSelection] = useState<SelectionState>({});
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loadingTags, setLoadingTags] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    const loadTags = async () => {
      setError("");
      setLoadingTags(true);
      try {
        const response = await fetch("/search/tags");
        const text = await response.text();
        if (!response.ok) {
          let message = text || "Failed to load tags";
          try {
            const parsed = JSON.parse(text);
            message = parsed?.error ?? message;
          } catch {
            // keep raw text
          }
          throw new Error(message);
        }
        const data = JSON.parse(text) as TagsResponse;
        setGroups(data.groups ?? []);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoadingTags(false);
      }
    };

    loadTags();
  }, []);

  const includeMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const group of groups) {
      const slugs = group.tags
        .filter((tag) => selection[tag.slug] === "include")
        .map((tag) => tag.slug);
      if (slugs.length) map[group.name] = slugs;
    }
    return map;
  }, [groups, selection]);

  const excludeMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const group of groups) {
      const slugs = group.tags
        .filter((tag) => selection[tag.slug] === "exclude")
        .map((tag) => tag.slug);
      if (slugs.length) map[group.name] = slugs;
    }
    return map;
  }, [groups, selection]);

  useEffect(() => {
    const search = async () => {
      setError("");
      setLoadingResults(true);
      try {
        const response = await fetch("/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ include: includeMap, exclude: excludeMap }),
        });
        const text = await response.text();
        if (!response.ok) {
          let message = text || "Search failed";
          try {
            const parsed = JSON.parse(text);
            message = parsed?.error ?? message;
          } catch {
            // keep raw text
          }
          throw new Error(message);
        }
        const data = JSON.parse(text) as SearchResponse;
        setResults(data);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoadingResults(false);
      }
    };

    search();
  }, [includeMap, excludeMap]);

  const toggleTag = (tag: Tag) => {
    setSelection((prev) => ({
      ...prev,
      [tag.slug]: cycleState(prev[tag.slug] ?? "neutral"),
    }));
  };

  return (
    <div style={{ padding: "2rem 1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>Search Recipes</h1>
      <p style={{ marginBottom: "0.75rem", color: "#4b5563" }}>
        Tap a chip to include, tap again to exclude, tap a third time to clear.
      </p>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
          fontSize: "0.9rem",
          color: "#374151",
        }}
      >
        <span style={{ padding: "0.2rem 0.6rem", borderRadius: 999, background: "#dbeafe", color: "#1e3a8a" }}>
          Include
        </span>
        <span style={{ padding: "0.2rem 0.6rem", borderRadius: 999, background: "#fee2e2", color: "#991b1b" }}>
          Exclude
        </span>
        <span style={{ padding: "0.2rem 0.6rem", borderRadius: 999, background: "#f3f4f6", color: "#111827" }}>
          Neutral
        </span>
        <span style={{ color: "#6b7280" }}>Across groups = AND, within group = OR.</span>
      </div>

      {error && (
        <div style={{ marginBottom: "1rem", color: "#b00020" }}>{error}</div>
      )}

      {loadingTags ? (
        <div>Loading filters...</div>
      ) : (
        <div style={{ display: "grid", gap: "1.75rem" }}>
          {groups.map((group) => (
            <section
              key={group.name}
              style={{
                padding: "1rem",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#f8fafc",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: "0.75rem" }}>{group.name}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {group.tags.map((tag) => {
                  const state = selection[tag.slug] ?? "neutral";
                  const baseStyle: React.CSSProperties = {
                    borderRadius: 999,
                    padding: "0.4rem 0.9rem",
                    border: "1px solid #cbd5f5",
                    cursor: "pointer",
                    transition: "all 120ms ease",
                    fontSize: "0.95rem",
                    background: "#ffffff",
                  };

                  const stateStyle: React.CSSProperties =
                    state === "include"
                      ? { background: "#dbeafe", borderColor: "#2563eb", color: "#1e3a8a" }
                      : state === "exclude"
                      ? { background: "#fee2e2", borderColor: "#dc2626", color: "#991b1b" }
                      : { background: "#ffffff", color: "#111827" };

                  return (
                    <button
                      key={tag.slug}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      style={{ ...baseStyle, ...stateStyle }}
                      title={`${tag.display_name} · ${stateLabel(state)}`}
                    >
                      {tag.display_name}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <section style={{ marginTop: "2.5rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>Results</h2>
        <div style={{ color: "#6b7280", marginBottom: "0.75rem" }}>
          {loadingResults ? "Searching..." : `Updated live as you toggle filters.${lastUpdated ? ` Last updated at ${lastUpdated}.` : ""}`}
        </div>

        {!results ? (
          <div>No results yet.</div>
        ) : (
          <div style={{ display: "grid", gap: "1.5rem" }}>
            <div>
              <h3>Cook Now</h3>
              {results.cook_now.length === 0 ? (
                <div style={{ color: "#6b7280" }}>No matches.</div>
              ) : (
                <ul>
                  {results.cook_now.map((recipe) => (
                    <li key={recipe.recipe_id}>{recipe.recipe_name}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3>Almost There</h3>
              {results.almost_there.length === 0 ? (
                <div style={{ color: "#6b7280" }}>No matches.</div>
              ) : (
                <ul>
                  {results.almost_there.map((recipe) => (
                    <li key={recipe.recipe_id}>{recipe.recipe_name}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3>Not Practical</h3>
              {results.not_practical.length === 0 ? (
                <div style={{ color: "#6b7280" }}>No matches.</div>
              ) : (
                <ul>
                  {results.not_practical.map((recipe) => (
                    <li key={recipe.recipe_id}>{recipe.recipe_name}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default SearchPage;
