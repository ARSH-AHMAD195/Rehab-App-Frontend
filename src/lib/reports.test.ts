import { describe, expect, it } from 'vitest';
import { investigationReport, resultFlag, weeklyNutrition } from './reports';
import type { InvestigationGridRow, InvestigationResult, InvestigationTest, MealHistoryDay } from '../types/api';

const day = (date: string, kcal?: number, proteinG = 0): MealHistoryDay =>
  kcal === undefined
    ? { date, logged: false, totals: null, targets: null, percent: null }
    : { date, logged: true, totals: { kcal, proteinG, slotsEaten: 2 }, targets: { kcal: 2000, proteinG: 80 }, percent: { kcal: Math.round(kcal / 20), protein: Math.round(proteinG / 0.8) } };

describe('weekly calorie report', () => {
  it('lists days newest first and averages over the logged days only', () => {
    const r = weeklyNutrition([day('2026-11-16', 1000, 40), day('2026-11-18'), day('2026-11-17', 1501, 45.5), day('2026-11-19')]);
    expect(r.rows.map((d) => d.date)).toEqual(['2026-11-19', '2026-11-18', '2026-11-17', '2026-11-16']);
    expect(r).toMatchObject({ daysLogged: 2, totalDays: 4, avgKcal: 1251, avgProteinG: 42.8 });
  });

  it('leaves a day with a log but nothing ticked out of the averages', () => {
    const empty = { ...day('2026-11-18', 0), logged: false, totals: { kcal: 0, proteinG: 0, slotsEaten: 0 } };
    expect(weeklyNutrition([empty, day('2026-11-17', 1800, 60)])).toMatchObject({ daysLogged: 1, avgKcal: 1800, avgProteinG: 60 });
  });

  it('has no averages when nothing was logged, or no days at all', () => {
    expect(weeklyNutrition([day('2026-11-18'), day('2026-11-17')])).toMatchObject({ daysLogged: 0, totalDays: 2, avgKcal: null, avgProteinG: null });
    expect(weeklyNutrition([])).toEqual({ rows: [], daysLogged: 0, totalDays: 0, avgKcal: null, avgProteinG: null });
  });
});

const num = (key: string, label: string, unit: string) => ({ key, label, kind: 'number' as const, unit, min: 0, max: 999, range: null });
const hb = { code: 'HB', label: 'Haemoglobin', group: 'HAEMATOLOGY', fields: [num('value', 'Hb', 'g/dL')], allowWnl: false, feedsTriage: true } as InvestigationTest;
const lytes = { code: 'LYTES', label: 'Electrolytes', group: 'BIOCHEMISTRY', fields: [num('na', 'Na', 'mmol/L'), num('k', 'K', 'mmol/L')], allowWnl: false, feedsTriage: true } as InvestigationTest;
const result = (id: string, takenOn: string, extra: Partial<InvestigationResult> = {}) =>
  ({ id, takenOn, values: { value: 10 }, wnl: false, comment: null, flags: {}, outOfRange: false, status: 'ACTIVE', ...extra }) as InvestigationResult;
const row = (test: InvestigationTest, results: InvestigationResult[]): InvestigationGridRow => ({ test: test.code, label: test.label, group: test.group, results });

describe('investigation report', () => {
  it('keeps only active results, newest first, grouped in the panel order', () => {
    const groups = investigationReport(
      [
        row(lytes, [result('l1', '2026-11-01')]),
        row(hb, [result('h1', '2026-10-01'), result('h2', '2026-11-10', { status: 'RETRACTED' }), result('h3', '2026-11-05')]),
      ],
      [hb, lytes]
    );
    expect(groups.map((g) => g.title)).toEqual(['Haematology', 'Biochemistry']);
    expect(groups[0]!.tests[0]).toMatchObject({ label: 'Haemoglobin', units: 'g/dL', test: hb });
    expect(groups[0]!.tests[0]!.results.map((r) => r.id)).toEqual(['h3', 'h1']);
  });

  it('leaves out tests with no active results, and is empty with no results at all', () => {
    expect(investigationReport([row(hb, [result('h1', '2026-11-01', { status: 'RETRACTED' })]), row(lytes, [result('l1', '2026-11-01')])], [hb, lytes]).map((g) => g.group)).toEqual(['BIOCHEMISTRY']);
    expect(investigationReport([row(hb, []), row(lytes, [])], [hb, lytes])).toEqual([]);
    expect(investigationReport([], [])).toEqual([]);
  });

  it('names the flag, with the field for tests of several values', () => {
    expect(resultFlag(hb, result('a', '2026-11-01', { flags: { value: 'LOW' } }))).toBe('LOW');
    expect(resultFlag(lytes, result('b', '2026-11-01', { flags: { na: 'LOW', k: 'HIGH' } }))).toBe('Na LOW, K HIGH');
    expect(resultFlag(hb, result('c', '2026-11-01', { wnl: true }))).toBe('Within normal limits');
    expect(resultFlag(hb, result('d', '2026-11-01'))).toBe('');
  });
});
