// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "../App";
import { RECIPE_BROWSER_MVP_FILTER_ORDER } from "../lib/recipeBrowserMvp";

describe("Recipe Browser page shell", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the dedicated route, nav entry, and filter family labels from the shared contract", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/recipe-browser"]}>
          <App />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Recipe Browser");
    expect(container.textContent).toContain("Browse dinner ideas by filter family first");
    expect(container.textContent).toContain("Sorted by: Best Pantry Match");

    const navLinks = Array.from(container.querySelectorAll(".top-nav a"));
    const browserLink = navLinks.find((link) => link.textContent?.trim() === "Recipe Browser");
    expect(browserLink?.getAttribute("href")).toBe("/recipe-browser");
    expect(browserLink?.className).toContain("active");

    const tabButtons = Array.from(container.querySelectorAll('[role="tab"]'));
    expect(tabButtons).toHaveLength(RECIPE_BROWSER_MVP_FILTER_ORDER.length);
    expect(tabButtons.map((button) => button.textContent?.trim())).toEqual(
      RECIPE_BROWSER_MVP_FILTER_ORDER.map((family) => family.label),
    );

    expect(container.textContent).toContain("Bubble filters arrive in the next phase.");
    expect(container.textContent).toContain("No active filter chips yet.");
  });
});
