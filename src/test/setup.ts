import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { queryClient } from '../lib/queryClient';

// Recharts' ResponsiveContainer needs this; jsdom doesn't implement it.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// React Router's <ScrollRestoration> scrolls on navigation; jsdom doesn't implement it.
window.scrollTo = () => {};

beforeEach(() => {
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});
