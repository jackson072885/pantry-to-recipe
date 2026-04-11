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
  previewPantryImportMock,
  commitPantryImportMock,
  publishPantryChangedMock,
} = vi.hoisted(() => ({
  fetchPantryMock: vi.fn(),
  mutatePantryMock: vi.fn(),
  setPantryUseSoonMock: vi.fn(),
  clearPantryMock: vi.fn(),
  previewPantryImportMock: vi.fn(),
  commitPantryImportMock: vi.fn(),
  publishPantryChangedMock: vi.fn(),
}));

vi.mock("../lib/mvpApi", () => ({
  fetchPantry: fetchPantryMock,
  mutatePantry: mutatePantryMock,
  setPantryUseSoon: setPantryUseSoonMock,
  clearPantry: clearPantryMock,
  previewPantryImport: previewPantryImportMock,
  commitPantryImport: commitPantryImportMock,
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
    previewPantryImportMock.mockReset();
    commitPantryImportMock.mockReset();
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
    expect(container.textContent).toContain("The backend validates each line");

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

  it("routes bulk import through backend preview and commit while preserving exact quantities and units", async () => {
    previewPantryImportMock.mockResolvedValueOnce({
      results: [
        {
          raw_line: "1/2 cup milk",
          cleaned_line: "1/2 cup milk",
          status: "accepted",
          parsed_quantity: 0.5,
          parsed_unit: "cup",
          parsed_ingredient_text: "milk",
          canonical_unit: "ml",
          canonical_ingredient: "milk",
          reason_code: "accepted",
          reason_message: "Line is safe to import",
        },
        {
          raw_line: "2 lb chicken",
          cleaned_line: "2 lb chicken",
          status: "accepted",
          parsed_quantity: 2,
          parsed_unit: "lb",
          parsed_ingredient_text: "chicken",
          canonical_unit: "g",
          canonical_ingredient: "chicken",
          reason_code: "accepted",
          reason_message: "Line is safe to import",
        },
        {
          raw_line: "3 eggs",
          cleaned_line: "3 eggs",
          status: "accepted",
          parsed_quantity: 3,
          parsed_unit: null,
          parsed_ingredient_text: "eggs",
          canonical_unit: null,
          canonical_ingredient: "eggs",
          reason_code: "accepted",
          reason_message: "Line is safe to import",
        },
      ],
      summary: {
        line_count: 3,
        accepted_count: 3,
        review_count: 0,
        rejected_count: 0,
      },
    });
    commitPantryImportMock.mockResolvedValueOnce({
      results: [
        {
          raw_line: "1/2 cup milk",
          cleaned_line: "1/2 cup milk",
          status: "accepted",
          parsed_quantity: 0.5,
          parsed_unit: "cup",
          parsed_ingredient_text: "milk",
          canonical_unit: "ml",
          canonical_ingredient: "milk",
          reason_code: "accepted",
          reason_message: "Line is safe to import",
        },
        {
          raw_line: "2 lb chicken",
          cleaned_line: "2 lb chicken",
          status: "accepted",
          parsed_quantity: 2,
          parsed_unit: "lb",
          parsed_ingredient_text: "chicken",
          canonical_unit: "g",
          canonical_ingredient: "chicken",
          reason_code: "accepted",
          reason_message: "Line is safe to import",
        },
        {
          raw_line: "3 eggs",
          cleaned_line: "3 eggs",
          status: "accepted",
          parsed_quantity: 3,
          parsed_unit: null,
          parsed_ingredient_text: "eggs",
          canonical_unit: null,
          canonical_ingredient: "eggs",
          reason_code: "accepted",
          reason_message: "Line is safe to import",
        },
      ],
      summary: {
        line_count: 3,
        accepted_count: 3,
        review_count: 0,
        rejected_count: 0,
      },
      committed_count: 3,
      items: [
        { ingredient: "chicken", quantity: 907.185, unit: "g", quantity_is_known: true, use_soon: false },
        { ingredient: "eggs", quantity: 3, unit: "ea", quantity_is_known: true, use_soon: false },
        { ingredient: "milk", quantity: 120, unit: "ml", quantity_is_known: true, use_soon: false },
      ],
    });

    await renderPage();

    expect(container.textContent).toContain("0.25");
    expect(container.textContent).toContain("Remove Saved Item");
    expect(container.textContent).toContain("Subtract From Pantry");
    expect(container.textContent).toContain("2 saved items");
    expect(container.textContent).toContain("The backend validates each line");

    await act(async () => {
      setFieldValue(findTextarea(container), "1/2 cup milk\n2 lb chicken\n3 eggs");
    });

    await act(async () => {
      findButton(container, "Import Pantry List").click();
    });

    expect(previewPantryImportMock).toHaveBeenCalledWith({
      lines: ["1/2 cup milk", "2 lb chicken", "3 eggs"],
    });
    expect(commitPantryImportMock).toHaveBeenCalledWith({
      lines: ["1/2 cup milk", "2 lb chicken", "3 eggs"],
    });
    expect(container.textContent).toContain("Imported 3 items.");
  });

  it("shows backend review and rejection feedback without committing unsafe lines", async () => {
    previewPantryImportMock.mockResolvedValueOnce({
      results: [
        {
          raw_line: "some cheese",
          cleaned_line: "some cheese",
          status: "rejected",
          parsed_quantity: null,
          parsed_unit: null,
          parsed_ingredient_text: "some cheese",
          canonical_unit: null,
          canonical_ingredient: null,
          reason_code: "line_not_parseable",
          reason_message: "Vague quantities are not supported",
        },
        {
          raw_line: "mystery ingredient",
          cleaned_line: "mystery ingredient",
          status: "review",
          parsed_quantity: null,
          parsed_unit: null,
          parsed_ingredient_text: "mystery ingredient",
          canonical_unit: null,
          canonical_ingredient: null,
          reason_code: "ingredient_not_found",
          reason_message: "Ingredient did not match an existing canonical ingredient or safe alias",
        },
      ],
      summary: {
        line_count: 2,
        accepted_count: 0,
        review_count: 1,
        rejected_count: 1,
      },
    });

    await renderPage();

    await act(async () => {
      setFieldValue(findTextarea(container), "some cheese\nmystery ingredient");
    });

    await act(async () => {
      findButton(container, "Import Pantry List").click();
    });

    expect(previewPantryImportMock).toHaveBeenCalledWith({
      lines: ["some cheese", "mystery ingredient"],
    });
    expect(commitPantryImportMock).not.toHaveBeenCalled();
    expect(container.textContent).toContain("No pantry lines were safe to import.");
    expect(container.textContent).toContain("Line 1");
    expect(container.textContent).toContain("Line 2");
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
