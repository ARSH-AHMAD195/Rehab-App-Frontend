import type { HealthMeasurement, Medication, UserSummary } from '../types/api';

const DAY_MS = 24 * 60 * 60 * 1000;

type DateInput = string | number | Date | null | undefined;

const toDate = (value: DateInput): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "pelvic_floor" -> "Pelvic Floor" (all underscores, not just the first). */
export const labelize = (value: string | null | undefined = '') =>
  String(value ?? '')
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
export const fromDateKey = (key: string) => {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Date-only input value -> ISO timestamp at local noon. Sending "2026-01-05" raw makes the
 * server store UTC midnight, which renders as Jan 4 anywhere west of UTC.
 */
export const dateInputToIso = (key: string) => {
  const d = fromDateKey(key);
  d.setHours(12);
  return d.toISOString();
};

export const formatMeasurementValue = (m: Pick<HealthMeasurement, 'type' | 'systolic' | 'diastolic' | 'numericValue' | 'textValue'> | undefined) => {
  if (!m) return '—';
  if (m.type === 'blood_pressure') return `${m.systolic}/${m.diastolic}`;
  return m.numericValue ?? m.textValue ?? '—';
};

export const fullName = (user: Partial<UserSummary> | null | undefined) => [user?.firstName, user?.lastName].filter(Boolean).join(' ');

export const initials = (user: Partial<UserSummary> | null | undefined) => `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

export const formatMedication = (med: Medication | string) =>
  typeof med === 'string' ? med : [med.name, med.dosage, med.frequency].filter(Boolean).join(' ');
