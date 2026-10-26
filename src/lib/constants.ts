import type { Role, TrendPeriod } from '../types/api';

export const HOME_BY_ROLE: Record<Role, string> = {
  patient: '/patient/dashboard',
  doctor: '/doctor/dashboard',
  admin: '/admin/dashboard',
};

/** 1 = Monday … 7 = Sunday, as the Exercise API numbers them. */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];

export const describeDays = (days: number[]) =>
  days.length === 7 ? 'Every day' : [...days].sort().map((d) => WEEKDAYS[d - 1]).join(', ');

export const TREND_PERIODS: readonly [TrendPeriod, string][] = [
  ['7d', 'Last 7 days'],
  ['30d', 'Last 30 days'],
  ['90d', 'Last 90 days'],
];

/** The Auth API wants phone numbers in E.164, e.g. +919876543210. */
export const PHONE_PATTERN = '\\+[1-9]\\d{7,14}';
export const PHONE_HINT = 'International format, e.g. +919876543210';

export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';
