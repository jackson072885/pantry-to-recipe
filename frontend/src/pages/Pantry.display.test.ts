import { describe, expect, it } from "vitest";

import { getPantryDisplayName } from "../lib/pantryDisplay";

describe("getPantryDisplayName", () => {
  it("prefers ingredient over code-like fields", () => {
    const label = getPantryDisplayName({
      ingredient: "bass",
      code: "BAS",
    });
    expect(label).toContain("bass");
    expect(label).not.toContain("BAS");
  });
});
