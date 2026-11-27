import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../ui/toast';
import { InvestigationsPanel } from './InvestigationsPanel';
import { formatDateTime } from '../../lib/format';
import { TriageCard } from './TriageCard';
import type { MedicalProfile, Triage } from '../../types/api';

const updateMedical = vi.fn();
const getAdviceHistory = vi.fn();

const triage: Triage = {
  patientId: 'p1',
  tag: 'HIGH',
  provisional: true,
  complete: true,
  reasons: [
    { parameter: 'RESTING_HEART_RATE', level: 'HIGH', explanation: 'Pulse 128 bpm (High: over 100)', date: '2026-11-21' },
    { parameter: 'SMOKING', level: 'MEDIUM', explanation: 'Quit smoking under 28 days ago (Medium)', date: null },
  ],
  missing: [],
  rulesVersion: 1,
  evaluatedOn: '2026-11-22',
};

vi.mock('../../services/apiServices', () => ({
  clinicalService: {
    getTriage: () => Promise.resolve(triage),
    getTests: () => Promise.resolve([]),
    getInvestigations: () => Promise.resolve([]),
  },
  patientService: {
    updateMedical: (...args: unknown[]) => updateMedical(...args),
    getAdviceHistory: (...args: unknown[]) => getAdviceHistory(...args),
  },
}));

const medical = { patientId: 'p1', medications: ['Metformin 500 mg'], clinicalNotes: null, version: 3 } as unknown as MedicalProfile;

const renderWith = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );

const flags = vi.hoisted(() => ({ history: false }));
vi.mock('../../lib/features', () => ({
  get ADVICE_HISTORY() {
    return flags.history;
  },
}));

beforeEach(() => {
  flags.history = false;
  updateMedical.mockReset();
  getAdviceHistory.mockReset();
  getAdviceHistory.mockResolvedValue({ items: [] });
});

describe('triage reasons', () => {
  it('shows the date of the value behind a reason, formatted, and none when there is no date', async () => {
    renderWith(<TriageCard patientId="p1" />);
    const pulse = await screen.findByText(/Pulse 128 bpm/);
    expect(pulse).toHaveTextContent('Pulse 128 bpm (High: over 100) · 21 Nov 2026');
    expect(screen.getByText(/Quit smoking/)).toHaveTextContent(/^Quit smoking under 28 days ago \(Medium\)$/);
  });
});

describe("doctors' notes", () => {
  it('saves only clinicalNotes, trimmed, with the profile version', async () => {
    const user = userEvent.setup();
    updateMedical.mockResolvedValue({ ...medical, clinicalNotes: 'Stop aspirin 5 days before', version: 4 });
    renderWith(<InvestigationsPanel patientId="p1" medical={medical} />);
    expect(await screen.findByRole('heading', { name: 'Doctors’ notes' })).toBeInTheDocument();
    const box = screen.getByRole('textbox', { name: /^Notes/ });
    const card = box.closest('form')!;
    expect(within(card).getByText(/Only doctors see these/)).toBeInTheDocument();
    await user.type(box, '  Stop aspirin 5 days before  ');
    await user.click(within(card).getByRole('button', { name: 'Save' }));
    expect(updateMedical).toHaveBeenCalledWith('p1', { version: 3, clinicalNotes: 'Stop aspirin 5 days before' });
    expect(await screen.findByText('Notes saved.')).toBeInTheDocument();
  });

  it('keeps the medications card saving medications one per line', async () => {
    const user = userEvent.setup();
    updateMedical.mockResolvedValue({ ...medical, medications: ['Metformin 500 mg', 'Aspirin 75 mg'], version: 4 });
    renderWith(<InvestigationsPanel patientId="p1" medical={medical} />);
    const box = await screen.findByRole('textbox', { name: /^Medications/ });
    await user.type(box, '\n Aspirin 75 mg \n\n');
    await user.click(within(box.closest('form')!).getByRole('button', { name: 'Save' }));
    expect(updateMedical).toHaveBeenCalledWith('p1', { version: 3, medications: ['Metformin 500 mg', 'Aspirin 75 mg'] });
  });
});

