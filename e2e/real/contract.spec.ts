import { expect, test, type Page } from '@playwright/test';
import { signIn } from '../helpers';

// Read-only smoke test against the live APIs with the shared demo logins. Run with:
//   E2E_PASSWORD=... npm run e2e:real        (dev server on localhost:5173, the APIs' allowed origin)
// It only opens pages, never saves, so the demo data is left as it is.
const password = process.env.E2E_PASSWORD ?? '';
const accounts = {
  patient: process.env.E2E_PATIENT_EMAIL ?? 'patient.rajesh@ffs-health.test',
  doctor: process.env.E2E_DOCTOR_EMAIL ?? 'doctor.meera@ffs-health.test',
  admin: process.env.E2E_ADMIN_EMAIL ?? 'admin@ffs-health.test',
};

const PAGES = {
  patient: ['/patient/dashboard', '/patient/exercises', '/patient/health-tracker', '/patient/profile'],
  doctor: ['/doctor/dashboard', '/doctor/patients', '/doctor/exercises', '/doctor/onboard-patient'],
  admin: ['/admin/dashboard', '/admin/doctors', '/admin/exercises'],
} as const;

const ERROR_TEXT = /couldn’t load|could not be loaded|something went wrong|unavailable/i;

/** Every page must render its heading and no error state against real API responses. */
const expectPagesLoad = async (page: Page, paths: readonly string[]) => {
  for (const path of paths) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }), path).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/loading/i).first(), path).toBeHidden({ timeout: 60_000 });
    // A render crash can land after the last request finishes, so look only once everything has settled
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(ERROR_TEXT), path).toHaveCount(0);
  }
};

test.describe.configure({ timeout: 240_000 });

for (const role of ['patient', 'doctor', 'admin'] as const) {
  test(`${role}: signs in and every page loads`, async ({ page }) => {
    test.skip(!password, 'Set E2E_PASSWORD');
    await signIn(page, accounts[role], password);
    await expectPagesLoad(page, PAGES[role]);
  });
}

test('patient: the vitals form renders whichever request finishes first', async ({ page }) => {
  test.skip(!password, 'Set E2E_PASSWORD');
  await signIn(page, accounts.patient, password);
  // Hold back the vital types so today's log arrives first (this order once crashed the form)
  await page.route('**/vital-types', async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });
  await page.goto('/patient/health-tracker');
  await expect(page.getByLabel('Top number')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(ERROR_TEXT)).toHaveCount(0);
});

test('doctor: a patient chart loads every tab', async ({ page }) => {
  test.skip(!password, 'Set E2E_PASSWORD');
  await signIn(page, accounts.doctor, password);
  await page.goto('/doctor/patients');
  const firstChart = page.getByRole('link', { name: /chart for/i }).first();
  await expect(firstChart).toBeVisible({ timeout: 60_000 });
  await firstChart.click();
  for (const tab of ['Overview', 'Vitals', 'Exercises', 'Alerts']) {
    await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
    await expect(page.getByText(/loading/i).first(), tab).toBeHidden({ timeout: 60_000 });
    await expect(page.getByText(ERROR_TEXT), tab).toHaveCount(0);
  }

  // Editing medical details starts from what's saved, not a blank or example-filled form
  await page.getByRole('tab', { name: /^Overview/ }).click();
  const saved = (await page.locator('dt', { hasText: 'Planned surgery' }).locator('xpath=following-sibling::dd').innerText()).trim();
  await page.getByRole('button', { name: /^Edit$/ }).click();
  const dialog = page.getByRole('dialog', { name: /edit medical details/i });
  const field = dialog.locator('input[name="plannedSurgery"]');
  await expect(field).toBeVisible({ timeout: 60_000 });
  await expect(field).toHaveValue(saved === '—' ? '' : saved);
  await expect(field).not.toHaveAttribute('placeholder');
  await dialog.getByRole('button', { name: /^cancel$/i }).click();
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('skips the landing page and uses a bottom navbar, not a hamburger', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);

    test.skip(!password, 'Set E2E_PASSWORD');
    await signIn(page, accounts.doctor, password);
    await expect(page.getByRole('button', { name: /open navigation/i })).toHaveCount(0);
    const nav = page.getByRole('navigation', { name: 'Main' }).locator('visible=true');
    await expect(nav.getByRole('link', { name: 'Patients' })).toBeVisible();
    await nav.getByRole('link', { name: 'Patients' }).click();
    await expect(page).toHaveURL(/\/doctor\/patients/);
  });
});
