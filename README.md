# Fit for Surgery — Frontend

React 18 + TypeScript + Vite + Tailwind PWA for the Fit for Surgery prehabilitation platform (patients, doctors, admins).

## Quick start

```bash
npm install
cp .env.example .env      # fill in the Firebase web config
npm run dev               # http://localhost:5173
```

The app talks straight to the three live APIs (see `.env.example`) and signs in with Firebase (`rehab-app-development` project). Ask the backend team for the shared demo logins. The APIs only accept browser calls from origins on their CORS list: `npm run dev` (port 5173), `npm run preview` (port 4173) and the deployed site.

## Backend

| API | Base URL | Owns |
| --- | --- | --- |
| Auth | `VITE_AUTH_API_URL` | Users, doctors, patients, profiles, medical profiles, invitations |
| Health Monitoring | `VITE_HEALTH_API_URL` | Vital types, daily vitals, trends, alerts, thresholds, investigations, triage, caseload |
| Exercise | `VITE_EXERCISE_API_URL` | Categories, library, plans, daily checklist, completions, compliance |

Source and docs: `ARSH-AHMAD195/Rehab-App-Backend`. `src/services/api.ts` (`apiBaseFor`) decides which API serves each path. `src/services/apiServices.ts` has one function per endpoint.

- **Auth**: Firebase signs the user in. Every request carries `Authorization: Bearer <Firebase ID token>`, and the APIs work out the user and role from it. New accounts get a Firebase email to set their password; "Forgot password?" sends the same kind of email.
- **Errors** are `{ statusCode, code, message, requestId, details? }`. `ApiError` exposes `code` (branch on this) and `fieldErrors` (from `details`), which forms show next to each field.
- **The free hosting plan sleeps.** The first request after 15 idle minutes can take up to a minute, so the client timeout is 70s.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR on port 5173 |
| `npm run preview` | Serves the production build on port 4173, also allowed by the APIs |
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
- **Idle sign-out** after `VITE_IDLE_TIMEOUT_MINUTES` (default 15), with a 60-second warning. Activity is shared across tabs, and a session left idle with the tab closed ends when the app is next opened.
- **The service worker caches the app shell only.** API responses are never cached.
- **Error reports** (when `VITE_SENTRY_DSN` is set) exclude request bodies, form input, console output and record ids.

## Deploying

`vercel.json` sets the history fallback, caching and security headers. Hosting anywhere else needs the same. If you turn on Sentry, add its ingest address to `connect-src`.

**CORS:** the backend only accepts browser calls from origins on its list (the production site and localhost), so a Vercel preview loads but can't sign in. To test a preview, add its exact URL to `CORS_ORIGINS` on Render, along with the origins already allowed, because setting it replaces the defaults. Don't use a wildcard: anyone can register a Vercel project with a matching name.

**Deploy order:** backend first. The new medical fields are refused by an older API, while the investigations and triage screens show nothing or an error message until the API has them.

## Not in the backend yet

The old backend had these features and the new APIs don't, so they're out of the UI for now: notifications, consent records, follow-ups, clinical notes, progress reports and CSV export, the patient activity timeline, admin analytics and audit-log viewing.

Still worked out in the frontend until the backend has them: missed-exercise alerts (from compliance counts) and the 80% "following the routine" threshold (`src/lib/compliance.ts`).

Endpoints that have a service function but no screen yet: add an admin, assign doctors to a patient, alert thresholds and vital-type settings, exercise categories, plan version history, and editing a patient's account details.
