import { addDays, localDateKey } from './format';
import type { CaseloadRow, Compliance, Counts } from '../types/api';

/**
 * Share of planned exercises done that counts as "following the routine".
 * The client hasn't agreed a compliance formula yet (the API's `percentage` is null until they do).
 */
// ponytail: fixed 80% threshold; switch to the API's percentage once the client confirms the formula
export const ON_TRACK = 0.8;

/** The last `days` complete days, ending yesterday: today isn't over, so it can't count as missed. */
export const completeDays = (days: number, today = localDateKey()) => {
  const to = addDays(today, -1);
  return { from: addDays(to, -(days - 1)), to };
};

/**
 * A caseload row's range ends on the patient's today, which isn't over yet.
 * Taking today away leaves only complete days: ask for days=8 to get the last 7, days=2 to get yesterday.
 */
export const completeDaysOf = (row: Pick<CaseloadRow, 'planned' | 'done' | 'skipped' | 'today'>): Counts => ({
  planned: row.planned - row.today.planned,
  done: row.done - row.today.done,
  skipped: row.skipped - row.today.skipped,
});

export type Adherence = 'on-track' | 'behind' | 'no-plan';

/** Skipped exercises count as not done. */
export const adherenceOf = (c: Pick<Counts, 'planned' | 'done'>): Adherence =>
  c.planned === 0 ? 'no-plan' : c.done / c.planned >= ON_TRACK ? 'on-track' : 'behind';

export const missed = (c: Pick<Counts, 'planned' | 'done'>) => c.planned > c.done;

export const incompleteDays = (c: Pick<Compliance, 'byDay'>) => c.byDay.filter(missed).length;
