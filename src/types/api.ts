// Shapes returned by the three Fit for Surgery APIs (Auth, Health Monitoring, Exercise).
// Times are ISO strings with the patient's offset; dates are YYYY-MM-DD in the patient's time zone.

export type Id = string;
export type IsoDate = string;
/** Lower-cased on arrival (the API sends PATIENT / DOCTOR / ADMIN). */
export type Role = 'patient' | 'doctor' | 'admin';

/** Every list endpoint pages with an opaque cursor. */
export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

export interface Ref {
  id: Id;
  name: string;
}

// ---------- Auth API ----------

/** GET /auth/me */
export interface User {
  id: Id;
  role: Role;
  name: string;
  email: string | null;
  emailVerified: boolean;
  active: boolean;
  /** LOGIN_CODE: signed in with a doctor's code, so there's no email to verify. */
  loginMethod: 'PASSWORD' | 'LOGIN_CODE';
  /** Patients: true after a sign-in with a doctor's code, until they set a password. Not in the API yet. */
  mustSetPassword?: boolean;
}

/** GET /users/me/profile */
export interface Profile {
  id: Id;
  role: Role;
  name: string;
  email: string | null;
  phone: string | null;
  timeZone?: string | null;
  doctors?: Ref[];
  specialization?: string | null;
  createdAt: IsoDate | null;
  updatedAt: IsoDate | null;
}

export interface Patient {
  id: Id;
  name: string;
  email: string | null;
  phone: string | null;
  timeZone: string | null;
  active: boolean;
  emailVerified: boolean;
  doctors: Ref[];
  plannedSurgeryDate: IsoDate | null;
  /** Negative once surgery has passed */
  daysToSurgery: number | null;
  createdAt: IsoDate | null;
}

export interface Doctor {
  id: Id;
  name: string;
  email: string | null;
  phone: string | null;
  specialization: string | null;
  active: boolean;
  emailVerified: boolean;
  patientCount: number;
  createdAt: IsoDate | null;
}

/** NOT_NEEDED: no email was sent (a phone-only patient signs in with a code). */
export type InvitationStatus = 'SENT' | 'FAILED' | 'NOT_NEEDED';

/** Doctor patient lists: everyone, or only patients linked to me. */
export type PatientScope = 'all' | 'mine';

/** GET /doctor/login-code-requests: a patient asked for a sign-in code. */
export interface LoginCodeRequest {
  patient: Ref & { phone: string | null };
  requestedAt: IsoDate;
}

/** POST /patients/:id/login-code: the code to pass on to the patient. */
export interface LoginCode {
  code: string;
  expiresAt: IsoDate;
}

export const SEXES = ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'] as const;
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'] as const;
export const SMOKING_STATUSES = ['NEVER', 'FORMER', 'CURRENT'] as const;
export const CONDITIONS = ['HTN', 'DM', 'CKD', 'IHD', 'SMOKING', 'OTHER'] as const;
export type MedicalCondition = (typeof CONDITIONS)[number];
export const IHD_STATUSES = ['STABLE', 'SYMPTOMATIC_OR_RECENT_EVENT'] as const;

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface MedicalFields {
  dateOfBirth: string | null;
  sex: (typeof SEXES)[number] | null;
  heightCm: number | null;
  bloodGroup: (typeof BLOOD_GROUPS)[number] | null;
  diagnosis: string | null;
  plannedSurgery: string | null;
  plannedSurgeryDate: string | null;
  allergies: string[] | null;
  medications: string[] | null;
  smokingStatus: (typeof SMOKING_STATUSES)[number] | null;
  emergencyContact: EmergencyContact | null;
  /** The day the prehab programme starts (YYYY-MM-DD) */
  programmeStartDate: string | null;
  /** 1-365 */
  programmeLengthDays: number | null;
  /** The first weight, at onboarding: what later weight loss is measured against */
  onboardingWeightKg: number | null;
  /** Ticked condition boxes; OTHER's details are in otherConditions */
  conditions: MedicalCondition[] | null;
  otherConditions: string | null;
  chemotherapy: boolean | null;
  lastChemoDate: string | null;
  chemoSchedule: string | null;
  radiotherapy: boolean | null;
  anaemia: boolean | null;
  smokingQuitDate: string | null;
  hypertensionControlled: boolean | null;
  ihdStatus: (typeof IHD_STATUSES)[number] | null;
  /** True when they can't climb 2 flights of stairs */
  functionalCapacityUnder4Mets: boolean | null;
}

