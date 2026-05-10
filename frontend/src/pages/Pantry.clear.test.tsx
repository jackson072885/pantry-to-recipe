// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PantryPage from "./Pantry";

const {
  fetchPantryMock,
  mutatePantryMock,
  clearPantryMock,
  publishPantryChangedMock,
} = vi.hoisted(() => ({
  fetchPantryMock: vi.fn(),
  mutatePantryMock: vi.fn(),
  clearPantryMock: vi.fn(),
  publishPantryChangedMock: vi.fn(),
}));

vi.mock("../lib/mvpApi", () => ({
  fetchPantry: fetchPantryMock,
  mutatePantry: mutatePantryMock,
  clearPantry: clearPantryMock,
}));

vi.mock("../lib/pantryEvents", () => ({
  publishPantryChanged: publishPantryChangedMock,
}));

function findButton(container: HTMLElement, label: string): HTMLButtonElement {
  const buttons = Array.from(container.querySelectorAll("button"));
  const match = buttons.find((button) => button.textContent?.trim() === label);
  if (!match) {
    throw new Error(`Unable to find button: ${label}`);
  }
  return match as HTMLButtonElement;
}

describe("Pantry clear flow", () => {
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
        { ingredient: "rice", quantity: 1, unit: "ea" },
        { ingredient: "beans", quantity: 2, unit: "ea" },
      ],
    });
    mutatePantryMock.mockReset();
    clearPantryMock.mockReset();
    publishPantryChangedMock.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows a confirmation panel before clearing", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PantryPage />
        </MemoryRouter>,
      );
    });

    await act(async () => {
      findButton(container, "Clear Pantry").click();
    });

    expect(container.textContent).toContain("Clear all pantry items?");
    expect(container.textContent).toContain("This will remove every saved pantry item");

    await act(async () => {
      findButton(container, "Cancel").click();
    });

    expect(container.textContent).not.toContain("Clear all pantry items?");
    expect(clearPantryMock).not.toHaveBeenCalled();
  });

  it("does not focus the quick-add ingredient input on page load", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PantryPage />
        </MemoryRouter>,
      );
    });

    const ingredientInput = container.querySelector<HTMLInputElement>('input[placeholder="ingredient name"]');

    expect(ingredientInput).toBeTruthy();
    expect(document.activeElement).not.toBe(ingredientInput);
  });

  it("clears the pantry after confirmation and shows the empty state", async () => {
    clearPantryMock.mockResolvedValue({ cleared_count: 2 });

    await act(async () => {
      root.render(
        <MemoryRouter>
          <PantryPage />
        </MemoryRouter>,
      );
    });

    await act(async () => {
      findButton(container, "Clear Pantry").click();
    });

    await act(async () => {
      findButton(container, "Yes, Clear Pantry").click();
    });

    expect(clearPantryMock).toHaveBeenCalledTimes(1);
    expect(publishPantryChangedMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Pantry cleared.");
    expect(container.textContent).toContain("Your pantry is empty.");
  });
});
