import { GROUP_TITLES, testUnits } from './investigations';
import type { InvestigationGridRow, InvestigationGroup, InvestigationResult, InvestigationTest, MealHistoryDay } from '../types/api';

/** Protein to one decimal, as the diet chart shows it. */
export const round1 = (n: number) => Math.round(n * 10) / 10;
export const percentText = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${n}%`);

const newestFirst = <T>(items: T[], date: (item: T) => string) => [...items].sort((a, b) => date(b).localeCompare(date(a)));

/** The weekly calorie report: days newest first, and averages over the logged days only (days not logged are left out, not counted as zero). */
export const weeklyNutrition = (days: MealHistoryDay[]) => {
  const rows = newestFirst(days, (d) => d.date);
  const logged = rows.flatMap((d) => (d.logged && d.totals ? [d.totals] : []));
  const average = (value: (t: (typeof logged)[number]) => number) => (logged.length ? logged.reduce((sum, t) => sum + value(t), 0) / logged.length : null);
  const kcal = average((t) => t.kcal);
  const protein = average((t) => t.proteinG);
  return {
    rows,
    daysLogged: logged.length,
    totalDays: rows.length,
    avgKcal: kcal === null ? null : Math.round(kcal),
    avgProteinG: protein === null ? null : round1(protein),
  };
};

/** The investigation report: groups in the panel's order, each test's active results newest first. Tests (and groups) with none are left out. */
export const investigationReport = (rows: InvestigationGridRow[], tests: InvestigationTest[]) => {
  const byCode = new Map(tests.map((t) => [t.code, t]));
  return (Object.keys(GROUP_TITLES) as InvestigationGroup[])
    .map((group) => ({
      group,
      title: GROUP_TITLES[group],
      tests: rows
        .filter((r) => r.group === group)
        .map((r) => {
          const test = byCode.get(r.test);
          return {
            code: r.test,
            label: r.label,
            units: test ? testUnits(test) : '',
            test,
            results: newestFirst(
              r.results.filter((x) => x.status === 'ACTIVE'),
              (x) => x.takenOn
            ),
          };
        })
        .filter((t) => t.results.length),
    }))
    .filter((g) => g.tests.length);
};

/** "LOW", "Na LOW, K HIGH" (a test with several fields), "Within normal limits", or "" when nothing is flagged. */
export const resultFlag = (test: InvestigationTest | undefined, result: InvestigationResult) => {
  if (result.wnl) return 'Within normal limits';
  const flags = Object.entries(result.flags);
  const named = (test?.fields.length ?? flags.length) > 1;
  return flags.map(([key, flag]) => (named ? `${test?.fields.find((f) => f.key === key)?.label ?? key} ${flag}` : flag)).join(', ');
};
