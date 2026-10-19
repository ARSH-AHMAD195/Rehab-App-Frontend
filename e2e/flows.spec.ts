import { expect, test } from '@playwright/test';
import { ACCOUNTS, acceptConsentIfShown, signIn, signOut } from './helpers';

test('patient logs a session and a vital from the dashboard', async ({ page }) => {
  await signIn(page, ACCOUNTS.patient);
  await acceptConsentIfShown(page);

  await page.getByRole('button', { name: /mark done/i }).first().click();
  const sessionDialog = page.getByRole('dialog', { name: /how hard did it feel/i });
  await sessionDialog.getByRole('button', { name: /^moderate/i }).click();
  await expect(sessionDialog).toBeHidden();
  await expect(page.getByText(/well done!/i)).toBeVisible();

  await page.getByRole('button', { name: /log vitals/i }).click();
  const vitals = page.getByRole('dialog', { name: /log a reading/i });
  await vitals.getByText('Pulse', { exact: true }).click();
  await vitals.getByLabel(/pulse \(heart rate\)/i).fill('68');
  await vitals.getByRole('button', { name: /^save$/i }).click();
  await expect(vitals).toBeHidden();
  await expect(page.getByText(/saved to your health record/i)).toBeVisible();
});

test('doctor prescribes an exercise and the patient sees it', async ({ page }) => {
  await signIn(page, ACCOUNTS.doctor);
  await page.goto('/doctor/patients');
  await page.getByRole('link', { name: /chart for john davis/i }).click();

  await page.getByRole('button', { name: /prescribe exercise/i }).click();
  const dialog = page.getByRole('dialog', { name: /prescribe exercise/i });
  await dialog.getByRole('combobox', { name: /^exercise/i }).selectOption({ label: 'Upper Body Wall Push-Ups (Strength)' });
  await dialog.getByRole('button', { name: /confirm prescription/i }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('tab', { name: /exercises/i }).click();
  await expect(page).toHaveURL(/tab=exercises/);
  await expect(page.getByRole('tabpanel').getByText('Upper Body Wall Push-Ups')).toBeVisible();

  await signOut(page);
  await signIn(page, ACCOUNTS.patient);
  await acceptConsentIfShown(page);
  await expect(page.getByRole('heading', { name: 'Upper Body Wall Push-Ups' })).toBeVisible();
});

test('pages fit the screen without horizontal scrolling', async ({ page }) => {
  await signIn(page, ACCOUNTS.patient);
  await acceptConsentIfShown(page);
  for (const path of ['/patient/dashboard', '/patient/health-tracker', '/patient/report', '/patient/profile']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});
