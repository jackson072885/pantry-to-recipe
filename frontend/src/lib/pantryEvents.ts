const PANTRY_CHANGED_EVENT = "pantry:changed";
const PANTRY_CHANGED_STORAGE_KEY = "pantry_updated_at";

export function publishPantryChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PANTRY_CHANGED_EVENT));
  }

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(PANTRY_CHANGED_STORAGE_KEY, String(Date.now()));
    } catch {
      // Ignore storage write failures so pantry mutations still succeed.
    }
  }
}

export function subscribeToPantryChanged(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handlePantryChanged = () => {
    onChange();
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === PANTRY_CHANGED_STORAGE_KEY) {
      onChange();
    }
  };

  window.addEventListener(PANTRY_CHANGED_EVENT, handlePantryChanged);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(PANTRY_CHANGED_EVENT, handlePantryChanged);
    window.removeEventListener("storage", handleStorage);
  };
}
