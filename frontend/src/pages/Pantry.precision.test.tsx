// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PantryPage from "./Pantry";

const {
  fetchPantryMock,
  mutatePantryMock,
  setPantryUseSoonMock,
  clearPantryMock,
  publishPantryChangedMock,
} = vi.hoisted(() => ({
  fetchPantryMock: vi.fn(),
  mutatePantryMock: vi.fn(),
  setPantryUseSoonMock: vi.fn(),
  clearPantryMock: vi.fn(),
  publishPantryChangedMock: vi.fn(),
}));

vi.mock("../lib/mvpApi", () => ({
  fetchPantry: fetchPantryMock,
  mutatePantry: mutatePantryMock,
  setPantryUseSoon: setPantryUseSoonMock,
  clearPantry: clearPantryMock,
}));

vi.mock("../lib/pantryEvents", () => ({
  publishPantryChanged: publishPantryChangedMock,
}));

function findButton(container: HTMLElement, matcher: string | RegExp): HTMLButtonElement {
  const buttons = Array.from(container.querySelectorAll("button"));
  const match = buttons.find((button) => {
    const text = button.textContent?.trim() ?? "";
    const ariaLabel = button.getAttribute("aria-label") ?? "";
    if (typeof matcher === "string") {
      return text === matcher || ariaLabel === matcher;
    }
    return matcher.test(text) || matcher.test(ariaLabel);
  });
  if (!match) {
    throw new Error(`Unable to find button: ${String(matcher)}`);
  }
  return match as HTMLButtonElement;
}

function findInputByPlaceholder(container: HTMLElement, placeholder: string): HTMLInputElement | HTMLTextAreaElement {
  const match = container.querySelector(`[placeholder="${placeholder}"]`);
  if (!match) {
    throw new Error(`Unable to find input with placeholder: ${placeholder}`);
  }
  return match as HTMLInputElement | HTMLTextAreaElement;
}

function findNumberInput(container: HTMLElement): HTMLInputElement {
  const match = container.querySelector('input[type="number"]');
  if (!match) {
    throw new Error("Unable to find number input");
  }
  return match as HTMLInputElement;
}

function findTextarea(container: HTMLElement): HTMLTextAreaElement {
  const match = container.querySelector("textarea");
  if (!match) {
    throw new Error("Unable to find textarea");
  }
  return match as HTMLTextAreaElement;
}

