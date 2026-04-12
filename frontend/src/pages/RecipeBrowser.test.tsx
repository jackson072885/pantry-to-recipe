// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import App from "../App";
import { RECIPE_BROWSER_MVP_FILTER_ORDER, RECIPE_BROWSER_MVP_FILTERS } from "../lib/recipeBrowserMvp";

function click(element: Element | null | undefined) {
  if (!element) {
    throw new Error("Expected element to exist before clicking.");
  }

  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("Recipe Browser filter UI", () => {
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

  async function renderRecipeBrowser() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/recipe-browser"]}>
          <App />
        </MemoryRouter>,
      );
    });
  }

  function getTab(label: string) {
    return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
      (button) => button.textContent?.trim() === label,
    );
  }

  function getChip(label: string) {
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-filter-chip")).find((button) =>
      button.textContent?.includes(label),
    );
  }

  function getActiveFilterChip(label: string) {
    return Array.from(container.querySelectorAll<HTMLButtonElement>(".browser-active-filter-chip")).find((button) =>
      button.textContent?.includes(label),
    );
  }

  it("renders tabs from the shared contract and defaults to the first family panel", async () => {
    await renderRecipeBrowser();

    expect(container.textContent).toContain("Recipe Browser");
    expect(container.textContent).toContain("Sorted by: Best Pantry Match");

    const tabButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabButtons).toHaveLength(RECIPE_BROWSER_MVP_FILTER_ORDER.length);
    expect(tabButtons.map((button) => button.textContent?.trim())).toEqual(
      RECIPE_BROWSER_MVP_FILTER_ORDER.map((family) => family.label),
    );

    expect(getTab("Protein")?.getAttribute("aria-selected")).toBe("true");
    expect(container.textContent).toContain("Now browsingProtein");

    expect(container.textContent).toContain(RECIPE_BROWSER_MVP_FILTERS.protein.options[0].label);
    expect(container.textContent).not.toContain(RECIPE_BROWSER_MVP_FILTERS.cuisine.options[0].label);
  });

  it("switches tabs and renders only the active family bubble set", async () => {
    await renderRecipeBrowser();

    click(getTab("Cuisine"));

    expect(getTab("Cuisine")?.getAttribute("aria-selected")).toBe("true");
    expect(getTab("Protein")?.getAttribute("aria-selected")).toBe("false");
    expect(container.textContent).toContain("Now browsingCuisine");
    expect(container.textContent).toContain(RECIPE_BROWSER_MVP_FILTERS.cuisine.options[0].label);
    expect(container.querySelector(".browser-filter-chip")?.textContent).not.toContain(
      RECIPE_BROWSER_MVP_FILTERS.protein.options[0].label,
    );
  });

  it("selects and deselects bubbles with active filters shown separately", async () => {
    await renderRecipeBrowser();

    const chickenChip = getChip("Chicken");
    click(chickenChip);

    expect(chickenChip?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Current selections");
    expect(container.textContent).toContain("ProteinChicken");

    click(chickenChip);

    expect(chickenChip?.getAttribute("aria-pressed")).toBe("false");
    expect(container.textContent).toContain("Active Filters");
    expect(container.textContent).not.toContain("Current selections");
  });

  it("preserves selections across tab changes", async () => {
    await renderRecipeBrowser();

    click(getChip("Chicken"));
    click(getTab("Cuisine"));
    click(getChip("Italian"));
    click(getTab("Protein"));

    expect(getChip("Chicken")?.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("ProteinChicken");
    expect(container.textContent).toContain("CuisineItalian");
  });

  it("removes a single active filter without clearing the rest", async () => {
    await renderRecipeBrowser();

    click(getChip("Chicken"));
    click(getTab("Cuisine"));
    click(getChip("Italian"));
    click(getActiveFilterChip("Chicken"));

    expect(container.textContent).not.toContain("ProteinChicken");
    expect(container.textContent).toContain("CuisineItalian");
    click(getTab("Protein"));
    expect(getChip("Chicken")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("clears all selected filters at once", async () => {
    await renderRecipeBrowser();

    click(getChip("Chicken"));
    click(getTab("Cuisine"));
    click(getChip("Italian"));
    click(container.querySelector(".browser-active-filters-clear"));

    expect(container.textContent).not.toContain("Current selections");
    expect(container.textContent).toContain("Active Filters");
    click(getTab("Protein"));
    expect(getChip("Chicken")?.getAttribute("aria-pressed")).toBe("false");
    click(getTab("Cuisine"));
    expect(getChip("Italian")?.getAttribute("aria-pressed")).toBe("false");
  });
});
