import { expect, test } from '@playwright/test';

test('serves a valid, installable web app manifest', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();

  const manifest = await (await request.get(`/${href!.replace(/^\//, '')}`)).json();
  expect(manifest).toMatchObject({ display: 'standalone', start_url: '/', short_name: expect.any(String) });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true);

  for (const icon of manifest.icons as { src: string }[]) {
    const res = await request.get(`/${icon.src}`);
    expect(res.status(), icon.src).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  }
  expect((await request.get('/apple-touch-icon.png')).status()).toBe(200);
});

test('installs a service worker and opens offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Reload once so the page is controlled by the now-active worker
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/you’re offline/i)).toBeVisible();

  // Deep links fall back to the cached app shell too
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /^sign in$/i })).toBeVisible();
  await context.setOffline(false);
});

test('never caches API responses in the service worker', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const cachedUrls = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      for (const req of await (await caches.open(name)).keys()) urls.push(req.url);
    }
    return urls;
  });
  expect(cachedUrls.length).toBeGreaterThan(0);
  expect(cachedUrls.filter((u) => u.includes('/api/v1'))).toEqual([]);
});
