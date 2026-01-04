# Recipe Database Design

This document defines how recipes and ingredients are structured
for the Pantry-to-Recipe application.

This is a design and planning document, not an import yet.

---

## Pantry Staples Rule (Locked)

The following ingredients are treated as assumed staples
and do NOT need to exist in the user's pantry for cooking:

- salt
- pepper
- oil
- water

These ingredients may appear in instructions but are not
required ingredients for inventory checks.

---

## Recipe Count (MVP)

Initial seed database will contain 100 recipes distributed as follows:

- American / Southern: 20
- Mexican / Tex-Mex: 20
- Italian / Mediterranean: 20
- East Asian (Chinese / Japanese / Korean): 20
- Family / Quick / Comfort: 20

---

## Recipe Structure (Required Fields)

Each recipe must include:

- name
- cuisine_region
- cuisine_substyle
- attributes (e.g. quick, spicy, kid-friendly)
- servings_default
- prep_minutes
- cook_minutes
- instructions (original, rewritten)
- ingredient list

---

## Ingredient Structure (Per Recipe)

Each ingredient entry must include:

- ingredient_id (from ingredient catalog)
- display_name
- quantity_display
- unit_display
- canonical_quantity
- canonical_unit
- optional (true/false)

Canonical units are required for inventory comparison.

---

## Ingredient Catalog Rules

All ingredients must exist in a centralized catalog with:

- canonical_name (single source of truth)
- display aliases
- category (protein, vegetable, grain, dairy, pantry)
- measurement type (weight, volume, each)

Ingredient names must be reused consistently across recipes.

---

## Cooking Eligibility Logic

A recipe is considered:

- Cook Now: 0 missing required ingredients
- Almost There: <= threshold missing required ingredients
- Unavailable: exceeds threshold or missing core ingredients

Staples are ignored for eligibility checks.

---

## Legal & Content Rules

- No copyrighted text copied verbatim
- Instructions must be original or rewritten
- Recipes should be common-knowledge dishes
- Focus on realistic, everyday cooking

---

## Seeding Strategy

Recipes will be added in controlled batches by cuisine group.
Each batch will be reviewed before proceeding to the next.
