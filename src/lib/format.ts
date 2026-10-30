import type { ReadingValue, Target } from '../types/api';

const DAY_MS = 24 * 60 * 60 * 1000;

type DateInput = string | number | Date | null | undefined;

const toDate = (value: DateInput): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  // A bare YYYY-MM-DD is a calendar day, not UTC midnight
  const d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? fromDateKey(value) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "pelvic_floor" / "PELVIC_FLOOR" -> "Pelvic Floor" (all underscores, not just the first). */
export const labelize = (value: string | null | undefined = '') =>
  String(value ?? '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const formatDate = (value: DateInput, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  const d = toDate(value);
  return d ? d.toLocaleDateString(undefined, options) : '—';
};

export const formatDateTime = (value: DateInput) => {
  const d = toDate(value);
  return d ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
};

/** Whole calendar days from today until `value` (negative once past), or null if no date. */
export const daysUntil = (value: DateInput, now: Date = new Date()) => {
  const d = toDate(value);
  if (!d) return null;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((startOfDay(d) - startOfDay(now)) / DAY_MS);
};

/** YYYY-MM-DD in the user's local timezone (toISOString would give the UTC date). */
export const localDateKey = (value: DateInput = new Date()) => {
  const d = toDate(value);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Parses a YYYY-MM-DD key as a local date (new Date('2026-01-05') would be UTC midnight). */
export function fromDateKey(key: string) {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "2026-10-30" + 1 -> "2026-10-31", across month and year ends. */
export const addDays = (key: string, days: number) => {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
};

/** The value of a vital reading as text: "128/82", "76", or the nutrition note. */
export const formatReading = (value: ReadingValue | null | undefined) => {
  if (!value) return '—';
  if ('systolic' in value) return `${value.systolic}/${value.diastolic}`;
  return 'num' in value ? String(value.num) : value.text;
};

/** An exercise target as text: "2 × 10 · 15 min". */
export const describeTarget = (target: Target | null | undefined) =>
  [target?.sets && target.reps ? `${target.sets} × ${target.reps}` : target?.reps ? `${target.reps} reps` : null, target?.durationMin ? `${target.durationMin} min` : null]
    .filter(Boolean)
    .join(' · ');

/** Day 12 of a 28-day programme -> { week: 2, weeks: 4 }. */
export const weekOf = (day: number, totalDays: number) => ({ week: Math.ceil(day / 7), weeks: Math.ceil(totalDays / 7) });

/** "Dr Meera Nair" -> "Meera": the first name, skipping a title. */
export const firstName = (name: string) => name.replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, '').split(/\s+/)[0] ?? name;

/** "Meera Nair" -> "MN" */
export const initials = (name: string | null | undefined) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

/** Splits a comma-separated input into trimmed, non-empty items. */
export const splitList = (text: string, separator: string | RegExp = ',') =>
  text
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);
