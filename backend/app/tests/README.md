Automated tests for core system behavior.

This folder will contain tests that ensure the backend
remains correct and safe as the project grows.

Primary testing goals:
- Inventory never goes negative
- Cook operations are atomic (all-or-nothing)
- Audit logs are always written for inventory changes
- Cooking is blocked when inventory is insufficient
