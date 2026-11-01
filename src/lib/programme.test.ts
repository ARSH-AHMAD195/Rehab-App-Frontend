import { describe, expect, it } from 'vitest';
import { programmeProgress } from './programme';

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
