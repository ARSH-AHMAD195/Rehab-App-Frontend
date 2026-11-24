import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { qk, queryClient } from '../../lib/queryClient';
import { ToastProvider } from '../../components/ui/toast';
import { AdminClinicalLimitsPage } from './AdminClinicalLimitsPage';
import { ApiError } from '../../services/api';
import { adminService, clinicalService } from '../../services/apiServices';
import type { AlertThreshold, InvestigationField, InvestigationTest, VitalTypeDef } from '../../types/api';

vi.mock('../../lib/firebase', () => ({ firebaseAuth: { currentUser: null } }));
vi.mock('../../services/apiServices', () => ({
  vitalsService: { getTypes: () => Promise.resolve([]) },
  adminService: { getThresholds: vi.fn(), setThreshold: vi.fn() },
  clinicalService: { getTests: vi.fn(), setRange: vi.fn() },
}));

const types: VitalTypeDef[] = [
  { type: 'PULSE', label: 'Pulse', labelHi: null, unit: 'bpm', valueKind: 'numeric', minValid: 30, maxValid: 220, isOptional: false, onForm: true, version: 1 },
  {
    type: 'BP',
    label: 'Blood pressure',
    labelHi: null,
    unit: 'mmHg',
    valueKind: 'pair',
    fields: { systolic: { minValid: 50, maxValid: 250 }, diastolic: { minValid: 30, maxValid: 150 } },
    isOptional: false,
    onForm: true,
    version: 1,
  },
  { type: 'NUTRITION', label: 'Nutrition', labelHi: null, unit: null, valueKind: 'text', isOptional: true, onForm: false, version: 1 },
];

const hb = { key: 'hb', label: 'Haemoglobin', kind: 'number', unit: 'g/dL', min: 1, max: 25, range: null } as const;
const tests = (range: { low: number | null; high: number | null } | null): InvestigationTest[] => [
  { code: 'CBC', label: 'CBC', group: 'HAEMATOLOGY', fields: [{ ...hb, range }], allowWnl: false, feedsTriage: false },
];

const th = (o: Partial<AlertThreshold>): AlertThreshold => ({ id: 't1', type: 'PULSE', field: null, low: 50, high: 120, severity: 'HIGH', patientId: null, version: 1, effectiveFrom: '2026-11-01T00:00:00Z', updatedBy: 'a', ...o });

const renderPage = () => {
  queryClient.setQueryData(qk.vitalTypes, types);
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AdminClinicalLimitsPage />
      </ToastProvider>
    </QueryClientProvider>
  );
};

const setup = (rows: AlertThreshold[], range: { low: number | null; high: number | null } | null = null) => {
  vi.mocked(adminService.getThresholds).mockResolvedValue({ data: rows, nextCursor: null });
  vi.mocked(clinicalService.getTests).mockResolvedValue(tests(range));
  vi.mocked(adminService.setThreshold).mockResolvedValue(th({}));
  vi.mocked(clinicalService.setRange).mockResolvedValue({});
};

beforeEach(() => queryClient.clear());
afterEach(() => vi.clearAllMocks());

describe('AdminClinicalLimitsPage', () => {
  it('shows Not set for everything when nothing is configured, and skips text vitals', async () => {
    setup([]);
    renderPage();
    await screen.findByRole('button', { name: 'Edit Pulse' });
    expect(screen.getAllByText('Not set')).toHaveLength(4); // pulse, BP systolic, BP diastolic, haemoglobin
    expect(screen.queryByText('Nutrition')).toBeNull();
  });

  it('saves a vital limit', async () => {
    setup([]);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Pulse' }));
    await user.type(screen.getByLabelText('Low'), '50');
    await user.type(screen.getByLabelText('High'), '120');
    await user.selectOptions(screen.getByLabelText('Severity'), 'HIGH');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(adminService.setThreshold).toHaveBeenCalledWith('PULSE', { field: null, low: 50, high: 120, severity: 'HIGH', patientId: null }));
  });

  it('blocks low >= high without calling the API', async () => {
    setup([]);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Pulse' }));
    await user.type(screen.getByLabelText('Low'), '120');
    await user.type(screen.getByLabelText('High'), '50');
    await user.selectOptions(screen.getByLabelText('Severity'), 'LOW');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Low must be less than high.')).toBeTruthy();
    expect(adminService.setThreshold).not.toHaveBeenCalled();
  });

  it('shows systolic and diastolic rows for BP and saves with the field', async () => {
    setup([]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('button', { name: 'Edit Blood pressure (systolic)' });
    await user.click(screen.getByRole('button', { name: 'Edit Blood pressure (diastolic)' }));
    await user.type(screen.getByLabelText('High'), '90');
    await user.selectOptions(screen.getByLabelText('Severity'), 'MEDIUM');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(adminService.setThreshold).toHaveBeenCalledWith('BP', { field: 'diastolic', low: null, high: 90, severity: 'MEDIUM', patientId: null }));
  });

  it('does not show per-patient rows', async () => {
    setup([th({ patientId: 'p9', low: 11, high: 22 })]);
    renderPage();
    await screen.findByRole('button', { name: 'Edit Pulse' });
    const row = screen.getByRole('button', { name: 'Edit Pulse' }).closest('tr')!;
    expect(within(row).getByText('Not set')).toBeTruthy();
    expect(screen.queryByText('22')).toBeNull();
  });

  it('removes an investigation range by sending nulls', async () => {
    setup([], { low: 12, high: 16 });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit CBC: Haemoglobin' }));
    await user.click(screen.getByRole('button', { name: 'Remove range' }));
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(clinicalService.setRange).toHaveBeenCalledWith({ test: 'CBC', field: 'hb', low: null, high: null }));
  });
});

