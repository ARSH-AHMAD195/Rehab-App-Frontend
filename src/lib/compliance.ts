import { addDays, localDateKey } from './format';
import type { Compliance } from '../types/api';

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

export type Adherence = 'on-track' | 'behind' | 'no-plan';

export const adherenceOf = (c: Pick<Compliance, 'planned' | 'done'>): Adherence =>
  c.planned === 0 ? 'no-plan' : c.done / c.planned >= ON_TRACK ? 'on-track' : 'behind';

/** The last day of the range if exercises were planned and not all done, else null. */
export const missedOnLastDay = (c: Pick<Compliance, 'to' | 'byDay'>) => {
  const day = c.byDay.find((d) => d.date === c.to);
  return day && day.planned > day.done ? day : null;
};

export const incompleteDays = (c: Pick<Compliance, 'byDay'>) => c.byDay.filter((d) => d.planned > d.done).length;
