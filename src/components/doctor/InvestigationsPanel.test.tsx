import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../ui/toast';
import { InvestigationsPanel } from './InvestigationsPanel';
import { TriageCard } from './TriageCard';
import type { MedicalProfile, Triage } from '../../types/api';

const updateMedical = vi.fn();

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
  patientService: { updateMedical: (...args: unknown[]) => updateMedical(...args) },
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

beforeEach(() => updateMedical.mockReset());

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
