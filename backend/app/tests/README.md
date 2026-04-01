Automated tests for Pantry-to-Recipe.

Current backend coverage includes:
- pantry inventory routes
- recommendation and recipe routes
- cook flow behavior
- event tracking and behavior-signal persistence
- secondary provider-oriented routes such as insights, plan, supply, unlock, and AI recipe generation

Primary safety goals:
- inventory never goes negative
- cook operations stay atomic
- tracking writes succeed without breaking the user flow
- recommendation and secondary route contracts remain stable during cleanup
