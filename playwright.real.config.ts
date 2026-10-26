import { defineConfig, devices } from '@playwright/test';

// Read-only smoke test against the live APIs. Start `npm run dev` (port 5173 is on the APIs'
// CORS list), then:  E2E_PASSWORD=<shared demo password> npm run e2e:real
// Defaults to the demo logins; override with E2E_PATIENT_EMAIL / E2E_DOCTOR_EMAIL / E2E_ADMIN_EMAIL.
// It only opens pages (which writes "viewed" audit entries) and never saves anything.
export default defineConfig({
  testDir: './e2e/real',
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
});