function setFieldValue(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  field.focus();
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  valueSetter?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Pantry precision flow", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    fetchPantryMock.mockReset();
    fetchPantryMock.mockResolvedValue({
      items: [
        { ingredient: "rice", quantity: 500, unit: "g", use_soon: false },
        { ingredient: "egg", quantity: 3, unit: "ea", use_soon: false },
      ],
    });
    mutatePantryMock.mockReset();
    mutatePantryMock.mockResolvedValue({
      items: [
        { ingredient: "rice", quantity: 500, unit: "g" },
        { ingredient: "egg", quantity: 3, unit: "ea", use_soon: false },
      ],
    });
    clearPantryMock.mockReset();
    setPantryUseSoonMock.mockReset();
    publishPantryChangedMock.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function renderPage() {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PantryPage />
        </MemoryRouter>,
      );
    });
  }

  it("removes an exact pantry row with its saved quantity and unit", async () => {
    mutatePantryMock.mockResolvedValueOnce({
      items: [{ ingredient: "egg", quantity: 3, unit: "ea", use_soon: false }],
    });

    await renderPage();

    expect(container.textContent).toContain("Fraction-friendly amounts work here");
    expect(container.textContent).toContain("0.25");
    expect(container.textContent).toContain("0.5");
    expect(container.textContent).toContain("1.5");
    expect(container.textContent).toContain("Bulk import is best for simple counts.");

    await act(async () => {
      findButton(container, "Remove all rice").click();
    });

    expect(mutatePantryMock).toHaveBeenCalledWith("remove", {
      name: "rice",
      amount: 500,
      unit: "g",
    });
    expect(container.textContent).toContain("Removed rice.");
    expect(publishPantryChangedMock).toHaveBeenCalledTimes(1);
  });

  it("loads a pantry row into the quick add form for precise correction", async () => {
    await renderPage();

    await act(async () => {
      findButton(container, "Use rice values").click();
    });

    expect((findInputByPlaceholder(container, "ingredient name") as HTMLInputElement).value).toBe("rice");
    expect(findNumberInput(container).value).toBe("500");
    expect((findInputByPlaceholder(container, "unit (optional)") as HTMLInputElement).value).toBe("g");
    expect(container.textContent).toContain("Ready to adjust rice. Update the amount, then add or remove.");
  });

  it("keeps quick add working with an optional unit", async () => {
    mutatePantryMock.mockResolvedValueOnce({
      items: [
        { ingredient: "rice", quantity: 500, unit: "g", use_soon: false },
        { ingredient: "egg", quantity: 3, unit: "ea", use_soon: false },
        { ingredient: "milk", quantity: 480, unit: "ml", use_soon: false },
      ],
    });

    await renderPage();

    await act(async () => {
      setFieldValue(findInputByPlaceholder(container, "ingredient name"), "milk");
      setFieldValue(findNumberInput(container), "2");
      setFieldValue(findInputByPlaceholder(container, "unit (optional)"), "cup");
    });

    await act(async () => {
      findButton(container, "Add Item").click();
    });

    expect(mutatePantryMock).toHaveBeenCalledWith("add", {
      name: "milk",
      amount: 2,
      unit: "cup",
    });
    expect(container.textContent).toContain("Added milk.");
  });

  it("shows a clear mismatch message when the saved pantry unit conflicts", async () => {
    mutatePantryMock.mockRejectedValueOnce(
      new Error(
        'Can\'t add rice with "cup" because your pantry currently tracks it in "g". Use a compatible weight unit (g, kg, oz, lb). If you meant to restart this ingredient in a different unit, remove the current row first.',
      ),
    );

    await renderPage();

    await act(async () => {
      findButton(container, "Use rice values").click();
      setFieldValue(findInputByPlaceholder(container, "unit (optional)"), "cup");
    });

    await act(async () => {
      findButton(container, "Add Item").click();
    });

    expect(container.textContent).toContain('Can\'t add rice with "cup"');
    expect(container.textContent).toContain("remove the current row first");
  });

  it("keeps bulk import behavior intact", async () => {
    mutatePantryMock
      .mockResolvedValueOnce({
        items: [
          { ingredient: "beans", quantity: 1, unit: "ea", use_soon: false },
          { ingredient: "egg", quantity: 3, unit: "ea", use_soon: false },
          { ingredient: "rice", quantity: 500, unit: "g", use_soon: false },
        ],
      })
      .mockResolvedValueOnce({
        items: [
          { ingredient: "beans", quantity: 1, unit: "ea", use_soon: false },
          { ingredient: "egg", quantity: 3, unit: "ea", use_soon: false },
          { ingredient: "rice", quantity: 500, unit: "g", use_soon: false },
          { ingredient: "salt", quantity: 2, unit: "ea", use_soon: false },
        ],
      });

    await renderPage();

    expect(container.textContent).toContain("0.25");
    expect(container.textContent).toContain("Remove Saved Item");
    expect(container.textContent).toContain("Subtract From Pantry");
    expect(container.textContent).toContain("2 saved items");

    await act(async () => {
      setFieldValue(findTextarea(container), "beans\nsalt:2");
    });

    await act(async () => {
      findButton(container, "Import Pantry List").click();
    });

    expect(mutatePantryMock).toHaveBeenNthCalledWith(1, "add", {
      name: "beans",
      amount: 1,
      unit: undefined,
    });
    expect(mutatePantryMock).toHaveBeenNthCalledWith(2, "add", {
      name: "salt",
      amount: 2,
      unit: undefined,
    });
    expect(container.textContent).toContain("Imported 2 items.");
  });

  it("fails safely when bulk import lines look like precise quantities the parser cannot safely preserve", async () => {
    await renderPage();

    await act(async () => {
      setFieldValue(findTextarea(container), "1/2 cup milk\n2 lb chicken\nrice 250 g\neggs");
    });

    await act(async () => {
      findButton(container, "Import Pantry List").click();
    });

    expect(mutatePantryMock).toHaveBeenCalledTimes(1);
    expect(mutatePantryMock).toHaveBeenCalledWith("add", {
      name: "eggs",
      amount: 1,
      unit: undefined,
    });
    expect(mutatePantryMock).not.toHaveBeenCalledWith("add", expect.objectContaining({ name: "1/2 cup milk" }));
    expect(mutatePantryMock).not.toHaveBeenCalledWith("add", expect.objectContaining({ name: "2 lb chicken" }));
    expect(mutatePantryMock).not.toHaveBeenCalledWith("add", expect.objectContaining({ name: "rice 250 g" }));
    expect(container.textContent).toContain("Line 1");
    expect(container.textContent).toContain("Line 2");
    expect(container.textContent).toContain("Line 3");
  });

  it("shows and updates the use soon flag from the pantry list", async () => {
    fetchPantryMock.mockResolvedValueOnce({
      items: [
        { ingredient: "spinach", quantity: 1, unit: "ea", use_soon: true },
        { ingredient: "rice", quantity: 500, unit: "g", use_soon: false },
      ],
    });
    setPantryUseSoonMock.mockResolvedValueOnce({
      items: [
        { ingredient: "spinach", quantity: 1, unit: "ea", use_soon: false },
        { ingredient: "rice", quantity: 500, unit: "g", use_soon: false },
      ],
    });

    await renderPage();

    expect(container.textContent).toContain("Use soon");
    expect(container.textContent).toContain("small nudge");

    await act(async () => {
      findButton(container, "Clear use soon for spinach").click();
    });

    expect(setPantryUseSoonMock).toHaveBeenCalledWith({ name: "spinach", use_soon: false });
    expect(container.textContent).toContain("Cleared use soon for spinach.");
    expect(publishPantryChangedMock).toHaveBeenCalledTimes(1);
  });
});
