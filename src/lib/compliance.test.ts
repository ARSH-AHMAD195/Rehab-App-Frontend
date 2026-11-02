import { describe, expect, it } from 'vitest';
import { adherenceOf, completeDays, completeDaysOf, incompleteDays, missed } from './compliance';
import { addDays } from './format';

describe('compliance helpers', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('uses the last complete days, never today', () => {
    expect(completeDays(7, '2026-10-30')).toEqual({ from: '2026-10-23', to: '2026-10-29' });
  });

  it('drops today from a caseload row, leaving complete days only', () => {
    const row = { planned: 10, done: 2, skipped: 1, today: { planned: 2, done: 0, skipped: 0 } };
    expect(completeDaysOf(row)).toEqual({ planned: 8, done: 2, skipped: 1 });
  });

  it('classifies adherence against the 80% threshold; skips are not done', () => {
    expect(adherenceOf({ planned: 0, done: 0 })).toBe('no-plan');
    expect(adherenceOf({ planned: 10, done: 8 })).toBe('on-track');
    expect(adherenceOf({ planned: 10, done: 7 })).toBe('behind');
  });

  it('counts missed and incomplete days', () => {
    expect(missed({ planned: 2, done: 1 })).toBe(true);
    expect(missed({ planned: 2, done: 2 })).toBe(false);
    expect(missed({ planned: 0, done: 0 })).toBe(false);
    const byDay = [
      { date: '2026-10-28', planned: 3, done: 3, skipped: 0 },
      { date: '2026-10-29', planned: 3, done: 1, skipped: 2 },
    ];
    expect(incompleteDays({ byDay })).toBe(1);
  });
});
