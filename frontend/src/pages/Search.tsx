import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

type FilterKey = "cuisine" | "meal_type" | "method" | "ingredients" | "style";
type ModeValue = "any" | "all";

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

const EMPTY_SELECTION: Record<FilterKey, string[]> = {
  cuisine: [],
  meal_type: [],
  method: [],
  ingredients: [],
  style: [],
};

const EMPTY_MODE: Record<FilterKey, ModeValue> = {
  cuisine: "any",
  meal_type: "any",
  method: "any",
  ingredients: "any",
  style: "any",
};

const FILTER_KEYS: FilterKey[] = TABS.map((tab) => tab.key);

const isFilterKey = (value: string): value is FilterKey =>
  FILTER_KEYS.includes(value as FilterKey);

const parseSelectionFromParams = (params: URLSearchParams): Record<FilterKey, string[]> => {
  const parsed: Record<FilterKey, string[]> = { ...EMPTY_SELECTION };
  for (const key of FILTER_KEYS) {
    const values = params.getAll(`f_${key}`).filter(Boolean);
    if (values.length) parsed[key] = values;
  }
  return parsed;
};

const parseModeFromParams = (params: URLSearchParams): Record<FilterKey, ModeValue> => {
  const parsed: Record<FilterKey, ModeValue> = { ...EMPTY_MODE };
  for (const key of FILTER_KEYS) {
    const value = params.get(`m_${key}`);
    if (value === "any" || value === "all") parsed[key] = value;
  }
  return parsed;
};

const parseActiveTabFromParams = (params: URLSearchParams): FilterKey => {
  const value = params.get("tab");
  return value && isFilterKey(value) ? value : "cuisine";
};

const serializeParams = (
  activeTab: FilterKey,
  selected: Record<FilterKey, string[]>,
  mode: Record<FilterKey, ModeValue>,
): URLSearchParams => {
  const params = new URLSearchParams();

  if (activeTab !== "cuisine") {
    params.set("tab", activeTab);
  }

  for (const key of FILTER_KEYS) {
    for (const value of selected[key]) {
      params.append(`f_${key}`, value);
    }
    if (mode[key] !== "any") {
      params.set(`m_${key}`, mode[key]);
    }
  }

  return params;
};

