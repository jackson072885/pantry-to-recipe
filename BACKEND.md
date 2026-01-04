# Backend Architecture

## Inventory as Source of Truth
- Pantry inventory determines what can be cooked
- Recipes are filtered against pantry contents at all times

## Canonical Units
All quantities are normalized for comparison:
- Volume → milliliters (ml)
- Weight → grams (g)
- Count → each (ea)

## Cooking a Recipe
When a recipe is cooked:
1. Load recipe ingredients
2. Normalize quantities
3. Verify pantry sufficiency
4. Deduct inventory atomically
5. Write audit log entries
6. Record cook event
7. Commit or rollback entirely

## Audit Log (Required)
- Every inventory change must be logged in pantry_item_transactions
- No silent modifications
- No negative inventory allowed
