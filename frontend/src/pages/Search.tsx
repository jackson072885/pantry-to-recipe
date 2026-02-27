import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

type FilterKey = "cuisine" | "meal_type" | "method" | "ingredients" | "style";

type FiltersResponse = Record<FilterKey, string[]>;

type SearchRecipe = {
  recipe_id: number;
  recipe_name: string;
  matched_tags: string[];
  missing_count: number;
};

type SearchResponse = {
  cook_now: SearchRecipe[];
  almost_there: SearchRecipe[];
  not_practical: SearchRecipe[];
};

const TABS: { key: FilterKey; label: string }[] = [
  { key: "cuisine", label: "Cuisine" },
  { key: "meal_type", label: "Meal Type" },
  { key: "method", label: "Method & Format" },
  { key: "ingredients", label: "Ingredients" },
  { key: "style", label: "Style & Effort" },
];

function SearchPage() {
  const [filters, setFilters] = useState<FiltersResponse | null>(null);
  const [activeTab, setActiveTab] = useState<FilterKey>("cuisine");
  const [selected, setSelected] = useState<Record<FilterKey, string[]>>({
    cuisine: [],
    meal_type: [],
    method: [],
    ingredients: [],
    style: [],
  });
  const [mode, setMode] = useState<Record<FilterKey, "any" | "all">>({
    cuisine: "any",
    meal_type: "any",
    method: "any",
    ingredients: "any",
    style: "any",
  });
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loadingTags, setLoadingTags] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Load Tags
  useEffect(() => {
    const loadTags = async () => {
      setError("");
      setLoadingTags(true);
      try {
        const response = await fetch(`${API_BASE_URL}/search/tags`);
        if (!response.ok) throw new Error("Failed to load tags");
        const data: TagsResponse = await response.json();
        setGroups(data.groups ?? []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error loading tags");
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

  // Run search whenever filters change
  useEffect(() => {
    const search = async () => {
      setError("");
      setLoadingResults(true);
      try {
        const response = await fetch(`${API_BASE_URL}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ include: includeMap, exclude: excludeMap }),
        });

        if (!response.ok) throw new Error("Search failed");

        const data: SearchResponse = await response.json();
        setResults(data);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Search error");
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

  const tagStyle = (state: TagState): CSSProperties => {
    if (state === "include") {
      return {
        margin: "4px",
        background: "#1f7a3a",
        border: "1px solid #0f4b21",
        color: "#ffffff",
        fontWeight: 600,
        boxShadow: "0 0 0 2px rgba(31, 122, 58, 0.2)",
      };
    }
    if (state === "exclude") {
      return {
        margin: "4px",
        background: "#b82424",
        border: "1px solid #6d0f0f",
        color: "#ffffff",
        fontWeight: 600,
        boxShadow: "0 0 0 2px rgba(184, 36, 36, 0.2)",
      };
    }
    return {
      margin: "4px",
      background: "#f2f2f2",
      border: "1px solid #c8c8c8",
      color: "#4a4a4a",
      opacity: 0.7,
    };
  };

  return (
    <div className="page-shell">
      <h1>Search Recipes</h1>
      <p>Tap a chip to include, exclude, or clear.</p>

      {error && <div style={{ color: "red" }}>{error}</div>}

      {loadingTags ? (
        <div>Loading filters...</div>
      ) : (
        <div>
          {groups.map((group) => (
            <div key={group.name}>
              <h3>{group.name}</h3>
              <div>
                {group.tags.map((tag) => {
                  const state = selection[tag.slug] ?? "neutral";
                  return (
                    <button
                      key={tag.slug}
                      onClick={() => toggleTag(tag)}
                      style={tagStyle(state)}
                      title={stateLabel(state)}
                    >
                      {tag.display_name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <hr />

      <h2>Results</h2>
      {loadingResults ? (
        <div>Searching...</div>
      ) : !results ? (
        <div>No results yet.</div>
      ) : (
        <div>
          <div>
            <h3>Cook Now</h3>
            <ul>
              {results.cook_now.map((r) => (
                <li key={r.recipe_id}>
                  <Link to={`/recipes/${r.recipe_id}`}>{r.recipe_name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Almost There</h3>
            <ul>
              {results.almost_there.map((r) => (
                <li key={r.recipe_id}>
                  <Link to={`/recipes/${r.recipe_id}`}>{r.recipe_name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Not Practical</h3>
            <ul>
              {results.not_practical.map((r) => (
                <li key={r.recipe_id}>
                  <Link to={`/recipes/${r.recipe_id}`}>{r.recipe_name}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {lastUpdated && <div>Last updated at {lastUpdated}</div>}
    </div>
  );
}

export default SearchPage;
