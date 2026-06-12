import { afterEach, describe, expect, it } from "vitest";
import { getPantrySessionId, PANTRY_SESSION_STORAGE_KEY, resetPantrySessionId } from "./pantrySession";

describe("pantry session storage", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("reuses the stored pantry session id", () => {
    localStorage.setItem(PANTRY_SESSION_STORAGE_KEY, "demo-browser-a");

    expect(getPantrySessionId()).toBe("demo-browser-a");
  });

  it("rotates the pantry session id for a fresh demo start", () => {
    localStorage.setItem(PANTRY_SESSION_STORAGE_KEY, "demo-browser-a");

    const nextSessionId = resetPantrySessionId();

    expect(nextSessionId).toBeTruthy();
    expect(nextSessionId).not.toBe("demo-browser-a");
    expect(localStorage.getItem(PANTRY_SESSION_STORAGE_KEY)).toBe(nextSessionId);
  });
});
