import { labelize } from './format';
import type { InvestigationGroup, InvestigationResult, InvestigationTest } from '../types/api';

export const GROUP_TITLES: Record<InvestigationGroup, string> = {
  HAEMATOLOGY: 'Haematology',
  BIOCHEMISTRY: 'Biochemistry',
  CARDIAC_RESPIRATORY_IMAGING: 'Cardiac, respiratory and imaging',
  NUTRITION_SCREENING: 'Nutrition score',
};

/** The units of a test's number fields, for the row heading: "g/dL", "seconds, ratio". */
export const testUnits = (test: InvestigationTest) => [...new Set(test.fields.flatMap((f) => (f.kind === 'number' ? [f.unit] : [])))].join(', ');

/** One result as text: "9.4", "WNL", "110 · Fasting", "Na 140 · K 4.1", "WNL · Chest X-ray". */
export const formatResult = (test: InvestigationTest | undefined, result: InvestigationResult) => {
  const fields = test?.fields ?? Object.keys(result.values).map((key) => ({ key, label: key, kind: 'text' as const }));
  const parts = fields.flatMap((f) => {
    const value = result.values[f.key];
    if (value === undefined || value === '') return [];
    const text = f.kind === 'choice' ? labelize(String(value)) : String(value);
    return [fields.length > 1 && f.kind === 'number' ? `${f.label} ${text}` : text];
  });
  return [...(result.wnl ? ['WNL'] : []), ...parts].join(' · ');
};
