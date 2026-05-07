import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, getJson, unwrapResponse } from "./apiClient";

describe("apiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("prefixes relative API paths with /api and unwraps a successful envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        success: true,
        data: { value: 42 },
        error: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJson<{ value: number }>("/example")).resolves.toEqual({ value: 42 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/example",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Headers).get("X-Pantry-Session-Id")).toBeTruthy();
  });

  it("throws the backend error message from an error envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({
        success: false,
        data: null,
        error: { code: "BAD_REQUEST", message: "At least one pantry item is required" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJson("/recommendations")).rejects.toEqual(
      expect.objectContaining({
        name: "ApiClientError",
        message: "At least one pantry item is required",
        status: 400,
        code: "BAD_REQUEST",
      }),
    );
    const [, init] = fetchMock.mock.calls[0];
    expect((init?.headers as Headers).get("X-Pantry-Session-Id")).toBeTruthy();
  });

  it("reuses the persisted pantry session id across requests", async () => {
    localStorage.setItem("pantry_session_id", "browser-a");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        success: true,
        data: { value: 42 },
        error: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getJson<{ value: number }>("/first");
    await getJson<{ value: number }>("/second");

    const sentSessionIds = fetchMock.mock.calls.map(([, init]) =>
      (init?.headers as Headers).get("X-Pantry-Session-Id"),
    );
    expect(sentSessionIds).toEqual(["browser-a", "browser-a"]);
  });

  it("throws when unwrapResponse receives a failed envelope", () => {
    expect(() =>
      unwrapResponse(
        {
          success: false,
          data: null,
          error: { code: "BAD_REQUEST", message: "bad request" },
        },
        400,
      ),
    ).toThrow(ApiClientError);
  });
});
