import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against a *production build* (so the service worker, offline mode and
// code-splitting are real) served by `vite preview`. These tests need no backend.
// For a contract run against a real backend, see playwright.real.config.ts.
const PORT = 4174;

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['real/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /pwa/ },
  ],
  webServer: {
    command: `npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Always build fresh: reusing a server on this port can silently test a stale build
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
