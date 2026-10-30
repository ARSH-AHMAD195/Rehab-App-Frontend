import { describe, expect, it } from 'vitest';
import { daysUntil, firstName, formatReading, fromDateKey, initials, labelize, localDateKey, splitList } from './format';

describe('format helpers', () => {
  it('labelize handles API codes and snake case', () => {
    expect(labelize('general_consultation_note')).toBe('General Consultation Note');
    expect(labelize('PELVIC_FLOOR')).toBe('Pelvic Floor');
    expect(labelize(undefined)).toBe('');
  });

  it('daysUntil counts calendar days, negative once past, null without a date', () => {
    const now = new Date(2026, 4, 10, 23, 30);
    expect(daysUntil(new Date(2026, 4, 11, 0, 15), now)).toBe(1);
    expect(daysUntil(new Date(2026, 4, 10, 8), now)).toBe(0);
    expect(daysUntil(new Date(2026, 4, 1), now)).toBe(-9);
    expect(daysUntil('2026-05-12', now)).toBe(2);
    expect(daysUntil(null, now)).toBeNull();
    expect(daysUntil('not a date', now)).toBeNull();
  });

  it('local date keys round-trip without drifting to the UTC day', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(localDateKey(fromDateKey('2026-01-05'))).toBe('2026-01-05');
    expect(localDateKey('2026-01-05')).toBe('2026-01-05');
  });

  it('formats readings, initials and lists', () => {
    expect(formatReading({ systolic: 128, diastolic: 82 })).toBe('128/82');
    expect(formatReading({ num: 0 })).toBe('0');
    expect(formatReading({ text: 'Dal and rice' })).toBe('Dal and rice');
    expect(formatReading(null)).toBe('—');
    expect(initials('Dr Meera  Nair')).toBe('DM');
    expect(initials(null)).toBe('');
    expect(firstName('Dr Meera Nair')).toBe('Meera');
    expect(firstName('Dr. Arjun Rao')).toBe('Arjun');
    expect(firstName('Rajesh Iyer')).toBe('Rajesh');
    expect(splitList(' Penicillin, , Latex ')).toEqual(['Penicillin', 'Latex']);
  });
});
