import { describe, expect, it } from 'vitest';
import { adherenceOf, completeDays, incompleteDays, missedOnLastDay } from './compliance';
import { addDays } from './format';

describe('compliance helpers', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('uses the last complete days, never today', () => {
    expect(completeDays(7, '2026-10-30')).toEqual({ from: '2026-10-23', to: '2026-10-29' });
  });

  it('classifies adherence against the 80% threshold', () => {
    expect(adherenceOf({ planned: 0, done: 0 })).toBe('no-plan');
    expect(adherenceOf({ planned: 10, done: 8 })).toBe('on-track');
    expect(adherenceOf({ planned: 10, done: 7 })).toBe('behind');
  });

  it('finds a missed last day and counts incomplete days', () => {
    const byDay = [
      { date: '2026-10-28', planned: 3, done: 3 },
      { date: '2026-10-29', planned: 3, done: 1 },
    ];
    expect(missedOnLastDay({ to: '2026-10-29', byDay })).toEqual({ date: '2026-10-29', planned: 3, done: 1 });
    expect(missedOnLastDay({ to: '2026-10-28', byDay })).toBeNull();
    expect(incompleteDays({ byDay })).toBe(1);
  });
});
