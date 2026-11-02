import { describe, expect, it } from 'vitest';
import { programmeFor, programmeProgress } from './programme';

describe('which programme a patient is on', () => {
  const now = new Date(2026, 10, 1, 10); // 1 Nov 2026

  it('counts from the enrollment day up to surgery when nothing else is set', () => {
    expect(programmeFor({ startDate: null, lengthDays: null, surgeryDate: '2026-12-11', enrolledAt: '2026-10-23T09:00:00+05:30', now })).toMatchObject({
      currentDay: 10,
      totalDays: 49,
      started: true,
    });
  });

  it('uses the programme start date and length when the doctor set them', () => {
    expect(programmeFor({ startDate: '2026-10-29', lengthDays: 28, surgeryDate: '2026-12-11', enrolledAt: '2026-10-01', now })).toMatchObject({
      currentDay: 4,
      totalDays: 28,
      started: true,
    });
  });

  it('says not started before the start date', () => {
    expect(programmeFor({ startDate: '2026-11-05', lengthDays: 28, surgeryDate: null, enrolledAt: '2026-10-30', now })).toMatchObject({
      started: false,
      start: '2026-11-05',
    });
  });

  it('shows nothing without a length or once surgery has passed', () => {
    expect(programmeFor({ startDate: '2026-10-29', lengthDays: null, surgeryDate: null, enrolledAt: null, now })).toBeNull();
    expect(programmeFor({ startDate: '2026-09-01', lengthDays: 28, surgeryDate: '2026-10-20', enrolledAt: null, now })).toBeNull();
  });
});

describe('programme progress', () => {
  it('day 1: week 1, first segment 1/7', () => {
    const p = programmeProgress(1, 28);
    expect(p).toMatchObject({ day: 1, week: 1, weeks: 4 });
    expect(p.fills).toEqual([1 / 7, 0, 0, 0]);
  });

  it('day 7: week 1 complete', () => {
    expect(programmeProgress(7, 28)).toMatchObject({ week: 1, fills: [1, 0, 0, 0] });
  });

  it('day 12: week 2 at 5/7', () => {
    const p = programmeProgress(12, 28);
    expect(p).toMatchObject({ day: 12, week: 2, weeks: 4 });
    expect(p.fills).toEqual([1, 5 / 7, 0, 0]);
  });

  it('day 28: every week full', () => {
    expect(programmeProgress(28, 28)).toMatchObject({ week: 4, fills: [1, 1, 1, 1] });
  });

  it('clamps days outside the programme', () => {
    expect(programmeProgress(0, 28)).toMatchObject({ day: 1, week: 1 });
    expect(programmeProgress(-5, 28)).toMatchObject({ day: 1, fills: [1 / 7, 0, 0, 0] });
    expect(programmeProgress(40, 28)).toMatchObject({ day: 28, week: 4, fills: [1, 1, 1, 1] });
  });

  it('handles a short last week and other week lengths', () => {
    expect(programmeProgress(49, 50)).toMatchObject({ weeks: 8, week: 7, fills: [1, 1, 1, 1, 1, 1, 1, 0] });
    expect(programmeProgress(6, 10, 5)).toMatchObject({ weeks: 2, week: 2, fills: [1, 1 / 5] });
  });
});
