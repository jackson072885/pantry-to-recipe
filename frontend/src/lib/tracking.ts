import { postOptional } from "./apiClient";
import { getPantrySessionId } from "./pantrySession";

export type TrackingEventName =
  | "recipe_selected"
  | "cook_clicked"
  | "ingredients_requested"
  | "recipe_cooked_confirmed"
  | "recipe_liked"
  | "recipe_skipped"
  | "cta_rendered"
  | "cta_clicked"
  | "outbound_link_opened"
  | "external_candidate_review_requested";

const TRACKING_CLIENT_STORAGE_KEY = "pantry_tracking_client_id";

function createTrackingClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function currentPath(): string {
  if (typeof window === "undefined" || !window.location) {
    return "/";
  }
  return window.location.pathname;
}

function normalizeRecipeId(recipeId: number | string | null | undefined): number | null {
  if (recipeId === null || recipeId === undefined || recipeId === "") {
    return null;
  }
  const parsed = Number(recipeId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function getTrackingClientId(): string {
  const sessionId = getPantrySessionId();
  if (typeof localStorage === "undefined") return sessionId;

  const existing = localStorage.getItem(TRACKING_CLIENT_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = createTrackingClientId();
  localStorage.setItem(TRACKING_CLIENT_STORAGE_KEY, created);
  return created;
}

export async function trackUserAction(
  event: TrackingEventName,
  recipeId?: number | string | null,
  metadata: Record<string, unknown> = {},
): Promise<boolean> {
  return postOptional("/events", {
    event,
    recipe_id: normalizeRecipeId(recipeId),
    metadata: {
      client_id: getTrackingClientId(),
      path: currentPath(),
      ...metadata,
    },
  });
}

export async function trackRecipeSelected(recipeId: number | string, metadata: Record<string, unknown> = {}): Promise<boolean> {
  return trackUserAction("recipe_selected", recipeId, metadata);
}

export async function trackCookClicked(recipeId: number | string, metadata: Record<string, unknown> = {}): Promise<boolean> {
  return trackUserAction("cook_clicked", recipeId, metadata);
}

export async function trackIngredientsRequested(
  recipeId: number | string | null,
  metadata: Record<string, unknown> = {},
): Promise<boolean> {
  return trackUserAction("ingredients_requested", recipeId, metadata);
}

export async function trackRecipeCookedConfirmed(recipeId: number | string, metadata: Record<string, unknown> = {}): Promise<boolean> {
  return trackUserAction("recipe_cooked_confirmed", recipeId, metadata);
}

export async function trackRecipeLiked(recipeId: number | string, metadata: Record<string, unknown> = {}): Promise<boolean> {
  return trackUserAction("recipe_liked", recipeId, metadata);
}

export async function trackRecipeSkipped(recipeId: number | string, metadata: Record<string, unknown> = {}): Promise<boolean> {
  return trackUserAction("recipe_skipped", recipeId, metadata);
}

export async function trackCtaRendered(recipeId: number | string | null, metadata: Record<string, unknown> = {}): Promise<boolean> {
  return trackUserAction("cta_rendered", recipeId, metadata);
}

export async function trackCtaClicked(recipeId: number | string | null, metadata: Record<string, unknown> = {}): Promise<boolean> {
  return trackUserAction("cta_clicked", recipeId, metadata);
}

export async function trackOutboundLinkOpened(
  recipeId: number | string | null,
  metadata: Record<string, unknown> = {},
): Promise<boolean> {
  return trackUserAction("outbound_link_opened", recipeId, metadata);
}

export async function trackExternalCandidateReviewRequested(
  metadata: Record<string, unknown> = {},
): Promise<boolean> {
  return trackUserAction("external_candidate_review_requested", null, metadata);
}

export async function trackEvent(
  event: TrackingEventName,
  payload: {
    recipeId?: number | string | null;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<boolean> {
  return trackUserAction(event, payload.recipeId, payload.metadata ?? {});
}
