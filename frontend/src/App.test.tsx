// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./pages/Home", () => ({
  default: () => <main>Dinner Tonight page</main>,
}));

vi.mock("./pages/Pantry", () => ({
  default: () => <main>Your Pantry page</main>,
}));

vi.mock("./pages/Search", () => ({
  default: () => <main>Tonight&apos;s Matches page</main>,
}));

vi.mock("./pages/RecipeBrowser", () => ({
  default: () => <main>Recipe Browser page</main>,
}));

vi.mock("./pages/RecipeDetail", () => ({
  default: () => <main>Recipe Detail page</main>,
}));

describe("App navigation scroll behavior", () => {
  let container: HTMLDivElement;
  let root: Root;
  let scrollToMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    scrollToMock = vi.fn();
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: scrollToMock,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("resets scroll to the top when a main nav route changes", () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/pantry"]}>
          <App />
        </MemoryRouter>,
      );
    });

    scrollToMock.mockClear();

    const recipeBrowserLink = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent === "Recipe Browser",
    );

    expect(recipeBrowserLink).toBeTruthy();

    act(() => {
      recipeBrowserLink?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(scrollToMock).toHaveBeenCalledWith({ top: 0, left: 0 });
  });
});
