import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ACCOUNTS, acceptConsentIfShown, signIn } from './helpers';

// WCAG 2.1 A/AA automated checks on every screen. Automated checks catch roughly a third of
// accessibility issues; keyboard and screen-reader passes are still needed before release.
const scan = async (page: Page) => {
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join('\n  ')}`);
  expect(summary, summary.join('\n\n')).toEqual([]);
};

test.describe('accessibility', () => {
  // Several full-page axe scans per test
  test.describe.configure({ timeout: 180_000 });

  test('public pages', async ({ page }) => {
    for (const path of ['/', '/login', '/forgot-password']) {
      await page.goto(path);
      await scan(page);
    }
  });

  test('patient pages', async ({ page }) => {
    await signIn(page, ACCOUNTS.patient);
    await acceptConsentIfShown(page);
    for (const path of ['/patient/dashboard', '/patient/exercises', '/patient/health-tracker', '/patient/report', '/patient/profile']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await scan(page);
    }
  });

  test('doctor pages', async ({ page }) => {
    await signIn(page, ACCOUNTS.doctor);
    for (const path of ['/doctor/dashboard', '/doctor/patients', '/doctor/onboard-patient', '/doctor/exercises']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await scan(page);
    }
    await page.goto('/doctor/patients');
    await page.getByRole('link', { name: /chart for john davis/i }).click();
    await expect(page.getByRole('heading', { name: 'John Davis' })).toBeVisible();
    await scan(page);
  });

  test('admin pages', async ({ page }) => {
    await signIn(page, ACCOUNTS.admin);
    for (const path of ['/admin/dashboard', '/admin/doctors', '/admin/exercises', '/admin/audit-logs']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await scan(page);
    }
  });

  test('dialogs', async ({ page }) => {
    await signIn(page, ACCOUNTS.patientNoConsent);
    await expect(page.getByRole('dialog', { name: /informed consent/i })).toBeVisible();
    await scan(page);
  });
});
