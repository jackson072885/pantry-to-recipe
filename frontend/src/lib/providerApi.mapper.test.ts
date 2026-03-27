import { describe, expect, it } from "vitest";

import { mapPantryToSupplyItems } from "./providerApi";

describe("mapPantryToSupplyItems", () => {
  it("normalizes basic ingredient casing and spacing", () => {
    expect(mapPantryToSupplyItems([{ ingredient: "  Chicken Breast  " }])).toEqual(["chicken breast"]);
  });

  it("strips parenthetical qualifiers", () => {
    expect(mapPantryToSupplyItems([{ ingredient: "Onion (yellow)" }])).toEqual(["onion"]);
  });

  it("strips bracket qualifiers", () => {
    expect(mapPantryToSupplyItems([{ ingredient: "Tomato [roma]" }])).toEqual(["tomato"]);
  });

  it("removes numeric and unit tokens when prefixed", () => {
    expect(mapPantryToSupplyItems([{ ingredient: "2 lbs chicken" }])).toEqual(["chicken"]);
  });

  it("removes numeric and unit tokens when suffixed", () => {
    expect(mapPantryToSupplyItems([{ ingredient: "chicken 2 lb" }])).toEqual(["chicken"]);
  });

  it("applies alias collapsing", () => {
    expect(mapPantryToSupplyItems([{ ingredient: "hamburger meat" }, { ingredient: "macaroni" }])).toEqual([
      "ground beef",
      "pasta",
    ]);
  });

  it("applies safe singularization", () => {
    expect(mapPantryToSupplyItems([{ ingredient: "eggs" }])).toEqual(["egg"]);
  });

  it("filters junk values", () => {
    expect(mapPantryToSupplyItems([{ ingredient: "" }, { ingredient: "unknown" }, { ingredient: "none" }])).toEqual([]);
  });

  it("keeps n/a as normalized token with current mapper rules", () => {
    expect(mapPantryToSupplyItems([{ ingredient: "n/a" }])).toEqual(["n a"]);
  });

  it("deduplicates and returns alphabetical ordering", () => {
    expect(mapPantryToSupplyItems([{ ingredient: "Rice" }, { ingredient: "rice" }, { ingredient: "Onion" }])).toEqual([
      "onion",
      "rice",
    ]);
  });

  it("falls back to name when ingredient is missing", () => {
    expect(mapPantryToSupplyItems([{ name: "Scallions" }])).toEqual(["green onion"]);
  });
});