/** GET .../medical-profile. `version` is 0 until something is saved. */
export interface MedicalProfile extends MedicalFields {
  patientId: Id;
  /** Old free-text conditions, from before the checkboxes. Not edited here. */
  comorbidities: string[] | null;
  /** Worked out by the API; null while an input is missing */
  age: number | null;
  bmi: number | null;
  daysToSurgery: number | null;
  version: number;
  updatedAt: IsoDate | null;
  updatedBy: { id: Id; role: string } | null;
}

// ---------- Health Monitoring API ----------

export type VitalType = 'BP' | 'PULSE' | 'SPO2' | 'TEMP' | 'WEIGHT' | 'SUGAR' | 'PAIN' | 'WALK_MIN' | 'STEPS' | 'SLEEP_HRS' | 'NUTRITION' | 'WATER_ML' | 'MOOD';

export interface VitalTypeDef {
  type: VitalType;
  label: string;
  unit: string | null;
  valueKind: 'numeric' | 'pair' | 'scale' | 'text';
  minValid?: number;
  maxValid?: number;
  /** BP only */
  fields?: Record<'systolic' | 'diastolic', { minValid: number; maxValid: number }>;
  isOptional: boolean;
  onForm: boolean;
  version: number;
  integerOnly?: boolean;
  step?: number;
}

/** `{ num }`, `{ systolic, diastolic }` (BP) or `{ text }` (NUTRITION). */
export type ReadingValue = { num: number } | { systolic: number; diastolic: number } | { text: string };

export interface Reading {
  value: ReadingValue | null;
  unit: string | null;
  status: 'LOGGED' | 'NOT_YET';
  loggedAt: IsoDate | null;
  label?: string | null;
}

export interface DailyLog {
  date: string;
  timeZone: string;
  dayStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';
  filledCount: number;
  totalCount: number;
  readings: Record<VitalType, Reading>;
}

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface SavedAlert {
  id: Id;
  type: VitalType;
  field: string | null;
  rule: 'BELOW_LOW' | 'ABOVE_HIGH';
  threshold: number;
  severity: AlertSeverity;
  status: 'OPEN' | 'ACKNOWLEDGED';
}

export interface VitalAlert extends SavedAlert {
  patient: Ref;
  date: string;
  value: Record<string, unknown>;
  currentValue: Record<string, unknown> | null;
  createdAt: IsoDate;
  acknowledgedAt: IsoDate | null;
  note: string | null;
}

export type TrendPeriod = '7d' | '30d' | '90d';

export interface ThresholdPair {
  low: number | null;
  high: number | null;
}

export interface Trend {
  type: VitalType;
  unit: string | null;
  period: TrendPeriod;
  labels: string[];
  values?: (number | null)[];
  systolic?: (number | null)[];
  diastolic?: (number | null)[];
  thresholds: ThresholdPair | Record<string, ThresholdPair | null> | null;
}

// ---------- Investigations and triage (Health Monitoring API) ----------

export type InvestigationValue = { num: number } | { text: string } | { wnl: true } | { normal: boolean; text?: string } | { efPercent: number; text?: string };

export interface Investigation {
  id: Id;
  type: string;
  /** The day the test was done (YYYY-MM-DD) */
  date: string;
  value: InvestigationValue;
  /** Null until the hospital's normal ranges are set */
  outOfRange: boolean | null;
  createdAt: IsoDate;
}

