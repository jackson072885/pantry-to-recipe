# Product & UX Design

## Core Principle
The app never shows recipes the user cannot realistically cook
based on their current pantry inventory.

## Cuisine Rules
- Cuisine is a single-select context
- Selecting a cuisine (e.g., Japanese) limits all recipes to that cuisine
- Only substyles belonging to the selected cuisine are available

## Filter System
- Filters stack additively:
  - Cuisine (context)
  - Ingredients
  - Attributes
- All active filters must be satisfied for a recipe to appear
- Filters are never silently removed

## No Results Behavior
- If no recipes match all filters, show no recipes
- Explain why no results are available
- Offer suggestions, but never override user choices

## UI Concept
- Mode selector (Cuisine / Ingredients / Attributes)
- Category tabs change based on mode
- Selectable bubbles for substyles and items
- Selected bubbles use a metallic purple highlight
- Active filters shown as a hierarchical filter tree
- Filters removable via minus icons
