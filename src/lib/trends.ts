import type { HealthMeasurement, MeasurementType } from '../types/api';
import { formatDate, localDateKey } from './format';

export type TrendRow = { date: string; label: string } & Partial<Record<TrendKey, number>>;

export type TrendKey =
  | 'systolic'
  | 'diastolic'
  | 'spo2'
  | 'pulse'
  | 'temperature'
  | 'weight'
  | 'blood_sugar'
  | 'pain'
  | 'walking_minutes'
  | 'steps'
  | 'sleep_hours'
  | 'water_intake'
  | 'mood'
  | 'nutrition_intake';

const NUMERIC_KEYS: Partial<Record<MeasurementType, TrendKey>> = {
  spo2: 'spo2',
  pulse: 'pulse',
  temperature: 'temperature',
  weight: 'weight',
  blood_sugar: 'blood_sugar',
  pain_score: 'pain',
  walking_minutes: 'walking_minutes',
  step_count: 'steps',
  sleep_hours: 'sleep_hours',
  water_intake: 'water_intake',
  mood: 'mood',
  nutrition_intake: 'nutrition_intake',
};

/**
 * One row per local calendar day, latest reading of each metric that day.
 * Built client-side because the backend's /trends groups by UTC date, which moves
 * evening readings to the next day for users west of UTC.
 */
export const buildTrends = (measurements: HealthMeasurement[]): TrendRow[] => {
  const byDay = new Map<string, TrendRow>();
  [...measurements]
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime())
    .forEach((m) => {
      const date = localDateKey(m.measuredAt);
      let row = byDay.get(date);
      if (!row) {
        row = { date, label: formatDate(m.measuredAt, { month: 'short', day: 'numeric' }) };
        byDay.set(date, row);
      }
      if (m.type === 'blood_pressure') {
        row.systolic = m.systolic;
        row.diastolic = m.diastolic;
      } else {
        const key = NUMERIC_KEYS[m.type];
        if (key && typeof m.numericValue === 'number') row[key] = m.numericValue;
      }
    });
  return [...byDay.values()];
};
