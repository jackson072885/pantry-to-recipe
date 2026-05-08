# Phase Zero private demo deployment checklist

This checklist is for a private 5-10 tester web demo. It intentionally skips public-launch work such as auth, PWA install flows, analytics hardening, and tester isolation beyond the current pantry session behavior.

## Frontend

- Build with `VITE_API_BASE_URL` set to the hosted backend origin, with no trailing path:
  - Example: `VITE_API_BASE_URL=https://pantry-api.example.com`
- Keep `VITE_API_BASE_URL` unset for local development. The Vite dev server will continue to send `/api/*` through the local proxy to `http://127.0.0.1:8000`.
- After deployment, open the hosted frontend and verify that the Network tab sends API requests to the hosted backend origin.

## Backend

- Set `CORS_ALLOWED_ORIGINS` to the hosted frontend origin:
  - Example: `CORS_ALLOWED_ORIGINS=https://pantry-demo.example.com`
- Use a comma-separated list if more than one private preview origin is needed.
- Local development origins are always allowed:
  - `http://127.0.0.1:5173`
  - `http://localhost:5173`
- Keep `DATABASE_URL` pointed at the production database or runtime volume for the hosted backend.

## Smoke test

1. Start the hosted backend and check `GET /` returns a successful envelope with `status: running`.
2. Open the hosted frontend.
3. Add a few pantry items through the private tester flow.
4. Confirm the Home recommendation request succeeds and shows a best dinner option or an honest no-strong-match state.
5. Open one recipe detail page from the recommendations.

## Remaining private-demo risks

- No public auth gate is included in this pass.
- Separate testers can still share backend state if the hosting layer or browser session handling is not isolated enough for the demo format.
- Live hosting, TLS, database persistence, and provider-specific environment configuration must be verified on the chosen platform.
