import { splitList } from './format';
import { normalizePhone } from './phoneLogin';
import type { MedicalCondition, MedicalFields, MedicalProfile } from '../types/api';

/** The conditions with a checkbox. The form keeps them by `value`; the API stores `code` in `conditions`. */
export const COMORBIDITIES = [
  { code: 'HTN', value: 'Hypertension', label: 'Hypertension (HTN)' },
  { code: 'DM', value: 'Diabetes', label: 'Diabetes (DM)' },
  { code: 'CKD', value: 'Chronic kidney disease', label: 'Chronic kidney disease (CKD)' },
  { code: 'IHD', value: 'Ischaemic heart disease', label: 'Ischaemic heart disease (IHD)' },
] as const;

/** Conditions in words for display: the ticked ones, then whatever was typed under "Other". */
export const conditionNames = (m: Pick<MedicalFields, 'conditions' | 'otherConditions'>): string[] => [
  ...COMORBIDITIES.filter((c) => m.conditions?.includes(c.code)).map((c) => c.value),
  ...(m.otherConditions ? [m.otherConditions] : []),
];

const sameCondition = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const isListedCondition = (item: string) => COMORBIDITIES.some((c) => sameCondition(c.value, item));

export const hasCondition = (ticked: string, condition: string) => splitList(ticked).some((item) => sameCondition(item, condition));

/** The ticked list with `condition` added or removed. */
export const setCondition = (ticked: string, condition: string, on: boolean) =>
  [...splitList(ticked).filter((item) => !sameCondition(item, condition)), ...(on ? [condition] : [])].join(', ');

/** The medical profile as form strings. Lists are comma-separated (medications: one per line). */
export const EMPTY_MEDICAL_FORM = {
  dateOfBirth: '',
  sex: '',
  heightCm: '',
  bloodGroup: '',
  diagnosis: '',
  plannedSurgery: '',
  plannedSurgeryDate: '',
  /** The ticked conditions */
  comorbidities: '',
  /** Anything else, typed */
  otherComorbidities: '',
  allergies: '',
  medications: '',
  smokingStatus: '',
  ecName: '',
  ecRelation: '',
  ecPhone: '',
  programmeStartDate: '',
  programmeLengthDays: '',
  onboardingWeightKg: '',
  // Yes/no fields: '', 'true' or 'false'
  chemotherapy: '',
  lastChemoDate: '',
  chemoSchedule: '',
  radiotherapy: '',
  anaemia: '',
  smokingQuitDate: '',
  hypertensionOnMedication: '',
  ihdStatus: '',
  lastMiOrStentDate: '',
  canClimbTwoFlights: '',
};
export type MedicalForm = typeof EMPTY_MEDICAL_FORM;

const yesNoToForm = (value: boolean | null | undefined) => (value === null || value === undefined ? '' : String(value));
const yesNoFromForm = (value: string) => (value === '' ? null : value === 'true');

/** kg/m², to one decimal place; null until both are known. */
export const bmi = (heightCm: number | null, weightKg: number | null) =>
  heightCm && weightKg ? Math.round((weightKg / (heightCm / 100) ** 2) * 10) / 10 : null;

export const medicalToForm = (m: MedicalProfile): MedicalForm => ({
  dateOfBirth: m.dateOfBirth ?? '',
  sex: m.sex ?? '',
  heightCm: m.heightCm?.toString() ?? '',
  bloodGroup: m.bloodGroup ?? '',
  diagnosis: m.diagnosis ?? '',
  plannedSurgery: m.plannedSurgery ?? '',
  plannedSurgeryDate: m.plannedSurgeryDate ?? '',
  comorbidities: COMORBIDITIES.filter((c) => m.conditions?.includes(c.code)).map((c) => c.value).join(', '),
  otherComorbidities: m.otherConditions ?? '',
  allergies: m.allergies?.join(', ') ?? '',
  medications: m.medications?.join('\n') ?? '',
  smokingStatus: m.smokingStatus ?? '',
  ecName: m.emergencyContact?.name ?? '',
  ecRelation: m.emergencyContact?.relation ?? '',
  ecPhone: normalizePhone(m.emergencyContact?.phone ?? ''),
  programmeStartDate: m.programmeStartDate ?? '',
  programmeLengthDays: m.programmeLengthDays?.toString() ?? '',
  onboardingWeightKg: m.onboardingWeightKg?.toString() ?? '',
  chemotherapy: yesNoToForm(m.chemotherapy),
  lastChemoDate: m.lastChemoDate ?? '',
  chemoSchedule: m.chemoSchedule ?? '',
  radiotherapy: yesNoToForm(m.radiotherapy),
  anaemia: yesNoToForm(m.anaemia),
  smokingQuitDate: m.smokingQuitDate ?? '',
  hypertensionOnMedication: yesNoToForm(m.hypertensionOnMedication),
  ihdStatus: m.ihdStatus ?? '',
  lastMiOrStentDate: m.lastMiOrStentDate ?? '',
  canClimbTwoFlights: yesNoToForm(m.canClimbTwoFlights),
});

