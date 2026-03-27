# Frontend

React + TypeScript + Vite frontend for Pantry-to-Recipe.

## Primary User Flow
- `/` - tonight landing page
- `/pantry` - pantry editor
- `/recommendations` - recommendation groups
- `/recipes/:id` - recipe detail and cook flow

This app shell currently exposes only the core recommendation-centered flow. Provider-oriented pages exist in the repo, but they are not mounted in `src/App.tsx`.

## Commands
```powershell
npm install
npm test -- --run
npm run build
npm run dev
```

## Frontend Responsibilities
- Call pantry, recommendation, recipe, cook, and event APIs.
- Render the "Cook This Tonight" CTA.
- Send tracking events for CTA renders/clicks, recipe selection, ingredient requests, and cook confirmation.
- Preserve a small amount of local onboarding/checklist state in browser storage.
