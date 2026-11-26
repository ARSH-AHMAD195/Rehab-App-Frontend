import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setLang } from '../../lib/i18n';
import { PatientTestResultsPage } from './PatientTestResultsPage';

const result = (id: string, takenOn: string, values: Record<string, number | string>, extra = {}) => ({
  id, test: 'HB', takenOn, values, wnl: false, comment: null, flags: {}, outOfRange: false, status: 'ACTIVE', ...extra,
});

let grid: unknown[] = [];
let medical: () => Promise<unknown> = () => Promise.resolve({ patientAdvice: null });
const { getMedical } = vi.hoisted(() => ({ getMedical: vi.fn() }));
vi.mock('../../services/apiServices', () => ({
  clinicalService: {
    getTests: () => Promise.resolve([{ code: 'HB', label: 'Haemoglobin', fields: [{ key: 'value', label: 'Value', kind: 'number', unit: 'g/dL' }] }]),
    getMyInvestigations: () => Promise.resolve(grid),
  },
  profileService: { getMyMedical: () => getMedical() },
}));

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PatientTestResultsPage />
    </QueryClientProvider>
  );

beforeEach(() => {
  grid = [];
  medical = () => Promise.resolve({ patientAdvice: null });
  getMedical.mockReset();
  getMedical.mockImplementation(() => medical());
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
