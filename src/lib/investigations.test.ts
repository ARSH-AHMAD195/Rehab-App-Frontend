import { describe, expect, it } from 'vitest';
import { formatResult, testUnits } from './investigations';
import type { InvestigationResult, InvestigationTest } from '../types/api';

const test_ = (fields: InvestigationTest['fields']) => ({ code: 'X', label: 'X', group: 'BIOCHEMISTRY', fields, allowWnl: true, feedsTriage: false }) as InvestigationTest;
const result = (values: InvestigationResult['values'], wnl = false) => ({ values, wnl }) as InvestigationResult;
const num = (key: string, label: string, unit: string) => ({ key, label, kind: 'number' as const, unit, min: 0, max: 999, range: null });

describe('investigation results', () => {
  it('shows one value bare, several with their labels, choices in words, and WNL', () => {
    expect(formatResult(test_([num('value', 'Hb', 'g/dL')]), result({ value: 9.4 }))).toBe('9.4');
    expect(formatResult(test_([num('sodium', 'Na', 'mmol/L'), num('potassium', 'K', 'mmol/L')]), result({ sodium: 140, potassium: 4.1 }))).toBe('Na 140 · K 4.1');
    const sugar = test_([num('value', 'Sugar', 'mg/dL'), { key: 'sample', label: 'Sample', kind: 'choice', options: ['FASTING'], range: null }]);
    expect(formatResult(sugar, result({ value: 110, sample: 'FASTING' }))).toBe('Sugar 110 · Fasting');
    const imaging = test_([{ key: 'study', label: 'Study', kind: 'text', maxLength: 100, range: null }]);
    expect(formatResult(imaging, result({ study: 'Chest X-ray' }, true))).toBe('WNL · Chest X-ray');
  });

  it('lists each unit once', () => {
    expect(testUnits(test_([num('a', 'A', '%'), num('b', 'B', '%')]))).toBe('%');
  });
});
