import type { ExerciseCategory, MeasurementType, NoteType, Role } from '../types/api';

export interface MeasurementConfig {
  value: MeasurementType;
  /** Plain-language name shown to patients; clinical term in brackets where useful. */
  label: string;
  /** Even shorter name for choice chips. */
  short?: string;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
}

// Mirrors the enums in backend/models. Ranges are client-side sanity limits to catch typos
// (e.g. oxygen "980") before they reach a patient's chart; the server remains the authority.
export const MEASUREMENT_TYPES: readonly MeasurementConfig[] = [
  { value: 'blood_pressure', label: 'Blood pressure', short: 'Blood pressure', unit: 'mmHg' },
  { value: 'pulse', label: 'Pulse (heart rate)', short: 'Pulse', unit: 'bpm', min: 20, max: 250 },
  { value: 'spo2', label: 'Oxygen level (SpO2)', short: 'Oxygen', unit: '%', min: 50, max: 100 },
  { value: 'pain_score', label: 'Pain score', short: 'Pain', unit: 'score 0-10', min: 0, max: 10 },
  { value: 'temperature', label: 'Temperature', unit: '°C', min: 30, max: 45, step: 0.1 },
  { value: 'weight', label: 'Weight', unit: 'kg', min: 20, max: 350, step: 0.1 },
  { value: 'blood_sugar', label: 'Blood sugar', unit: 'mg/dL', min: 20, max: 600 },
  { value: 'walking_minutes', label: 'Walking time', unit: 'minutes', min: 0, max: 600 },
  { value: 'step_count', label: 'Steps', unit: 'steps', min: 0, max: 100000 },
  { value: 'sleep_hours', label: 'Sleep', unit: 'hours', min: 0, max: 24, step: 0.5 },
  { value: 'water_intake', label: 'Water', unit: 'liters', min: 0, max: 15, step: 0.1 },
  { value: 'nutrition_intake', label: 'Food (calories)', unit: 'calories', min: 0, max: 10000 },
  { value: 'mood', label: 'Mood', unit: 'score 1-5', min: 1, max: 5 },
];

/** Shown as one-tap choices; everything else is under "Other". */
export const COMMON_VITAL_TYPES: readonly MeasurementType[] = ['blood_pressure', 'pulse', 'spo2', 'pain_score'];

export const QUICK_VITAL_TYPES: readonly MeasurementType[] = ['blood_pressure', 'pulse', 'spo2', 'pain_score', 'temperature', 'weight', 'step_count'];

// HealthMeasurement model limits (stricter than the route validator)
export const BP_LIMITS = { systolic: { min: 50, max: 260 }, diastolic: { min: 30, max: 160 } } as const;

export const measurementType = (value: string) => MEASUREMENT_TYPES.find((t) => t.value === value);

export const EXERCISE_CATEGORIES: readonly ExerciseCategory[] = ['walking', 'strength', 'breathing', 'stretching', 'cardio', 'mobility', 'pelvic_floor', 'other'];

export const FREQUENCIES = ['Daily', 'Twice Daily', '3x Daily', '3 times / week', '5 times / week'] as const;

export const NOTE_TYPES: readonly NoteType[] = ['progress_review', 'preop_assessment', 'exercise_adjustment', 'general_consultation'];

export const REQUIRED_CONSENTS = [
  {
    type: 'privacy_policy_acceptance',
    title: 'Platform Privacy Policy & Security Acknowledgement',
    text: 'I agree to the secure collection of my vitals and clinical health data in accordance with medical confidentiality standards.',
  },
  {
    type: 'prehab_program_agreement',
    title: 'Clinical Prehabilitation Program Agreement',
    text: 'I agree to follow the exercise protocols prescribed by my doctor to the best of my ability, and stop immediately if severe pain, shortness of breath, or dizziness occurs.',
  },
  {
    type: 'health_data_sharing',
    title: 'Health Data Sharing with Assigned Surgical Care Team',
    text: 'I authorize my recorded exercise adherence and daily health measurements to be shared with my assigned clinical prehab team and surgeons.',
  },
] as const;

export const AUDIT_ACTIONS: readonly [string, string][] = [
  ['USER_LOGIN', 'User Logins'],
  ['PATIENT_RECORD_VIEWED', 'Patient Record Views'],
  ['EXERCISE_SESSION_LOGGED', 'Exercise Sessions Logged'],
  ['HEALTH_MEASUREMENT_LOGGED', 'Health Vitals Logged'],
  ['EXERCISE_ASSIGNED_TO_PATIENT', 'Exercise Prescriptions'],
  ['CLINICAL_NOTE_CREATED', 'Clinical Notes Created'],
  ['PATIENT_MEASUREMENTS_EXPORTED_CSV', 'Vitals Exports'],
  ['PATIENT_PROFILE_UPDATED', 'Patient Profile Updates'],
  ['DOCTOR_ACCOUNT_CREATED', 'Doctor Accounts Created'],
  ['USER_DEACTIVATED', 'Accounts Deactivated'],
];

export const HOME_BY_ROLE: Record<Role, string> = {
  patient: '/patient/dashboard',
  doctor: '/doctor/dashboard',
  admin: '/admin/dashboard',
};

// Backend zod minimums (backend/validators/schemas.js), enforced client-side for inline errors
export const MIN = {
  name: 2,
  surgeryType: 3,
  password: 8,
  noteContent: 5,
  followUpReason: 3,
  exerciseTitle: 3,
  exerciseDescription: 5,
  licenseNumber: 3,
} as const;
