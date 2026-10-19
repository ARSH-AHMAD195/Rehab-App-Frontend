// Renders the PWA/app icons in public/ from one heart mark, using Playwright's Chromium
// (avoids a native image dependency). Re-run after changing the logo:
//   node scripts/generate-icons.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));

const HEART =
  'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z';

/** `inset` = fraction of the canvas the heart occupies; `radius` = corner rounding (0 = full bleed). */
const svg = ({ inset, radius }) => {
  const heartSize = 64 * inset;
  const offset = (64 - heartSize) / 2;
  const scale = heartSize / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">
    <defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#115e59"/><stop offset="1" stop-color="#0d9488"/></linearGradient></defs>
    <rect width="64" height="64" rx="${radius}" fill="url(#g)"/>
    <path transform="translate(${offset} ${offset}) scale(${scale})" d="${HEART}" fill="#fff" fill-opacity=".18" stroke="#fff" stroke-width="${2 / (scale / 1.6667)}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
};

const ICONS = [
  { file: 'pwa-192x192.png', size: 192, inset: 0.62, radius: 14 },
  { file: 'pwa-512x512.png', size: 512, inset: 0.62, radius: 14 },
  // Maskable: full-bleed, heart inside the 80% safe zone so any platform mask keeps it whole
  { file: 'maskable-icon-512x512.png', size: 512, inset: 0.5, radius: 0 },
  // iOS applies its own rounded mask
  { file: 'apple-touch-icon.png', size: 180, inset: 0.6, radius: 0 },
  { file: 'favicon-32.png', size: 32, inset: 0.66, radius: 14 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, ...shape } of ICONS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(shape)}</body></html>`);
  await page.screenshot({ path: `${publicDir}${file}`, omitBackground: true });
  console.log(`wrote public/${file}`);
}
await browser.close();
