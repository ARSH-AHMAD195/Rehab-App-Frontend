import { expect, test, type Page } from '@playwright/test';
import { acceptConsentIfShown, signIn } from '../helpers';

const password = process.env.E2E_PASSWORD ?? '';
const accounts = {
  patient: process.env.E2E_PATIENT_EMAIL,
  doctor: process.env.E2E_DOCTOR_EMAIL,
  admin: process.env.E2E_ADMIN_EMAIL,
};

const PAGES = {
  patient: ['/patient/dashboard', '/patient/exercises', '/patient/health-tracker', '/patient/report', '/patient/profile'],
  doctor: ['/doctor/dashboard', '/doctor/patients', '/doctor/exercises'],
  admin: ['/admin/dashboard', '/admin/doctors', '/admin/exercises', '/admin/audit-logs'],
} as const;

/** Every page must render its heading and no error state against real API responses. */
const expectPagesLoad = async (page: Page, paths: readonly string[]) => {
  for (const path of paths) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 }), path).toBeVisible();
    await expect(page.getByText(/couldn’t load|something went wrong/i), path).toHaveCount(0);
  }
};

for (const role of ['patient', 'doctor', 'admin'] as const) {
  test(`${role}: session is cookie-only and every page loads`, async ({ page, context }) => {
    test.skip(!accounts[role] || !password, `Set E2E_${role.toUpperCase()}_EMAIL and E2E_PASSWORD`);

    await signIn(page, accounts[role]!, password);
    if (role === 'patient') await acceptConsentIfShown(page);

    // The JWT must live only in an httpOnly cookie, never in script-readable storage
    const token = (await context.cookies()).find((c) => c.name === 'token');
    expect(token?.httpOnly).toBe(true);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(stored).not.toMatch(/eyJ[\w-]+\.[\w-]+\./); // no JWT-shaped values

    await expectPagesLoad(page, PAGES[role]);
  });
}

test('doctor: a patient chart only lists that patient’s follow-ups', async ({ page }) => {
  test.skip(!accounts.doctor || !password, 'Set E2E_DOCTOR_EMAIL and E2E_PASSWORD');
  await signIn(page, accounts.doctor!, password);
  await page.goto('/doctor/patients');
  const firstChart = page.getByRole('link', { name: /chart for/i }).first();
  test.skip((await firstChart.count()) === 0, 'Doctor has no patients');

  const [response] = await Promise.all([
    page.waitForResponse((r) => /\/follow-ups\/patient\/[^/]+$/.test(new URL(r.url()).pathname)),
    firstChart.click(),
  ]);
  const patientId = new URL(response.url()).pathname.split('/').pop();
  const { followUps } = (await response.json()) as { followUps: { patient: string | { _id: string } }[] };
  for (const f of followUps) {
    expect(typeof f.patient === 'string' ? f.patient : f.patient._id).toBe(patientId);
  }
});
