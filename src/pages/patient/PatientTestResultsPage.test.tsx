import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PatientTestResultsPage } from './PatientTestResultsPage';

const result = (id: string, takenOn: string, values: Record<string, number | string>, extra = {}) => ({
  id, test: 'HB', takenOn, values, wnl: false, comment: null, flags: {}, outOfRange: false, status: 'ACTIVE', ...extra,
});

let grid: unknown[] = [];
vi.mock('../../services/apiServices', () => ({
  clinicalService: {
    getTests: () => Promise.resolve([{ code: 'HB', label: 'Haemoglobin', fields: [{ key: 'value', label: 'Value', kind: 'number', unit: 'g/dL' }] }]),
    getMyInvestigations: () => Promise.resolve(grid),
  },
}));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PatientTestResultsPage />
    </QueryClientProvider>
  );

beforeEach(() => {
  grid = [];
});

describe('patient test results', () => {
  it('groups tests, shows value, unit and date newest first, hides tests without results', async () => {
    grid = [
      { test: 'HB', label: 'Haemoglobin', group: 'HAEMATOLOGY', results: [result('a', '2026-11-10', { value: 9.4 }), result('b', '2026-11-21', { value: 11.2 })] },
      { test: 'NA', label: 'Sodium', group: 'BIOCHEMISTRY', results: [] },
    ];
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Haematology' })).toBeInTheDocument();
    expect(screen.getByText('Haemoglobin')).toBeInTheDocument();
    expect(screen.queryByText('Sodium')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Biochemistry' })).not.toBeInTheDocument();
    const lines = screen.getAllByText(/g\/dL/).map((el) => el.parentElement!.textContent);
    expect(lines).toEqual(['11.2 g/dL · 21 Nov 2026', '9.4 g/dL · 10 Nov 2026']);
  });

  it('shows no out-of-range flag, red styling or doctor comment', async () => {
    grid = [{ test: 'HB', label: 'Haemoglobin', group: 'HAEMATOLOGY', results: [result('a', '2026-11-21', { value: 6 }, { outOfRange: true, flags: { value: 'LOW' }, comment: 'Repeat next week' })] }];
    const { container } = renderPage();
    await screen.findByText('Haemoglobin');
    expect(screen.queryByText(/outside the normal range/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Repeat next week/)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/rose-|red-/);
  });

  it('shows the empty state when there are no results at all', async () => {
    grid = [{ test: 'HB', label: 'Haemoglobin', group: 'HAEMATOLOGY', results: [] }];
    renderPage();
    expect(await screen.findByText('No test results yet. Your doctor adds them after your tests.')).toBeInTheDocument();
  });
});
