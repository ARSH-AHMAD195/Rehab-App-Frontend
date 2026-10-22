# Fit for Surgery — Frontend

React 18 + TypeScript + Vite + Tailwind PWA for the Fit for Surgery prehabilitation platform (patients, doctors, admins).

## Quick start

```bash
npm install
cp .env.example .env      # then pick one of the modes below
npm run dev               # http://localhost:5173
```

| Mode | `.env` | Needs backend? |
| --- | --- | --- |
| **Mock API** (frontend-only work) | `VITE_USE_MOCK=true` | No. Data lives in your browser's localStorage. Sign in as `patient.john@example.com`, `doctor.jenkins@fitforsurgery.org` or `admin@fitforsurgery.org` with `Password123!`. Clear the `ffs_mock_db_v1` key to reset the demo data. |
| **Real API** | `VITE_USE_MOCK=false` | Yes. Run `../backend` on port 5000; Vite proxies `/api` to it (`VITE_PROXY_TARGET`). |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR and the `/api` proxy |
| `npm run typecheck` / `lint` | `tsc` (strict) / ESLint |
| `npm test` | Vitest: API client, helpers, service layer and UI flows (jsdom, mock API) |
| `npm run e2e` | Playwright on a production build (mock API): user flows on desktop and phone, axe WCAG 2.1 AA scans of every page, PWA install/offline checks. Run `npx playwright install chromium` once first. |
| `npm run e2e:real` | Contract smoke test against a real deployment. See `playwright.real.config.ts`; use a **staging** database. |
| `npm run build` | Type-check plus production build into `dist/`. `.env.production` forces `VITE_USE_MOCK=false`, so mock code is never bundled. |
| `npm run icons` | Regenerates the PWA icons in `public/` |
| `npm run check` | Everything above (except `e2e:real`). Run before merging. |

## Architecture

```
src/
  types/api.ts           response types (from backend/models + controllers)
  services/              fetch client (cookie auth, ApiError with fieldErrors, timeouts) + one-line endpoint wrappers
  lib/queryClient.ts     TanStack Query: caching, retries (network/5xx only), query keys
  lib/forms.ts           inline validation: browser constraint rules + server field errors next to each field
  lib/trends.ts          chart rows grouped by the user's *local* day
  lib/monitoring.ts      opt-in Sentry with health-data scrubbing
  components/ui/         Button, Field, Modal (focus-trapped), Alert, toasts…
  components/…           feature components, IdleLogout, UnsavedChangesGuard, PWA prompts
  pages/                 one lazy-loaded route chunk per page (React Router data router)
  mocks/                 in-browser port of the backend (dev/demo/tests only, plain JS)
```

## Privacy & security behaviour

- **Auth** uses the backend's httpOnly cookie only. No token is ever readable by JavaScript or stored client-side.
- **Sign-out clears all cached data** (`queryClient.clear()`), so nothing from one user is visible to the next person on a shared device.
- **Idle sign-out** after `VITE_IDLE_TIMEOUT_MINUTES` (default 15), with a 60-second warning. Activity is shared across tabs.
- **The service worker caches the app shell only.** API responses are never cached, so no health data persists on the device. Offline, the app opens and explains that a connection is needed to load or save data.
- **Error reports** (when `VITE_SENTRY_DSN` is set) exclude request bodies, form input, console output and record ids.

## PWA

Installable on Android, iOS (Share → Add to Home Screen) and desktop. It has a manifest with maskable icons and shortcuts ("Log vitals", "My exercises"). New versions are offered with an **Update now** prompt rather than auto-reloading, so a half-filled form is never lost.

## Deploying

1. **History fallback:** every unknown path must return `index.html`.
2. **Never cache `sw.js` or `index.html`** (`Cache-Control: no-cache`). Hashed files under `assets/` can be cached immutably.
3. **Same-site API.** The backend sets its cookie `SameSite=Strict` in production. Route `/api` to the backend on the same origin (recommended), or use a sibling subdomain with `VITE_API_BASE_URL` and the backend's `FRONTEND_URL`.
4. **Recommended headers:**
   - `Content-Security-Policy: default-src 'self'; frame-src https://www.youtube-nocookie.com; connect-src 'self' <api origin> <sentry ingest, if used>; img-src 'self' data:; style-src 'self' 'unsafe-inline'`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`

## Known backend gaps (outside this frontend)

- **Password reset can't work in production yet.** `POST /auth/forgot-password` only returns the code outside production and never emails it (`nodemailer` is installed but unused). "Change my password" on the profile page uses this same flow.
- **No change-password endpoint, invite emails, or forced change of temporary passwords.**
- `GET /follow-ups` ignores a `patientId` query and returns all of a doctor's follow-ups. The frontend uses `/follow-ups/patient/:id`.
- `GET /health-measurements/trends` groups by UTC date. The frontend builds trends itself from raw measurements.
- The patient timeline describes prescriptions as `"undefinedx / week"` (it reads fields that don't exist on `ExerciseAssignment`).
