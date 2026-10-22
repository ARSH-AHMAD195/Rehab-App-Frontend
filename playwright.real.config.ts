import { defineConfig, devices } from '@playwright/test';

// Contract smoke test against a REAL deployment (frontend + backend), e.g. staging.
//   E2E_BASE_URL=https://staging.example.com \
//   E2E_PATIENT_EMAIL=... E2E_DOCTOR_EMAIL=... E2E_ADMIN_EMAIL=... E2E_PASSWORD=... \
//   npm run e2e:real
// It signs in and opens pages (which writes audit-log entries), so point it at a
// staging/test database, never production patient data. It never runs the backend seeder.
export default defineConfig({
  testDir: './e2e/real',
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
});
