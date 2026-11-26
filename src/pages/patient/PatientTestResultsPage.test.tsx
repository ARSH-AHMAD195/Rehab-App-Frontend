import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setLang } from '../../lib/i18n';
import { formatDateTime } from '../../lib/format';
import { PatientTestResultsPage } from './PatientTestResultsPage';

const result = (id: string, takenOn: string, values: Record<string, number | string>, extra = {}) => ({
  id, test: 'HB', takenOn, values, wnl: false, comment: null, flags: {}, outOfRange: false, status: 'ACTIVE', ...extra,
});

let grid: unknown[] = [];
let medical: () => Promise<unknown> = () => Promise.resolve({ patientAdvice: null });
let history: () => Promise<unknown> = () => Promise.resolve({ items: [] });
const { getMedical, getHistory } = vi.hoisted(() => ({ getMedical: vi.fn(), getHistory: vi.fn() }));
const flags = vi.hoisted(() => ({ history: false }));
vi.mock('../../lib/features', () => ({
  get ADVICE_HISTORY() {
    return flags.history;
  },
}));
vi.mock('../../services/apiServices', () => ({
  clinicalService: {
    getTests: () => Promise.resolve([{ code: 'HB', label: 'Haemoglobin', fields: [{ key: 'value', label: 'Value', kind: 'number', unit: 'g/dL' }] }]),
    getMyInvestigations: () => Promise.resolve(grid),
  },
  profileService: { getMyMedical: () => getMedical(), getMyAdviceHistory: () => getHistory() },
}));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PatientTestResultsPage />
    </QueryClientProvider>
  );

beforeEach(() => {
  grid = [];
  flags.history = false;
  medical = () => Promise.resolve({ patientAdvice: null });
  getMedical.mockReset();
  getMedical.mockImplementation(() => medical());
  history = () => Promise.resolve({ items: [] });
  getHistory.mockReset();
  getHistory.mockImplementation(() => history());
  setLang('en');
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

  it('shows the group title in Hindi when Hindi is chosen', async () => {
    grid = [{ test: 'HB', label: 'Haemoglobin', group: 'HAEMATOLOGY', results: [result('a', '2026-11-21', { value: 11 })] }];
    setLang('hi');
    renderPage();
    expect(await screen.findByRole('heading', { name: 'रक्त की जाँच' })).toBeInTheDocument();
  });
});

describe('advice from the doctor', () => {
  const withResult = () => {
    grid = [{ test: 'HB', label: 'Haemoglobin', group: 'HAEMATOLOGY', results: [result('a', '2026-11-21', { value: 11 })] }];
  };

  it('shows the advice card at the top', async () => {
    withResult();
    medical = () => Promise.resolve({ patientAdvice: 'Stop aspirin 5 days before surgery.' });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Advice from your doctor' })).toBeInTheDocument();
    expect(screen.getByText('Stop aspirin 5 days before surgery.')).toBeInTheDocument();
  });

  it('shows advice as literal text, never as HTML', async () => {
    withResult();
    medical = () => Promise.resolve({ patientAdvice: '<b>x</b>' });
    const { container } = renderPage();
    expect(await screen.findByText('<b>x</b>')).toBeInTheDocument();
    expect(container.querySelector('b')).toBeNull();
  });

  it('shows the advice heading in Hindi when Hindi is chosen', async () => {
    withResult();
    medical = () => Promise.resolve({ patientAdvice: 'Stop aspirin' });
    setLang('hi');
    renderPage();
    expect(await screen.findByRole('heading', { name: 'आपके डॉक्टर की सलाह' })).toBeInTheDocument();
  });

  it('shows nothing when the advice is empty', async () => {
    withResult();
    medical = () => Promise.resolve({ patientAdvice: '  ' });
    renderPage();
    await screen.findByText('Haemoglobin');
    expect(screen.queryByRole('heading', { name: 'Advice from your doctor' })).not.toBeInTheDocument();
  });

  it('still renders the results when the medical profile fails to load', async () => {
    withResult();
    medical = () => Promise.reject(new Error('boom'));
    renderPage();
    expect(await screen.findByText('Haemoglobin')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Advice from your doctor' })).not.toBeInTheDocument();
  });
});

describe('earlier advice', () => {
  const withResult = () => {
    grid = [{ test: 'HB', label: 'Haemoglobin', group: 'HAEMATOLOGY', results: [result('a', '2026-11-21', { value: 11 })] }];
  };
  const items = [
    { advice: ' Stop aspirin ', at: '2026-11-21T09:30:00Z', by: { name: 'Dr Nair' } },
    { advice: 'Take your inhaler', at: '2026-11-19T08:00:00Z', by: null },
    { advice: null, at: '2026-11-18T08:00:00Z', by: null },
  ];

  it('is never requested when the flag is off', async () => {
    withResult();
    renderPage();
    await screen.findByText('Haemoglobin');
    expect(getHistory).not.toHaveBeenCalled();
  });

  it('shows past saves newest first with dates, and Cleared for a cleared save', async () => {
    flags.history = true;
    withResult();
    history = () => Promise.resolve({ items: items.slice(1) });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Earlier advice' })).toBeInTheDocument();
    const list = within(screen.getByRole('heading', { name: 'Earlier advice' }).closest('section')!).getAllByRole('listitem');
    expect(list[0]).toHaveTextContent(`${formatDateTime('2026-11-19T08:00:00Z')}`);
    expect(list[0]).toHaveTextContent('Take your inhaler');
    expect(list[1]).toHaveTextContent('Cleared');
  });

  it('does not repeat the current advice when it equals the newest save', async () => {
    flags.history = true;
    withResult();
    medical = () => Promise.resolve({ patientAdvice: 'Stop aspirin' });
    history = () => Promise.resolve({ items });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Earlier advice' })).toBeInTheDocument();
    expect(screen.getAllByText('Stop aspirin')).toHaveLength(1);
    expect(screen.getByText('Take your inhaler')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').filter((li) => li.textContent?.includes('Cleared'))).toHaveLength(1);
  });

  it('shows the earlier advice when there is no current advice', async () => {
    flags.history = true;
    withResult();
    history = () => Promise.resolve({ items: items.slice(0, 1) });
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Earlier advice' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Advice from your doctor' })).not.toBeInTheDocument();
  });

  it('shows nothing extra when the history fails, and the results still show', async () => {
    flags.history = true;
    withResult();
    history = () => Promise.reject(new Error('boom'));
    renderPage();
    expect(await screen.findByText('Haemoglobin')).toBeInTheDocument();
    await vi.waitFor(() => expect(getHistory).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Earlier advice' })).not.toBeInTheDocument();
  });
});