describe('AdminClinicalLimitsPage: saving and removing', () => {
  it('shows an inline error and sends nothing when an investigation range is saved with both limits empty', async () => {
    setup([], { low: 12, high: 16 });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit CBC: Haemoglobin' }));
    await user.clear(screen.getByLabelText('Low'));
    await user.clear(screen.getByLabelText('High'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a low limit, a high limit, or both.')).toBeTruthy();
    expect(clinicalService.setRange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Remove range' })).toBeTruthy();
  });

  it('keeps Remove range from sending anything until the confirmation is accepted', async () => {
    setup([], { low: 12, high: 16 });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit CBC: Haemoglobin' }));
    await user.click(screen.getByRole('button', { name: 'Remove range' }));
    expect(await screen.findByText('Remove this range?')).toBeTruthy();
    expect(clinicalService.setRange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(clinicalService.setRange).toHaveBeenCalledTimes(1));
    expect(clinicalService.setRange).toHaveBeenCalledWith({ test: 'CBC', field: 'hb', low: null, high: null });
  });

  it('shows no Remove range button when the investigation range is not set', async () => {
    setup([], null);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit CBC: Haemoglobin' }));
    expect(screen.queryByRole('button', { name: 'Remove range' })).toBeNull();
  });

  it('shows "Choose a severity." and sends nothing when a vital is saved without a severity', async () => {
    setup([]);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Pulse' }));
    await user.type(screen.getByLabelText('Low'), '50');
    await user.type(screen.getByLabelText('High'), '120');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Choose a severity.')).toBeTruthy();
    expect(adminService.setThreshold).not.toHaveBeenCalled();
  });
});

describe('AdminClinicalLimitsPage: investigation group order', () => {
  const field = (key: string, kind: 'number' | 'choice'): InvestigationField =>
    kind === 'number'
      ? { key, label: `${key} value`, kind: 'number', unit: 'u', min: 0, max: 100, range: null }
      : { key, label: `${key} choice`, kind: 'choice', options: ['A'], range: null };

  it('lists groups in GROUP_TITLES order, not API order, and skips groups with no number fields', async () => {
    vi.mocked(adminService.getThresholds).mockResolvedValue({ data: [], nextCursor: null });
    vi.mocked(clinicalService.getTests).mockResolvedValue([
      { code: 'NUT', label: 'Nutrition score test', group: 'NUTRITION_SCREENING', fields: [field('n', 'number')], allowWnl: false, feedsTriage: false },
      { code: 'CARD', label: 'ECG test', group: 'CARDIAC_RESPIRATORY_IMAGING', fields: [field('c', 'number')], allowWnl: false, feedsTriage: false },
      { code: 'BIOTXT', label: 'Text only test', group: 'BIOCHEMISTRY', fields: [field('t', 'choice')], allowWnl: false, feedsTriage: false },
      { code: 'BIO', label: 'Sodium test', group: 'BIOCHEMISTRY', fields: [field('s', 'number')], allowWnl: false, feedsTriage: false },
      { code: 'HAEM', label: 'Blood count test', group: 'HAEMATOLOGY', fields: [field('h', 'number')], allowWnl: false, feedsTriage: false },
    ]);
    vi.mocked(adminService.setThreshold).mockResolvedValue(th({}));
    renderPage();
    await screen.findByRole('button', { name: 'Edit Blood count test: h value' });

    const titles = ['Haematology', 'Biochemistry', 'Cardiac, respiratory and imaging', 'Nutrition score'];
    const nodes = titles.map((t) => screen.getByText(t));
    for (let i = 0; i < nodes.length - 1; i++) {
      expect(nodes[i]!.compareDocumentPosition(nodes[i + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    // Biochemistry has a number row, so its header shows; the text-only test is not listed
    expect(screen.queryByText('Text only test')).toBeNull();
    expect(screen.queryByText('Text only test: t choice')).toBeNull();
    expect(screen.getByText('Sodium test: s value')).toBeTruthy();
  });

  it('gets no group header row when a group has no number fields', async () => {
    vi.mocked(adminService.getThresholds).mockResolvedValue({ data: [], nextCursor: null });
    vi.mocked(clinicalService.getTests).mockResolvedValue([
      { code: 'HAEM', label: 'Blood count test', group: 'HAEMATOLOGY', fields: [field('h', 'number')], allowWnl: false, feedsTriage: false },
      { code: 'NUT', label: 'Nutrition text', group: 'NUTRITION_SCREENING', fields: [field('t', 'choice')], allowWnl: false, feedsTriage: false },
    ]);
    renderPage();
    await screen.findByRole('button', { name: 'Edit Blood count test: h value' });
    expect(screen.getByText('Haematology')).toBeTruthy();
    expect(screen.queryByText('Nutrition score')).toBeNull();
    expect(screen.queryByText('Nutrition text')).toBeNull();
  });
});

describe('AdminClinicalLimitsPage: threshold paging', () => {
  it('fetches the next page with the returned cursor and shows its global rows', async () => {
    vi.mocked(clinicalService.getTests).mockResolvedValue(tests(null));
    vi.mocked(adminService.getThresholds)
      .mockResolvedValueOnce({ data: [th({ type: 'PULSE', low: 50, high: 120 })], nextCursor: 'c2' })
      .mockResolvedValueOnce({ data: [th({ id: 't2', type: 'BP', field: 'systolic', low: 90, high: 140, severity: 'MEDIUM', patientId: null })], nextCursor: null });
    renderPage();
    const bpRow = (await screen.findByRole('button', { name: 'Edit Blood pressure (systolic)' })).closest('tr')!;
    await waitFor(() => expect(within(bpRow).getByText('140')).toBeTruthy());
    expect(within(bpRow).getByText('90')).toBeTruthy();
    const pulseRow = screen.getByRole('button', { name: 'Edit Pulse' }).closest('tr')!;
    expect(within(pulseRow).getByText('120')).toBeTruthy();
    expect(adminService.getThresholds).toHaveBeenCalledTimes(2);
    expect(adminService.getThresholds).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: 'c2' }));
  });
});

describe('AdminClinicalLimitsPage: review follow-ups', () => {
  it('saves an investigation range with values', async () => {
    setup([], null);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit CBC: Haemoglobin' }));
    await user.type(screen.getByLabelText('Low'), '12');
    await user.type(screen.getByLabelText('High'), '16.5');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(clinicalService.setRange).toHaveBeenCalledWith({ test: 'CBC', field: 'hb', low: 12, high: 16.5 }));
  });

  it('clears a shown error once the admin types', async () => {
    setup([]);
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Pulse' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter a low limit, a high limit, or both.')).toBeTruthy();
    await user.type(screen.getByLabelText('High'), '1');
    expect(screen.queryByText('Enter a low limit, a high limit, or both.')).toBeNull();
  });

  it('shows the server’s field error and keeps the editor open', async () => {
    setup([]);
    vi.mocked(adminService.setThreshold).mockRejectedValue(
      new ApiError(400, 'Validation failed', { code: 'VALIDATION_FAILED', details: [{ field: 'high', code: 'OUT_OF_RANGE', issue: 'must be 30-220 bpm' }] } as never)
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Pulse' }));
    await user.type(screen.getByLabelText('High'), '120');
    await user.selectOptions(screen.getByLabelText('Severity'), 'HIGH');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('must be 30-220 bpm')).toBeTruthy();
    expect(screen.getByLabelText('High')).toBeTruthy();
  });

  it('Escape in the remove confirmation closes only the confirmation', async () => {
    setup([], { low: 12, high: 16 });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit CBC: Haemoglobin' }));
    await user.click(screen.getByRole('button', { name: 'Remove range' }));
    await screen.findByText('Remove this range?');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByText('Remove this range?')).toBeNull());
    expect(screen.getByLabelText('Low')).toHaveValue(12);
  });
});
