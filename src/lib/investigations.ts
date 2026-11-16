import type { InvestigationValue } from '../types/api';

export type InvestigationKind = 'num' | 'text' | 'wnlOrText' | 'ecg' | 'echo';

export interface InvestigationDef {
  type: string;
  label: string;
  unit?: string;
  kind: InvestigationKind;
}

/** The PAC form's investigation grid. Types and kinds match the Health API's investigation-types.ts. */
export const INVESTIGATION_SECTIONS: { title: string; items: InvestigationDef[] }[] = [
  {
    title: 'Haematology',
    items: [
      { type: 'HB', label: 'Haemoglobin (Hb)', unit: 'g/dL', kind: 'num' },
      { type: 'TLC', label: 'TLC', unit: '×10³/µL', kind: 'num' },
      { type: 'DLC', label: 'DLC', unit: '%', kind: 'text' },
      { type: 'PLATELETS', label: 'Platelets', unit: '×10³/µL', kind: 'num' },
      { type: 'PT', label: 'PT', unit: 'seconds', kind: 'num' },
      { type: 'INR', label: 'INR', unit: 'ratio', kind: 'num' },
    ],
  },
  {
    title: 'Biochemistry',
    items: [
      { type: 'SUGAR_FASTING', label: 'Blood sugar, fasting', unit: 'mg/dL', kind: 'num' },
      { type: 'SUGAR_RANDOM', label: 'Blood sugar, random', unit: 'mg/dL', kind: 'num' },
      { type: 'HBA1C', label: 'HbA1c', unit: '%', kind: 'num' },
      { type: 'UREA', label: 'Blood urea', unit: 'mg/dL', kind: 'num' },
      { type: 'CREATININE', label: 'Serum creatinine', unit: 'mg/dL', kind: 'num' },
      { type: 'NA', label: 'Sodium (Na)', unit: 'mmol/L', kind: 'num' },
      { type: 'K', label: 'Potassium (K)', unit: 'mmol/L', kind: 'num' },
      { type: 'CL', label: 'Chloride (Cl)', unit: 'mmol/L', kind: 'num' },
      { type: 'LFT', label: 'LFT', kind: 'wnlOrText' },
      { type: 'ALBUMIN', label: 'Serum albumin', unit: 'g/dL', kind: 'num' },
      { type: 'TFT', label: 'TFT', kind: 'wnlOrText' },
      { type: 'ABG', label: 'ABG', kind: 'text' },
    ],
  },
  {
    title: 'Cardiac, respiratory and imaging',
    items: [
      { type: 'ECG', label: 'ECG', kind: 'ecg' },
      { type: 'ECHO', label: '2D-Echo', unit: 'EF %', kind: 'echo' },
      { type: 'PFT', label: 'PFT', kind: 'text' },
      { type: 'IMAGING', label: 'Chest X-ray / other imaging', kind: 'wnlOrText' },
    ],
  },
  {
    title: 'Nutrition score',
    items: [
      { type: 'MUST', label: 'MUST', kind: 'num' },
      { type: 'PG_SGA', label: 'PG-SGA', kind: 'num' },
    ],
  },
];

/** One result as text: "12.1", "WNL", "Abnormal: ST changes", "EF 55%: mild LVH". */
export const formatInvestigation = (value: InvestigationValue) => {
  if ('num' in value) return String(value.num);
  if ('wnl' in value) return 'WNL';
  if ('normal' in value) return [value.normal ? 'Normal' : 'Abnormal', value.text].filter(Boolean).join(': ');
  if ('efPercent' in value) return [`EF ${value.efPercent}%`, value.text].filter(Boolean).join(': ');
  return value.text;
};
