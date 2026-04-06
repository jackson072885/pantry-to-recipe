import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { selectBestDinnerOption } from "./homeRecommendations";
import { getPantryDisplayName } from "./pantryDisplay";
import { subscribeToPantryChanged } from "./pantryEvents";
import { fetchPantry, fetchRecommendations, type PantryItem, type RecommendationEntry, type RecommendationsResponse } from "./mvpApi";

type UseSavedPantryRecommendationsOptions = {
  genericErrorMessage: string;
  initialLoading?: boolean;
  resetStateOnError?: boolean;
};

type UseSavedPantryRecommendationsResult = {
  bestEntry: RecommendationEntry | null;
  error: string;
  loading: boolean;
  pantryItems: PantryItem[];
  pantryNames: string[];
  recommendations: RecommendationsResponse | null;
  reload: () => Promise<void>;
};

export function useSavedPantryRecommendations({
  genericErrorMessage,
  initialLoading = false,
  resetStateOnError = false,
}: UseSavedPantryRecommendationsOptions): UseSavedPantryRecommendationsResult {
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState("");
  const activeLoadIdRef = useRef(0);

  const pantryNames = useMemo(
    () =>
      pantryItems
        .map((item) => getPantryDisplayName(item))
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0),
    [pantryItems],
  );

  const reload = useCallback(async () => {
    const loadId = ++activeLoadIdRef.current;
    setError("");
    setLoading(true);

    try {
      const pantry = await fetchPantry();
      if (activeLoadIdRef.current !== loadId) return;

      const nextItems = pantry.items ?? [];
      setPantryItems(nextItems);

      const nextPantryNames = nextItems
        .map((item) => getPantryDisplayName(item))
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0);

      if (nextPantryNames.length === 0) {
        setRecommendations(null);
        return;
      }

      const nextRecommendations = await fetchRecommendations(nextPantryNames);
      if (activeLoadIdRef.current !== loadId) return;

      setRecommendations(nextRecommendations);
      localStorage.setItem("onboarding_recommendations_viewed", "1");
    } catch (requestError: unknown) {
      if (activeLoadIdRef.current !== loadId) return;
      if (resetStateOnError) {
        setPantryItems([]);
        setRecommendations(null);
      }
      setError(requestError instanceof Error ? requestError.message : genericErrorMessage);
    } finally {
      if (activeLoadIdRef.current === loadId) {
        setLoading(false);
      }
    }
  }, [genericErrorMessage, resetStateOnError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return subscribeToPantryChanged(() => {
      void reload();
    });
  }, [reload]);

  const bestEntry = useMemo(() => selectBestDinnerOption(recommendations), [recommendations]);

  return {
    bestEntry,
    error,
    loading,
    pantryItems,
    pantryNames,
    recommendations,
    reload,
  };
}