const orNull = (s: string) => s.trim() || null;
const listOrNull = (s: string, sep: string | RegExp = ',') => {
  const items = splitList(s, sep);
  return items.length ? items : null;
};

const conditionsFromForm = (f: MedicalForm): Pick<MedicalFields, 'conditions' | 'otherConditions'> => {
  const codes: MedicalCondition[] = COMORBIDITIES.filter((c) => hasCondition(f.comorbidities, c.value)).map((c) => c.code);
  const other = orNull(f.otherComorbidities);
  if (other) codes.push('OTHER');
  return { conditions: codes.length ? codes : null, otherConditions: other };
};

/** Form strings back to API fields; blanks become null, which clears them. So do follow-up fields whose question is hidden. */
export const formToMedical = (f: MedicalForm): MedicalFields => ({
  dateOfBirth: orNull(f.dateOfBirth),
  sex: (orNull(f.sex) as MedicalFields['sex']) ?? null,
  heightCm: f.heightCm.trim() ? Number(f.heightCm) : null,
  bloodGroup: (orNull(f.bloodGroup) as MedicalFields['bloodGroup']) ?? null,
  diagnosis: orNull(f.diagnosis),
  plannedSurgery: orNull(f.plannedSurgery),
  plannedSurgeryDate: orNull(f.plannedSurgeryDate),
  ...conditionsFromForm(f),
  allergies: listOrNull(f.allergies),
  medications: listOrNull(f.medications, '\n'),
  smokingStatus: (orNull(f.smokingStatus) as MedicalFields['smokingStatus']) ?? null,
  emergencyContact: f.ecName.trim() ? { name: f.ecName.trim(), relation: f.ecRelation.trim(), phone: f.ecPhone.trim() } : null,
  programmeStartDate: orNull(f.programmeStartDate),
  programmeLengthDays: f.programmeLengthDays.trim() ? Number(f.programmeLengthDays) : null,
  onboardingWeightKg: f.onboardingWeightKg.trim() ? Number(f.onboardingWeightKg) : null,
  chemotherapy: yesNoFromForm(f.chemotherapy),
  lastChemoDate: f.chemotherapy === 'true' ? orNull(f.lastChemoDate) : null,
  chemoSchedule: f.chemotherapy === 'true' ? orNull(f.chemoSchedule) : null,
  radiotherapy: yesNoFromForm(f.radiotherapy),
  anaemia: yesNoFromForm(f.anaemia),
  smokingQuitDate: f.smokingStatus === 'FORMER' ? orNull(f.smokingQuitDate) : null,
  hypertensionOnMedication: hasCondition(f.comorbidities, 'Hypertension') ? yesNoFromForm(f.hypertensionOnMedication) : null,
  ihdStatus: hasCondition(f.comorbidities, 'Ischaemic heart disease') ? ((orNull(f.ihdStatus) as MedicalFields['ihdStatus']) ?? null) : null,
  lastMiOrStentDate: hasCondition(f.comorbidities, 'Ischaemic heart disease') ? orNull(f.lastMiOrStentDate) : null,
  canClimbTwoFlights: yesNoFromForm(f.canClimbTwoFlights),
});

/** Conditions typed into "Other conditions" that have a checkbox, ticked instead, so their follow-up questions show. */
export const foldListedConditions = (f: MedicalForm): MedicalForm => {
  const typed = splitList(f.otherComorbidities);
  const listed = COMORBIDITIES.filter((c) => typed.some((t) => sameCondition(t, c.value)));
  if (!listed.length) return f;
  return {
    ...f,
    comorbidities: listed.reduce((ticked, c) => setCondition(ticked, c.value, true), f.comorbidities),
    otherComorbidities: typed.filter((t) => !isListedCondition(t)).join(', '),
  };
};

/** Lists compare in any order. */
const comparable = (value: unknown) => JSON.stringify(Array.isArray(value) ? [...value].sort() : (value ?? null));

/** Only the fields that differ, so a PATCH never overwrites what it didn't change. A field the API didn't return counts as empty. */
export const medicalChanges = (before: MedicalFields, after: MedicalFields): Partial<MedicalFields> =>
  Object.fromEntries(Object.entries(after).filter(([k, v]) => comparable(v) !== comparable(before[k as keyof MedicalFields])));
