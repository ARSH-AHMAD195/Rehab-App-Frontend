import { describe, expect, it } from 'vitest';
import { DIET_CHART, DIET_DAILY_KCAL, DIET_DAILY_PROTEIN_G } from './dietChart';
import { hi } from './hi';

describe('diet chart', () => {
  it('has Hindi for every slot, time, food and quantity', () => {
    for (const slot of DIET_CHART) {
      for (const text of [slot.name, slot.time, ...slot.options.flatMap((o) => [o.food, o.quantity])]) expect(hi[text], text).toBeDefined();
    }
  });

  it('matches the printed daily totals (the printed kcal is 1 below the slots’ sum)', () => {
    expect(DIET_CHART.reduce((sum, s) => sum + s.kcal, 0)).toBe(DIET_DAILY_KCAL + 1);
    expect(DIET_CHART.reduce((sum, s) => sum + s.proteinG, 0)).toBeCloseTo(DIET_DAILY_PROTEIN_G);
  });
});
