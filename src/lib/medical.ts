import { splitList } from './format';
import type { MedicalFields, MedicalProfile } from '../types/api';

/** The medical profile as form strings. Lists are comma-separated (medications: one per line). */
export const EMPTY_MEDICAL_FORM = {
  dateOfBirth: '',
  sex: '',
  heightCm: '',
  bloodGroup: '',
  diagnosis: '',
  plannedSurgery: '',
  plannedSurgeryDate: '',
  comorbidities: '',
  allergies: '',
  medications: '',
  smokingStatus: '',
  ecName: '',
  ecRelation: '',
  ecPhone: '',
};
export type MedicalForm = typeof EMPTY_MEDICAL_FORM;

export const medicalToForm = (m: MedicalProfile): MedicalForm => ({
  dateOfBirth: m.dateOfBirth ?? '',
  sex: m.sex ?? '',
  heightCm: m.heightCm?.toString() ?? '',
  bloodGroup: m.bloodGroup ?? '',
  diagnosis: m.diagnosis ?? '',
  plannedSurgery: m.plannedSurgery ?? '',
  plannedSurgeryDate: m.plannedSurgeryDate ?? '',
  comorbidities: m.comorbidities?.join(', ') ?? '',
  allergies: m.allergies?.join(', ') ?? '',
  medications: m.medications?.join('\n') ?? '',
  smokingStatus: m.smokingStatus ?? '',
  ecName: m.emergencyContact?.name ?? '',
  ecRelation: m.emergencyContact?.relation ?? '',
  ecPhone: m.emergencyContact?.phone ?? '',
});

const orNull = (s: string) => s.trim() || null;
const listOrNull = (s: string, sep: string | RegExp = ',') => {
  const items = splitList(s, sep);
  return items.length ? items : null;
};

/** Form strings back to API fields; blanks become null, which clears them. */
export const formToMedical = (f: MedicalForm): MedicalFields => ({
  dateOfBirth: orNull(f.dateOfBirth),
  sex: (orNull(f.sex) as MedicalFields['sex']) ?? null,
  heightCm: f.heightCm.trim() ? Number(f.heightCm) : null,
  bloodGroup: (orNull(f.bloodGroup) as MedicalFields['bloodGroup']) ?? null,
  diagnosis: orNull(f.diagnosis),
  plannedSurgery: orNull(f.plannedSurgery),
  plannedSurgeryDate: orNull(f.plannedSurgeryDate),
  comorbidities: listOrNull(f.comorbidities),
  allergies: listOrNull(f.allergies),
  medications: listOrNull(f.medications, '\n'),
  smokingStatus: (orNull(f.smokingStatus) as MedicalFields['smokingStatus']) ?? null,
  emergencyContact: f.ecName.trim() ? { name: f.ecName.trim(), relation: f.ecRelation.trim(), phone: f.ecPhone.trim() } : null,
});

/** Only the fields that differ, so a PATCH never overwrites what it didn't change. */
export const medicalChanges = (before: MedicalFields, after: MedicalFields): Partial<MedicalFields> =>
  Object.fromEntries(Object.entries(after).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k as keyof MedicalFields])));
