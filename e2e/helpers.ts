import { expect, type Page } from '@playwright/test';

export const ACCOUNTS = {
  patient: 'patient.john@example.com',
  patientNoConsent: 'patient.margaret@example.com',
  doctor: 'doctor.jenkins@fitforsurgery.org',
  admin: 'admin@fitforsurgery.org',
} as const;

export const signIn = async (page: Page, email: string, password = 'Password123!') => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
};

/** Signs out through the UI; on small screens "Sign out" lives in the navigation menu. */
export const signOut = async (page: Page) => {
  const menu = page.getByRole('button', { name: 'Open navigation' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: /sign out/i }).locator('visible=true').first().click();
  await expect(page).toHaveURL(/\/login/);
};

/** Accepts the mandatory consent dialog if the patient hasn't consented yet. */
export const acceptConsentIfShown = async (page: Page) => {
  const dialog = page.getByRole('dialog', { name: /informed consent/i });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole('button', { name: /select all/i }).click();
    await dialog.getByRole('button', { name: /acknowledge/i }).click();
    await expect(dialog).toBeHidden();
  }
};
