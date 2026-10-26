import { expect, type Page } from '@playwright/test';

export const signIn = async (page: Page, email: string, password: string) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^sign in/i }).click();
  // The free hosting plan can take up to a minute to wake
  await expect(page).not.toHaveURL(/\/login/, { timeout: 90_000 });
};
