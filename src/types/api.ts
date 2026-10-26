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

export type InvitationStatus = 'SENT' | 'FAILED';

export const SEXES = ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'] as const;
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'] as const;
export const SMOKING_STATUSES = ['NEVER', 'FORMER', 'CURRENT'] as const;

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
  comorbidities: string[] | null;
  allergies: string[] | null;
  medications: string[] | null;
  smokingStatus: (typeof SMOKING_STATUSES)[number] | null;
  emergencyContact: EmergencyContact | null;
}

/** GET .../medical-profile. `version` is 0 until something is saved. */
export interface MedicalProfile extends MedicalFields {
  patientId: Id;
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
  status: 'NOT_YET' | 'PARTLY_DONE' | 'DONE';
  completions: { id: Id; completedAt: IsoDate }[];
  target: Target | null;
  notes: string | null;
}

export interface Checklist {
  date: string;
  planVersion: number;
  items: ChecklistItem[];
  doneCount: number;
  plannedCount: number;
}

export interface Completion {
  id: Id;
  itemId: string;
  exercise: { id: Id; name: string; category: string };
  planVersion: number;
  date: string;
  completedAt: IsoDate;
  details: { durationMin?: number | null; note?: string | null } | null;
}

export interface Compliance {
  from: string;
  to: string;
  planned: number;
  done: number;
  percentage: number | null;
  byDay: { date: string; planned: number; done: number }[];
  byExercise: { itemId: string; exerciseId: Id; name: string; planned: number; done: number }[];
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