function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersData, setFiltersData] = useState<FiltersResponse | null>(null);
  const [activeTab, setActiveTab] = useState<FilterKey>(() => parseActiveTabFromParams(searchParams));
  const [selected, setSelected] = useState<Record<FilterKey, string[]>>(() => parseSelectionFromParams(searchParams));
  const [mode, setMode] = useState<Record<FilterKey, ModeValue>>(() => parseModeFromParams(searchParams));
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const firstResultRenderedSent = useRef(false);
  const onboardingSessionId = useMemo(() => {
    const existing = sessionStorage.getItem("onboarding_session_id");
    if (existing) return existing;
    const created = `onb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("onboarding_session_id", created);
    return created;
  }, []);
  const sessionStartAtMs = useMemo(() => {
    const existing = sessionStorage.getItem("onboarding_session_start_ms");
    if (existing) return Number(existing);
    const created = Date.now();
    sessionStorage.setItem("onboarding_session_start_ms", String(created));
    return created;
  }, []);

  useEffect(() => {
    localStorage.setItem("onboarding_search_visited", "1");
  }, []);

  useEffect(() => {
    const paramsActiveTab = parseActiveTabFromParams(searchParams);
    const paramsSelected = parseSelectionFromParams(searchParams);
    const paramsMode = parseModeFromParams(searchParams);

    if (paramsActiveTab !== activeTab) setActiveTab(paramsActiveTab);
    if (JSON.stringify(paramsSelected) !== JSON.stringify(selected)) setSelected(paramsSelected);
    if (JSON.stringify(paramsMode) !== JSON.stringify(mode)) setMode(paramsMode);
  }, [searchParams, activeTab, mode, selected]);

  useEffect(() => {
    const nextParams = serializeParams(activeTab, selected, mode);
    const current = searchParams.toString();
    const next = nextParams.toString();
    if (current !== next) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeTab, mode, searchParams, selected, setSearchParams]);

  useEffect(() => {
    const loadFilters = async () => {
      setError("");
      setLoadingFilters(true);
      try {
        const response = await fetch("/search/filters");
        if (!response.ok) throw new Error("Failed to load filters");
        const data = (await response.json()) as FiltersResponse;
        setFiltersData(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error loading filters");
      } finally {
        setLoadingFilters(false);
      }
    };

    loadFilters();
  }, []);

  const requestFilters = useMemo(() => {
    const payload: Partial<Record<FilterKey, string[]>> = {};
    for (const tab of TABS) {
      const values = selected[tab.key];
      if (values.length > 0) {
        payload[tab.key] = values;
      }
    }
    return payload;
  }, [selected]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setError("");
      setLoadingResults(true);
      try {
        const response = await fetch("/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filters: requestFilters, mode }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Search failed");

        const data = (await response.json()) as SearchResponse;
        setResults(data);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Search error");
      } finally {
        setLoadingResults(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestFilters, mode]);

  useEffect(() => {
    if (loadingResults || !results || firstResultRenderedSent.current) return;

    const rafId = requestAnimationFrame(() => {
      if (firstResultRenderedSent.current) return;
      firstResultRenderedSent.current = true;

      const ttfrMs = Math.max(Date.now() - sessionStartAtMs, 0);
      const bestTonight = results.cook_now[0] ?? results.almost_there[0] ?? results.not_practical[0] ?? null;

      void fetch("/insights/telemetry/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: onboardingSessionId,
          event_name: "first_result_rendered",
          properties: {
            ttfr_ms: ttfrMs,
            result_counts: {
              cookable: results.cook_now.length,
              almost: results.almost_there.length,
              not: results.not_practical.length,
            },
            best_tonight: bestTonight
              ? {
                  recipe_id: bestTonight.recipe_id,
                  reasons_count: bestTonight.matched_tags.length,
                }
              : null,
          },
        }),
      }).catch(() => {
        // non-blocking telemetry
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [loadingResults, onboardingSessionId, results, sessionStartAtMs]);

  const toggleBubble = (tab: FilterKey, value: string) => {
    setSelected((prev) => {
      const exists = prev[tab].includes(value);
      return {
        ...prev,
        [tab]: exists ? prev[tab].filter((v) => v !== value) : [...prev[tab], value],
      };
    });
  };

  const removeActiveFilter = (tab: FilterKey, value: string) => {
    setSelected((prev) => ({
      ...prev,
      [tab]: prev[tab].filter((v) => v !== value),
    }));
  };

  const activeFilters = useMemo(() => {
    const mapped: { tab: FilterKey; tabLabel: string; value: string }[] = [];
    for (const tab of TABS) {
      for (const value of selected[tab.key]) {
        mapped.push({ tab: tab.key, tabLabel: tab.label, value });
      }
    }
    return mapped;
  }, [selected]);

  const activeValues = filtersData?.[activeTab] ?? [];
  const hasSelectedInTab = selected[activeTab].length > 0;

  return (
    <div className="page-shell">
      <h1>Search Recipes</h1>
      <p>Pick filters by tab. Across tabs is AND; within a tab uses ANY/ALL.</p>

      {error && <div style={{ color: "#b91c1c" }}>{error}</div>}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: 999,
                border: isActive ? "1px solid #0369a1" : "1px solid #cbd5e1",
                background: isActive ? "#e0f2fe" : "#ffffff",
                color: isActive ? "#0c4a6e" : "#334155",
                fontWeight: isActive ? 700 : 600,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loadingFilters ? (
        <div style={{ marginTop: "1rem" }}>Loading filters...</div>
      ) : (
        <div style={{ marginTop: "1rem", border: "1px solid #e2e8f0", borderRadius: 12, padding: "1rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
              marginBottom: "0.75rem",
            }}
          >
            <strong>{TABS.find((t) => t.key === activeTab)?.label}</strong>
            <div
              style={{
                display: "inline-flex",
                border: "1px solid #cbd5e1",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              {(["any", "all"] as ModeValue[]).map((value) => {
                const isOn = mode[activeTab] === value;
                return (
                  <button
                    key={value}
                    onClick={() => setMode((prev) => ({ ...prev, [activeTab]: value }))}
                    style={{
                      padding: "0.35rem 0.8rem",
                      border: "none",
                      background: isOn ? "#0ea5e9" : "#ffffff",
                      color: isOn ? "#ffffff" : "#334155",
                      fontWeight: 700,
                    }}
                  >
                    {value.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          {!activeValues.length ? (
            <div style={{ color: "#64748b" }}>No options in this tab.</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {activeValues.map((value) => {
                const selectedInTab = selected[activeTab].includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleBubble(activeTab, value)}
                    style={{
                      padding: "0.4rem 0.85rem",
                      borderRadius: 999,
                      border: selectedInTab ? "1px solid #0369a1" : "1px solid #cbd5e1",
                      background: selectedInTab ? "#e0f2fe" : "#ffffff",
                      color: selectedInTab ? "#0c4a6e" : "#334155",
                      fontWeight: selectedInTab ? 700 : 500,
                    }}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: "0.75rem", color: "#64748b", fontSize: "0.9rem" }}>
            {hasSelectedInTab
              ? `${selected[activeTab].length} selected in this tab`
              : "No selections in this tab"}
          </div>
        </div>
      )}

      <hr style={{ margin: "1.5rem 0" }} />

      <h2>Results</h2>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        {activeFilters.length === 0 ? (
          <span style={{ color: "#64748b", fontSize: "0.9rem" }}>No active filters</span>
        ) : (
          activeFilters.map((chip) => (
            <button
              key={`${chip.tab}:${chip.value}`}
              onClick={() => removeActiveFilter(chip.tab, chip.value)}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 999,
                background: "#ffffff",
                padding: "0.25rem 0.65rem",
                fontSize: "0.85rem",
                color: "#334155",
              }}
              title="Remove filter"
            >
              {chip.tabLabel}: {chip.value} x
            </button>
          ))
        )}
      </div>
      {loadingResults ? (
        <div>Searching...</div>
      ) : !results ? (
        <div>No results yet.</div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          <ResultSection
            title="Cookable"
            color="#15803d"
            bg="#f0fdf4"
            items={results.cook_now}
            showMissing={false}
          />
          <ResultSection
            title="Almost There"
            color="#b45309"
            bg="#fffbeb"
            items={results.almost_there}
            showMissing
          />
          <ResultSection
            title="Not Cookable"
            color="#991b1b"
            bg="#fef2f2"
            items={results.not_practical}
            showMissing
          />
        </div>
      )}

      {lastUpdated && <div style={{ marginTop: "0.75rem", color: "#64748b" }}>Last updated at {lastUpdated}</div>}
    </div>
  );
}

function ResultSection({
  title,
  items,
  color,
  bg,
  showMissing,
}: {
  title: string;
  items: SearchRecipe[];
  color: string;
  bg: string;
  showMissing: boolean;
}) {
  return (
    <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "0.75rem 1rem", background: bg, borderBottom: "1px solid #e2e8f0" }}>
        <strong>{title}</strong> <span style={{ color: "#64748b" }}>({items.length})</span>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: "0.85rem 1rem", color: "#64748b" }}>No recipes.</div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item) => (
            <li
              key={item.recipe_id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.7rem 1rem",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <span style={{ width: 6, alignSelf: "stretch", borderRadius: 99, background: color }} />
              <Link to={`/recipes/${item.recipe_id}`} style={{ flex: 1, color: "#0f172a", textDecoration: "underline" }}>
                {item.recipe_name}
              </Link>
              {showMissing && item.missing_count > 0 && (
                <span
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    border: "1px solid #cbd5e1",
                    borderRadius: 999,
                    padding: "0.2rem 0.55rem",
                    color: "#475569",
                    background: "#ffffff",
                  }}
                >
                  Missing {item.missing_count}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default SearchPage;
