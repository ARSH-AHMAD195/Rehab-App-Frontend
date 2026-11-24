import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { RouteError } from './RouteError';

vi.mock('../lib/monitoring', () => ({ reportError: vi.fn() }));

const renderChunkError = () => {
  const router = createMemoryRouter([
    {
      path: '/',
      errorElement: <RouteError />,
      loader: () => {
        throw new TypeError('Failed to fetch dynamically imported module: /assets/Page.js');
      },
      element: null,
    },
  ]);
  render(<RouterProvider router={router} />);
};

describe('RouteError on a failed page-chunk load', () => {
  afterEach(() => vi.restoreAllMocks());

  it('says a new version is available when online', async () => {
    renderChunkError();
    expect(await screen.findByText('A new version is available')).toBeInTheDocument();
  });

  it('says the patient is offline, not that there is a new version, when offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderChunkError();
    expect(await screen.findByText('You’re offline')).toBeInTheDocument();
  });
});
