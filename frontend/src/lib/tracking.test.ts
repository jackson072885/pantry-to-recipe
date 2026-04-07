import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getTrackingClientId,
  trackCookClicked,
  trackCtaClicked,
  trackCtaRendered,
  trackIngredientsRequested,
  trackOutboundLinkOpened,
  trackRecipeLiked,
  trackRecipeSelected,
  trackRecipeSkipped,
} from "./tracking";

type StorageState = Record<string, string>;

function createLocalStorageMock(initialState: StorageState = {}) {
  const state: StorageState = { ...initialState };
  return {
    getItem: (key: string) => (key in state ? state[key] : null),
    setItem: (key: string, value: string) => {
      state[key] = String(value);
    },
    removeItem: (key: string) => {
      delete state[key];
    },
    clear: () => {
      Object.keys(state).forEach((key) => delete state[key]);
    },
  };
}

describe("tracking", () => {
  let localStorageMock: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    localStorageMock = createLocalStorageMock();
    vi.stubGlobal("localStorage", localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("persists a stable anonymous client id", () => {
    const first = getTrackingClientId();
    const second = getTrackingClientId();
    expect(first).toBeTruthy();
    expect(second).toBe(first);
    expect(localStorageMock.getItem("pantry_tracking_client_id")).toBe(first);
  });

  it("sends recipe_selected through the events endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        success: true,
        data: { action_id: 1, event: "recipe_selected", recipe_id: 9, recorded_at: "2026-03-26T00:00:00", accepted: true },
        error: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(trackRecipeSelected(9, { source: "test" })).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.event).toBe("recipe_selected");
    expect(body.recipe_id).toBe(9);
    expect(body.metadata.source).toBe("test");
    expect(body.metadata.client_id).toBeTruthy();
  });

  it("sends revenue-path events through the events endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        success: true,
        data: { action_id: 2, event: "cta_rendered", recipe_id: 11, recorded_at: "2026-03-26T00:00:00", accepted: true },
        error: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(trackCtaRendered(11, { source: "best_option" })).resolves.toBe(true);
    await expect(trackCtaClicked(11, { source: "best_option" })).resolves.toBe(true);
    await expect(trackOutboundLinkOpened(11, { href: "https://www.walmart.com/search?q=onion" })).resolves.toBe(true);

    const sentEvents = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).event);
    expect(sentEvents).toEqual(["cta_rendered", "cta_clicked", "outbound_link_opened"]);
  });

  it("soft-fails when tracking endpoint is unavailable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(trackCookClicked(4, { source: "test" })).resolves.toBe(false);
    await expect(trackIngredientsRequested(4, { source: "test" })).resolves.toBe(false);
  });

  it("sends explicit preference feedback events through the events endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        success: true,
        data: { action_id: 3, event: "recipe_liked", recipe_id: 7, recorded_at: "2026-03-26T00:00:00", accepted: true },
        error: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(trackRecipeLiked(7, { source: "recipe_detail" })).resolves.toBe(true);
    await expect(trackRecipeSkipped(7, { source: "recipe_detail" })).resolves.toBe(true);

    const sentEvents = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).event);
    expect(sentEvents).toEqual(["recipe_liked", "recipe_skipped"]);
  });
});