describe('advice for the patient', () => {
  it('saves only patientAdvice, trimmed, with the profile version', async () => {
    const user = userEvent.setup();
    updateMedical.mockResolvedValue({ ...medical, patientAdvice: 'Stop aspirin', version: 4 });
    renderWith(<InvestigationsPanel patientId="p1" medical={medical} />);
    expect(await screen.findByRole('heading', { name: 'Advice for the patient' })).toBeInTheDocument();
    const box = screen.getByRole('textbox', { name: /^Advice/ });
    const card = box.closest('form')!;
    expect(within(card).getByText(/Test results page/)).toBeInTheDocument();
    // Doctors' notes keep their own hint
    expect(screen.getByText(/Only doctors see these/)).toBeInTheDocument();
    await user.type(box, '  Stop aspirin  ');
    await user.click(within(card).getByRole('button', { name: 'Save' }));
    expect(updateMedical).toHaveBeenCalledWith('p1', { version: 3, patientAdvice: 'Stop aspirin' });
    expect(await screen.findByText('Advice saved.')).toBeInTheDocument();
  });

  it('keeps the doctors’ notes copy and sends only clinicalNotes', async () => {
    const user = userEvent.setup();
    updateMedical.mockResolvedValue({ ...medical, clinicalNotes: 'Private note', version: 4 });
    renderWith(<InvestigationsPanel patientId="p1" medical={medical} />);
    const box = await screen.findByRole('textbox', { name: /^Notes/ });
    const card = box.closest('form')!;
    expect(within(card).getByText('Only doctors see these, never the patient. Up to 2000 characters.')).toBeInTheDocument();
    await user.type(box, 'Private note');
    await user.click(within(card).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(updateMedical).toHaveBeenCalledTimes(1));
    const body = updateMedical.mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['clinicalNotes', 'version']);
  });
});

describe('advice history', () => {
  const historyItems = [
    { advice: 'Stop aspirin 5 days before', at: '2026-11-21T09:30:00Z', by: { name: 'Dr Nair' } },
    { advice: null, at: '2026-11-20T08:00:00Z', by: null },
  ];

  it('is never requested when the flag is off', async () => {
    renderWith(<InvestigationsPanel patientId="p1" medical={medical} />);
    await screen.findByRole('heading', { name: 'Advice for the patient' });
    expect(getAdviceHistory).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Advice history' })).not.toBeInTheDocument();
  });

  it('shows every save, newest first, with the date, the saver and Cleared', async () => {
    flags.history = true;
    getAdviceHistory.mockResolvedValue({ items: historyItems });
    renderWith(<InvestigationsPanel patientId="p1" medical={medical} />);
    expect(await screen.findByRole('heading', { name: 'Advice history' })).toBeInTheDocument();
    expect(getAdviceHistory).toHaveBeenCalledWith('p1');
    const items = within(screen.getByRole('heading', { name: 'Advice history' }).closest('section')!).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(`${formatDateTime('2026-11-21T09:30:00Z')} · Dr Nair`);
    expect(items[0]).toHaveTextContent('Stop aspirin 5 days before');
    expect(items[1]).toHaveTextContent('Cleared');
  });

  it('shows nothing when the history is empty or fails', async () => {
    flags.history = true;
    getAdviceHistory.mockRejectedValue(new Error('boom'));
    renderWith(<InvestigationsPanel patientId="p1" medical={medical} />);
    await screen.findByRole('heading', { name: 'Advice for the patient' });
    await vi.waitFor(() => expect(getAdviceHistory).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Advice history' })).not.toBeInTheDocument();
  });

  it('refetches the history after the advice is saved', async () => {
    flags.history = true;
    const user = userEvent.setup();
    getAdviceHistory.mockResolvedValueOnce({ items: [] }).mockResolvedValue({ items: historyItems });
    updateMedical.mockResolvedValue({ ...medical, patientAdvice: 'Stop aspirin', version: 4 });
    renderWith(<InvestigationsPanel patientId="p1" medical={medical} />);
    await vi.waitFor(() => expect(getAdviceHistory).toHaveBeenCalledTimes(1));
    const box = screen.getByRole('textbox', { name: /^Advice/ });
    await user.type(box, 'Stop aspirin 5 days before');
    await user.click(within(box.closest('form')!).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { name: 'Advice history' })).toBeInTheDocument();
    expect(getAdviceHistory).toHaveBeenCalledTimes(2);
  });
});
