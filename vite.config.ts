/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      VitePWA({
        // Ask before activating a new version, so an update never reloads a half-filled form
        registerType: 'prompt',
        includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'Fit for Surgery – Digital Prehabilitation',
          short_name: 'Fit Surgery',
          description: 'Clinician-supervised exercises and daily health tracking to prepare for surgery.',
          lang: 'en',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'any',
          theme_color: '#0f766e',
          background_color: '#f8fafc',
          categories: ['health', 'medical', 'fitness'],
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          shortcuts: [
            { name: 'Log vitals', url: '/patient/health-tracker', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
            { name: 'My exercises', url: '/patient/exercises', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          ],
        },
        workbox: {
          // App shell only. API responses (patient health data) are never cached by the
          // service worker: nothing clinical persists on a possibly shared device.
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
        },
        devOptions: { enabled: false },
      }),
    ],
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    },
    server: {
      port: 5173,
      host: true,
      strictPort: true,
      // Same-origin /api in dev, so the backend's auth cookie behaves exactly as in production
      proxy: {
        '/api': { target: env.VITE_PROXY_TARGET || 'http://localhost:5000', changeOrigin: true },
      },
    },
    preview: { port: 4173, strictPort: true },
    build: {
      rollupOptions: {
        output: {
          // Long-lived vendor chunks: app deploys don't invalidate cached React/charting code
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
            charts: ['recharts'],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.ts',
      // UI tests render lazily-loaded pages; cold chunk transforms are slow under jsdom
      testTimeout: 40_000,
      include: ['src/**/*.test.{ts,tsx,js}'],
      env: { VITE_USE_MOCK: 'true' },
    },
  };
});
