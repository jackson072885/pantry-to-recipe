import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchRecipeBrowserCatalog } from "./mvpApi";

type MockResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

function makeJsonResponse(payload: unknown, init: { ok?: boolean; status?: number } = {}): MockResponse {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: async () => JSON.stringify(payload),
  };
}

function deferredResponse() {
  let resolve!: (value: MockResponse) => void;
  const promise = new Promise<MockResponse>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}

async function flushMicrotasks(count = 6) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

describe("fetchRecipeBrowserCatalog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps successful detail hydrations in list order and reports partial failures", async () => {
    const fetchMock = vi.fn(async (path: string) => {
      if (path === "/api/recipes?limit=5000") {
        return makeJsonResponse([
          { id: 10, name: "First" },
          { id: 11, name: "Second" },
          { id: 12, name: "Third" },
        ]);
      }

      if (path === "/api/recipes/10") {
        return makeJsonResponse({ id: 10, name: "First", readiness: { can_cook_now: false, required_ready_count: 0, required_count: 0, missing_required_ingredients: [], missing_optional_ingredients: [], required_quantity_confirmation_ingredients: [], optional_quantity_confirmation_ingredients: [] }, ingredients: [], steps: [], equipment: [], tips: [], substitutions: [], warnings: [], storage: [], tags: [] });
      }

      if (path === "/api/recipes/11") {
        return makeJsonResponse({ detail: "Recipe not found" }, { ok: false, status: 404 });
      }

      return makeJsonResponse({ id: 12, name: "Third", readiness: { can_cook_now: false, required_ready_count: 0, required_count: 0, missing_required_ingredients: [], missing_optional_ingredients: [], required_quantity_confirmation_ingredients: [], optional_quantity_confirmation_ingredients: [] }, ingredients: [], steps: [], equipment: [], tips: [], substitutions: [], warnings: [], storage: [], tags: [] });
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRecipeBrowserCatalog()).resolves.toEqual({
      recipes: [
        expect.objectContaining({ id: 10, name: "First" }),
        expect.objectContaining({ id: 12, name: "Third" }),
      ],
      failedRecipeCount: 1,
      totalRecipeCount: 3,
    });
  });

  it("fails closed when every detail hydration fails", async () => {
    const fetchMock = vi.fn(async (path: string) => {
      if (path === "/api/recipes?limit=5000") {
        return makeJsonResponse([{ id: 20, name: "Only Recipe" }]);
      }

      return makeJsonResponse({ detail: "Recipe not found" }, { ok: false, status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRecipeBrowserCatalog()).rejects.toThrow("Recipe Browser catalog failed to hydrate.");
  });

  it("hydrates the browser catalog in bounded batches instead of one unbounded burst", async () => {
    const deferredDetails = new Map<number, ReturnType<typeof deferredResponse>>();
    const listPayload = Array.from({ length: 30 }, (_, index) => ({ id: index + 1, name: `Recipe ${index + 1}` }));
    const fetchMock = vi.fn((path: string) => {
      if (path === "/api/recipes?limit=5000") {
        return Promise.resolve(makeJsonResponse(listPayload));
      }

      const recipeId = Number(path.split("/").pop());
      const deferred = deferredResponse();
      deferredDetails.set(recipeId, deferred);
      return deferred.promise;
    });

    vi.stubGlobal("fetch", fetchMock);

    const catalogPromise = fetchRecipeBrowserCatalog();
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(26);

    for (let recipeId = 1; recipeId <= 25; recipeId += 1) {
      deferredDetails.get(recipeId)?.resolve(
        makeJsonResponse({
          id: recipeId,
          name: `Recipe ${recipeId}`,
          readiness: {
            can_cook_now: false,
            required_ready_count: 0,
            required_count: 0,
            missing_required_ingredients: [],
            missing_optional_ingredients: [],
            required_quantity_confirmation_ingredients: [],
            optional_quantity_confirmation_ingredients: [],
          },
          ingredients: [],
          steps: [],
          equipment: [],
          tips: [],
          substitutions: [],
          warnings: [],
          storage: [],
          tags: [],
        }),
      );
    }

    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(31);

    for (let recipeId = 26; recipeId <= 30; recipeId += 1) {
      deferredDetails.get(recipeId)?.resolve(
        makeJsonResponse({
          id: recipeId,
          name: `Recipe ${recipeId}`,
          readiness: {
            can_cook_now: false,
            required_ready_count: 0,
            required_count: 0,
            missing_required_ingredients: [],
            missing_optional_ingredients: [],
            required_quantity_confirmation_ingredients: [],
            optional_quantity_confirmation_ingredients: [],
          },
          ingredients: [],
          steps: [],
          equipment: [],
          tips: [],
          substitutions: [],
          warnings: [],
          storage: [],
          tags: [],
        }),
      );
    }

    await expect(catalogPromise).resolves.toMatchObject({
      failedRecipeCount: 0,
      totalRecipeCount: 30,
    });
  });
});
