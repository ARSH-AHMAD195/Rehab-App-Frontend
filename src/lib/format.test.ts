import { describe, expect, it } from 'vitest';
import { dateInputToIso, daysUntil, formatMeasurementValue, formatMedication, fromDateKey, labelize, localDateKey } from './format';

describe('format helpers', () => {
  it('labelize replaces every underscore', () => {
    expect(labelize('general_consultation_note')).toBe('General Consultation Note');
    expect(labelize(undefined)).toBe('');
  });

  it('daysUntil counts calendar days, negative once past, null without a date', () => {
    const now = new Date(2026, 4, 10, 23, 30);
    expect(daysUntil(new Date(2026, 4, 11, 0, 15), now)).toBe(1);
    expect(daysUntil(new Date(2026, 4, 10, 8), now)).toBe(0);
    expect(daysUntil(new Date(2026, 4, 1), now)).toBe(-9);
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil('not a date', now)).toBeNull();
  });

  it('local date keys round-trip without drifting to the UTC day', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDateKey(fromDateKey('2026-01-05'))).toBe('2026-01-05');
  });

  it('date inputs are sent as local noon so the calendar day survives timezones', () => {
    expect(localDateKey(new Date(dateInputToIso('2026-03-29')))).toBe('2026-03-29');
  });

  it('formats measurements and medications for display', () => {
    expect(formatMeasurementValue({ type: 'blood_pressure', systolic: 128, diastolic: 82 })).toBe('128/82');
    expect(formatMeasurementValue({ type: 'pulse', numericValue: 0 })).toBe(0);
    expect(formatMeasurementValue({ type: 'mood', textValue: 'Good' })).toBe('Good');
    expect(formatMedication({ name: 'Metoprolol', dosage: '25mg', frequency: 'BID' })).toBe('Metoprolol 25mg BID');
    expect(formatMedication('Aspirin')).toBe('Aspirin');
  });
});
