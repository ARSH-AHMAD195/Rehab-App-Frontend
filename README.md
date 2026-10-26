# Fit for Surgery — Frontend

React 18 + TypeScript + Vite + Tailwind PWA for the Fit for Surgery prehabilitation platform (patients, doctors, admins).

## Quick start

```bash
npm install
cp .env.example .env      # fill in the Firebase web config
npm run dev               # http://localhost:5173
```

The app talks straight to the three live APIs (see `.env.example`) and signs in with Firebase (`rehab-app-development` project). Ask the backend team for the shared demo logins. **Run the dev server on port 5173**: the APIs only accept browser calls from origins on their CORS list.

## Backend

| API | Base URL | Owns |
| --- | --- | --- |
| Auth | `VITE_AUTH_API_URL` | Users, doctors, patients, profiles, medical profiles, invitations |
| Health Monitoring | `VITE_HEALTH_API_URL` | Vital types, daily vitals, trends, alerts, thresholds |
| Exercise | `VITE_EXERCISE_API_URL` | Categories, library, plans, daily checklist, completions, compliance |

Source and docs: `ARSH-AHMAD195/Rehab-App-Backend`. `src/services/api.ts` (`apiBaseFor`) decides which API serves each path. `src/services/apiServices.ts` has one function per endpoint.

- **Auth**: Firebase signs the user in. Every request carries `Authorization: Bearer <Firebase ID token>`, and the APIs work out the user and role from it. New accounts get a Firebase email to set their password; "Forgot password?" sends the same kind of email.
- **Errors** are `{ statusCode, code, message, requestId, details? }`. `ApiError` exposes `code` (branch on this) and `fieldErrors` (from `details`), which forms show next to each field.
- **The free hosting plan sleeps.** The first request after 15 idle minutes can take up to a minute, so the client timeout is 70s.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR on port 5173 |
| `npm run typecheck` / `lint` | `tsc` (strict) / ESLint |
| `npm test` | Vitest: API client routing and errors, format helpers |
| `npm run e2e` | Playwright on a production build: PWA manifest, offline app shell, no API caching |
| `npm run e2e:real` | Read-only smoke test against the live APIs: every page for each role, the patient chart tabs, the phone layout. Start `npm run dev`, then run with `E2E_PASSWORD=<shared demo password>` |
| `npm run build` | Type-check plus production build into `dist/` |
| `npm run icons` | Regenerates the PWA icons in `public/` |

## Architecture

```
src/
  types/api.ts           response types of the three APIs
  services/              fetch client (Bearer token, per-path API routing, ApiError) + one function per endpoint
  lib/queryClient.ts     TanStack Query: caching, retries (network/5xx only), query keys
  lib/forms.ts           inline validation: browser constraint rules + server field errors next to each field
  lib/vitals.ts          vital types and their labels (fetched once per session)
  lib/medical.ts         medical profile <-> form fields
  lib/monitoring.ts      opt-in Sentry with health-data scrubbing
  components/ui/         Button, Field, Modal (focus-trapped), Alert, toasts…
  components/…           feature components, IdleLogout, UnsavedChangesGuard, PWA prompts
  pages/                 one lazy-loaded route chunk per page (React Router data router)
```

## Privacy & security behaviour

- **No secrets in the bundle.** `.env` holds only the Firebase web config and API URLs. Never put passwords, the Atlas address or server keys in the repo.
- **Sign-out clears all cached data** (`queryClient.clear()`), so nothing from one user is visible to the next person on a shared device.
- **Idle sign-out** after `VITE_IDLE_TIMEOUT_MINUTES` (default 15), with a 60-second warning. Activity is shared across tabs.
- **The service worker caches the app shell only.** API responses are never cached.
- **Error reports** (when `VITE_SENTRY_DSN` is set) exclude request bodies, form input, console output and record ids.

## Deploying

1. **History fallback:** every unknown path must return `index.html`.
2. **Never cache `sw.js` or `index.html`** (`Cache-Control: no-cache`). Hashed files under `assets/` can be cached immutably.
3. **CORS:** the backend must add the deployed origin to its allowed list, or every API call is blocked.
4. **Recommended headers:**
   - `Content-Security-Policy: default-src 'self'; frame-src https://www.youtube-nocookie.com https://rehab-app-development.firebaseapp.com; connect-src 'self' https://*.onrender.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com <sentry ingest, if used>; img-src 'self' data:; style-src 'self' 'unsafe-inline'`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`

## Not in the backend yet

The old backend had these features and the new APIs don't, so they're out of the UI for now: notifications, consent records, follow-ups, clinical notes, progress reports and CSV export, the patient activity timeline, admin analytics and audit-log viewing.

Endpoints that have a service function but no screen yet: add an admin, assign doctors to a patient, alert thresholds and vital-type settings, exercise categories, plan version history, and editing a patient's account details.
