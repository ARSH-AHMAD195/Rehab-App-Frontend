import { describe, expect, it } from 'vitest';
import { buildTrends } from './trends';
import type { HealthMeasurement } from '../types/api';

const m = (type: HealthMeasurement['type'], measuredAt: Date, fields: Partial<HealthMeasurement>): HealthMeasurement => ({
  _id: `${type}-${measuredAt.getTime()}`,
  patient: 'p1',
  type,
  unit: '',
  notes: '',
  measuredAt: measuredAt.toISOString(),
  ...fields,
});

describe('buildTrends', () => {
  it('groups by local calendar day, keeping the latest reading of each metric', () => {
    const rows = buildTrends([
      m('pulse', new Date(2026, 2, 3, 23, 50), { numericValue: 80 }), // late evening: must stay on the 3rd
      m('pulse', new Date(2026, 2, 3, 8, 0), { numericValue: 70 }),
      m('blood_pressure', new Date(2026, 2, 3, 9, 0), { systolic: 130, diastolic: 85 }),
      m('step_count', new Date(2026, 2, 4, 12, 0), { numericValue: 4200 }),
      m('pain_score', new Date(2026, 2, 4, 12, 0), { numericValue: 2 }),
    ]);

    expect(rows.map((r) => r.date)).toEqual(['2026-03-03', '2026-03-04']);
    expect(rows[0]).toMatchObject({ pulse: 80, systolic: 130, diastolic: 85 });
    expect(rows[1]).toMatchObject({ steps: 4200, pain: 2 });
    expect(rows[1]).not.toHaveProperty('pulse');
  });

  it('ignores text-only values instead of plotting them as zero', () => {
    const [row] = buildTrends([m('mood', new Date(2026, 2, 3, 10), { textValue: 'Good' })]);
    expect(row).not.toHaveProperty('mood');
  });
});