export type TriageTag = 'HIGH' | 'MEDIUM' | 'LOW' | 'INCOMPLETE';

export interface Triage {
  tag: TriageTag;
  /** What met a High or Medium cut-off, in words */
  high: string[];
  medium: string[];
  /** What couldn't be judged yet */
  missing: string[];
  flags: { code: 'WEIGHT_LOSS' | 'MUST_RISE' | 'NO_LOGGING'; detail: string }[];
}

export interface CaseloadEntry {
  patient: Ref;
  plannedSurgeryDate: string | null;
  triage: Triage;
}

// ---------- Exercise API ----------

export interface Category {
  id: Id;
  code: string;
  name: string;
  order: number;
  active: boolean;
}

export interface Video {
  provider: 'YOUTUBE';
  videoId: string;
  url: string;
}

export interface Exercise {
  id: Id;
  name: string;
  categoryId: Id;
  /** Category code, e.g. STRENGTH */
  category: string;
  description: string | null;
  instructions: string[];
  video: Video | null;
  active: boolean;
  /** Who added it; null for exercises added before this was recorded */
  createdBy: { id: Id; role: 'ADMIN' | 'DOCTOR' } | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export type PlanExercise = Pick<Exercise, 'id' | 'name' | 'category' | 'description' | 'instructions' | 'video' | 'active'>;

export interface Target {
  sets: number | null;
  reps: number | null;
  durationMin: number | null;
}

export interface PlanItem {
  itemId: string;
  exercise: PlanExercise;
  /** 1 = Monday … 7 = Sunday */
  schedule: { daysOfWeek: number[]; timesPerDay: number };
  target: Target | null;
  notes: string | null;
}

/** `version` 0 = no plan yet. */
export interface Plan {
  patientId: Id;
  version: number;
  items: PlanItem[];
  assignedBy: Ref | null;
  updatedAt: IsoDate | null;
}

export interface ChecklistItem {
  itemId: string;
  exercise: PlanExercise;
  timesPerDay: number;
  doneCount: number;
  status: 'NOT_YET' | 'PARTLY_DONE' | 'DONE' | 'SKIPPED';
  completions: { id: Id; completedAt: IsoDate }[];
  /** Set when skipped that day; its id is what undo takes */
  skip: { id: Id; reason: string; skippedAt: IsoDate } | null;
  target: Target | null;
  notes: string | null;
}

export interface Checklist {
  date: string;
  planVersion: number;
  items: ChecklistItem[];
  doneCount: number;
  plannedCount: number;
  /** Planned times left undone because items were skipped */
  skippedCount: number;
}

export interface Completion {
  id: Id;
  itemId: string;
  exercise: { id: Id; name: string; category: string };
  planVersion: number;
  date: string;
  /** DONE = a tick; SKIPPED = skipped for the day, with a reason */
  status: 'DONE' | 'SKIPPED';
  reason: string | null;
  completedAt: IsoDate;
  details: { durationMin?: number | null; note?: string | null } | null;
}

export interface Compliance {
  from: string;
  to: string;
  planned: number;
  done: number;
  skipped: number;
  percentage: number | null;
  byDay: { date: string; planned: number; done: number; skipped: number }[];
  byExercise: { itemId: string; exerciseId: Id; name: string; planned: number; done: number; skipped: number }[];
}

export interface Counts {
  planned: number;
  done: number;
  skipped: number;
}

/** One row of GET /doctor/exercise-compliance: the range ends on the patient's today, so it includes today. */
export interface CaseloadRow extends Counts {
  patient: Ref;
  from: string;
  to: string;
  percentage: number | null;
  today: Counts;
  lastActivityAt: IsoDate | null;
}

// ---------- Errors ----------

/** Every API error: `{ statusCode, code, message, requestId, details? }`. */
export interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  requestId?: string;
  details?: { field: string; code: string; issue: string }[];
}
