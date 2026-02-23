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
    <div className="page-shell">
      <div className="search-header">
        <h1>Search Recipes</h1>
        <p className="search-subtitle">
          Tap a chip to include, tap again to exclude, tap a third time to clear.
        </p>
      </div>
      <div className="legend">
        <span className="legend-include">Include</span>
        <span className="legend-exclude">Exclude</span>
        <span className="legend-neutral">Neutral</span>
        <span>Across groups = AND, within group = OR.</span>
      </div>

      {error && (
        <div style={{ marginBottom: "1rem", color: "#b00020" }}>{error}</div>
      )}

      {loadingTags ? (
        <div>Loading filters...</div>
      ) : (
        <div className="group-grid">
          {groups.map((group) => (
            <section key={group.name} className="group-card">
              <div className="group-title">{group.name}</div>
              <div className="chip-grid">
                {group.tags.map((tag) => {
                  const state = selection[tag.slug] ?? "neutral";
                  const chipClass =
                    state === "include" ? "chip chip--include" : state === "exclude" ? "chip chip--exclude" : "chip";

                  return (
                    <button
                      key={tag.slug}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={chipClass}
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

      <section className="results-grid">
        <div>
          <h2>Results</h2>
          <div className="status-line">
            {loadingResults
              ? "Searching..."
              : `Updated live as you toggle filters.${lastUpdated ? ` Last updated at ${lastUpdated}.` : ""}`}
          </div>
        </div>

        {!results ? (
          <div>No results yet.</div>
        ) : (
          <div className="results-grid">
            <div className="results-card">
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
            <div className="results-card">
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
            <div className="results-card">
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
