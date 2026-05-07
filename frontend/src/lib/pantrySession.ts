const PANTRY_SESSION_STORAGE_KEY = "pantry_session_id";

function createPantrySessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getPantrySessionId(): string {
  if (typeof localStorage === "undefined") {
    return "anonymous";
  }

  const existing = localStorage.getItem(PANTRY_SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = createPantrySessionId();
  localStorage.setItem(PANTRY_SESSION_STORAGE_KEY, created);
  return created;
}

export { PANTRY_SESSION_STORAGE_KEY };
