export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export type MatchRequest = {
  items: string[];
};

export type MatchRecipe = {
  id?: number;
  name?: string;
  title?: string;
  confidence?: number;
  score?: number;
  missing_ingredients?: string[];
  missing?: string[];
};

export type MatchResponse = {
  pantry?: string[];

  // backend may return arrays OR dict objects; we normalize in UI
  cookable?: MatchRecipe[] | Record<string, MatchRecipe>;
  almost?: MatchRecipe[] | Record<string, MatchRecipe>;

  // your backend currently uses not_cookable
  not?: MatchRecipe[] | Record<string, MatchRecipe>;
  not_cookable?: MatchRecipe[] | Record<string, MatchRecipe>;

  // fallback if backend returns a flat list
  results?: MatchRecipe[];
};

export async function matchPantry(items: string[]): Promise<MatchResponse> {
  const res = await fetch(`${API_BASE_URL}/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} from /match. ${text}`.trim());
  }

  return res.json();
}