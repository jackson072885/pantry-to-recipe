import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

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
        background: "#d7f2da",
        border: "1px solid #4a9c5b",
        color: "#1f4b2a",
      };
    }
    if (state === "exclude") {
      return {
        margin: "4px",
        background: "#f7d7d7",
        border: "1px solid #b54646",
        color: "#5a1f1f",
      };
    }
    return {
      margin: "4px",
      background: "#ececec",
      border: "1px solid #b5b5b5",
      color: "#2f2f2f",
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
