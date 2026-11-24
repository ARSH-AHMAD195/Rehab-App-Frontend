import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { qk, queryClient } from '../../lib/queryClient';
import { ApiError } from '../../services/api';
import { ToastProvider } from '../ui/toast';
import { VitalsForm, type VitalsSource } from './VitalsForm';
import type { DailyLog, VitalTypeDef } from '../../types/api';

vi.mock('../../lib/firebase', () => ({ firebaseAuth: { currentUser: null } }));

const pulse: VitalTypeDef = { type: 'PULSE', label: 'Pulse', labelHi: null, unit: 'bpm', valueKind: 'numeric', minValid: 30, maxValid: 220, isOptional: false, onForm: true, version: 1, integerOnly: true };
// Not the browser's date: the doctor's form must save for the patient's day as the today query returned it
const patientToday = {
  date: '2026-11-21',
  timeZone: 'Asia/Kolkata',
  dayStatus: 'NOT_STARTED',
  filledCount: 0,
  totalCount: 1,
  readings: { PULSE: { value: null, unit: 'bpm', status: 'NOT_YET', loggedAt: null } },
} as unknown as DailyLog;

const doctorSource = (save: VitalsSource['save']) => ({
  todayKey: ['patient', 'p1', 'today'],
  loadToday: vi.fn(() => Promise.resolve(patientToday)),
  save: vi.fn(save),
  invalidate: [['patient', 'p1', 'logs']],
});

const fillPulseAndSave = async (source: VitalsSource) => {
  const onSaved = vi.fn();
  queryClient.setQueryData(qk.vitalTypes, [pulse]);
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <VitalsForm source={source} onSaved={onSaved} />
      </ToastProvider>
    </QueryClientProvider>
  );
  await userEvent.type(await screen.findByLabelText('Pulse'), '72');
  await userEvent.click(screen.getByRole('button', { name: /Save 1 change/ }));
  return onSaved;
};

describe('VitalsForm for a doctor', () => {
  afterEach(() => vi.restoreAllMocks());

  it('saves the changed reading through the given save, for the today query’s date, and refreshes the given queries', async () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const source = doctorSource(() => Promise.resolve({ ...patientToday, filledCount: 1, alerts: [] }));

    const onSaved = await fillPulseAndSave(source);

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(source.save).toHaveBeenCalledWith('2026-11-21', { PULSE: { num: 72 } });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['patient', 'p1', 'logs'] });
  });

  it('shows the day as a short date, not the raw date key', async () => {
    const source = doctorSource(() => Promise.resolve({ ...patientToday, alerts: [] }));
    queryClient.setQueryData(qk.vitalTypes, [pulse]);
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <VitalsForm source={source} />
        </ToastProvider>
      </QueryClientProvider>
    );
    expect(await screen.findByText(/0 of 1 filled for 21 Nov\./)).toBeInTheDocument();
  });

  it('reloads the patient’s day instead of closing when the day has changed', async () => {
    const source = doctorSource(() => Promise.reject(new ApiError(409, 'A new day has started', { code: 'DAY_CHANGED' })));

    const onSaved = await fillPulseAndSave(source);

    expect(await screen.findByText(/The day has changed/)).toBeInTheDocument();
    await waitFor(() => expect(source.loadToday).toHaveBeenCalledTimes(2));
    expect(onSaved).not.toHaveBeenCalled();
  });
});
