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
}

/** GET /users/me/profile */
export interface Profile {
  id: Id;
  role: Role;
  name: string;
  email: string | null;
  phone: string | null;
  /** The app language, kept on the account so it follows the patient to another phone */
  preferredLanguage: 'en' | 'hi';
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
  /** Worked out on every read; GET /patients/:id/triage gives the reasons */
  triage: TriageSummary;
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

/** GET /doctor/login-code-requests: a patient asked for a sign-in code. Any doctor can answer; mine come first. */
export interface LoginCodeRequest {
  patient: Ref & { phone: string | null };
  requestedAt: IsoDate;
  /** Linked to the signed-in doctor */
  myPatient: boolean;
}

/** POST /patients/:id/login-code: the code to pass on to the patient. */
export interface LoginCode {
  patientId: Id;
  phone: string | null;
  code: string;
  expiresAt: IsoDate;
  expiresInMinutes: number;
  maxAttempts: number;
}

export const SEXES = ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED'] as const;
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'] as const;
export const SMOKING_STATUSES = ['NEVER', 'FORMER', 'CURRENT'] as const;
export const CONDITIONS = ['HTN', 'DM', 'CKD', 'IHD', 'SMOKING', 'OTHER'] as const;
export type MedicalCondition = (typeof CONDITIONS)[number];
export const IHD_STATUSES = ['STABLE', 'SYMPTOMATIC'] as const;

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
  hypertensionOnMedication: boolean | null;
  ihdStatus: (typeof IHD_STATUSES)[number] | null;
  /** The last heart attack (MI) or stent */
  lastMiOrStentDate: string | null;
  /** True = can climb 2 flights of stairs (4+ METs) */
  canClimbTwoFlights: boolean | null;
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
  /** Doctors only: the API leaves it out entirely for the patient. Up to 2000 characters. */
  clinicalNotes?: string | null;
  version: number;
  updatedAt: IsoDate | null;
  updatedBy: { id: Id; role: string } | null;
}

// ---------- Health Monitoring API ----------

export type VitalType = 'BP' | 'PULSE' | 'SPO2' | 'TEMP' | 'WEIGHT' | 'SUGAR' | 'PAIN' | 'WALK_MIN' | 'STEPS' | 'SLEEP_HRS' | 'NUTRITION' | 'WATER_ML' | 'MOOD';

export interface VitalTypeDef {
  type: VitalType;
  label: string;
  /** Hindi label; null until filled in */
  labelHi: string | null;
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

/** GET /admin/alert-thresholds: the current version of one limit (patientId null = global). */
export interface AlertThreshold {
  id: Id;
  type: VitalType;
  field: 'systolic' | 'diastolic' | null;
  low: number | null;
  high: number | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  patientId: Id | null;
  version: number;
  effectiveFrom: string;
  updatedBy: string;
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

// ---------- Investigations, triage and care-team alerts (Auth API) ----------

export type InvestigationGroup = 'HAEMATOLOGY' | 'BIOCHEMISTRY' | 'CARDIAC_RESPIRATORY_IMAGING' | 'NUTRITION_SCREENING';

/** One input of a test. `range` is the approved normal range (number fields), null until the clinic sets it. */
export type InvestigationField = { key: string; label: string; required?: boolean; range: { low: number | null; high: number | null } | null } & (
  | { kind: 'number'; unit: string; min: number; max: number; integer?: boolean }
  | { kind: 'text'; maxLength: number; /** Still asked for when WNL is ticked */ alsoWithWnl?: boolean }
  | { kind: 'choice'; options: string[]; abnormal?: string[] }
);

/** GET /investigation-tests */
export interface InvestigationTest {
  code: string;
  label: string;
  group: InvestigationGroup;
  fields: InvestigationField[];
  /** "Within normal limits" can be entered instead of values */
  allowWnl: boolean;
  feedsTriage: boolean;
  note?: string;
}

export interface InvestigationResult {
  id: Id;
  test: string;
  /** The day the test was done (YYYY-MM-DD) */
  takenOn: string;
  values: Record<string, number | string>;
  wnl: boolean;
  comment: string | null;
  /** Only fields outside an approved range */
  flags: Record<string, 'LOW' | 'HIGH' | 'ABNORMAL'>;
  outOfRange: boolean;
  status: 'ACTIVE' | 'RETRACTED';
  enteredBy: { id: Id; role: string };
  enteredAt: IsoDate | null;
  retraction: { reason: string; by: { id: Id; role: string }; at: IsoDate | null } | null;
}

/** GET /patients/:id/investigations → { patientId, tests }. Results newest first. */
export interface InvestigationGridRow {
  test: string;
  label: string;
  group: InvestigationGroup;
  results: InvestigationResult[];
}

export type TriageTag = 'HIGH' | 'MEDIUM' | 'LOW';

/** On every Patient. */
export interface TriageSummary {
  tag: TriageTag;
  /** True until the clinical team confirms the rules */
  provisional: boolean;
  /** False when an input was missing */
  complete: boolean;
}

/** GET /patients/:id/triage */
export interface Triage extends TriageSummary {
  patientId: Id;
  /** High first */
  reasons: { parameter: string; level: 'HIGH' | 'MEDIUM'; explanation: string; date: string | null }[];
  missing: { parameter: string; needs: string }[];
  rulesVersion: number;
  evaluatedOn: string;
}

export type CareAlertKind = 'HIGH_VALUE' | 'WEIGHT_LOSS' | 'MUST_RISE' | 'NO_LOGGING' | 'NUTRITION_LOW';

/** GET /doctor/care-alerts. `message` is written for the doctor. */
export interface CareAlert {
  id: Id;
  patient: Ref;
  kind: CareAlertKind;
  message: string;
  details: Record<string, unknown>;
  status: 'OPEN' | 'ACKNOWLEDGED';
  createdAt: IsoDate | null;
  acknowledgedBy: string | null;
  acknowledgedAt: IsoDate | null;
  note: string | null;
}

// ---------- Nutrition (Health Monitoring API) ----------

/** `hi` is null until the clinic sends Hindi. */
export interface BiText {
  en: string;
  hi: string | null;
}

export interface FoodOption {
  code: string;
  label: BiText;
  quantity: string;
  kind: 'OPTION' | 'ADDON';
}

export interface MealSlot {
  code: string;
  label: BiText;
  /** Local time, e.g. "12:30-13:30" */
  window: string;
  kcal: number;
  proteinG: number;
  options: FoodOption[];
}

export interface DietTargets {
  kcal: number;
  proteinG: number;
}

/** `version` 0 = still the hospital chart. */
export interface DietPlan {
  patientId: Id;
  dietType: string;
  dietLabel: BiText;
  targets: DietTargets;
  slots: MealSlot[];
  version: number;
  updatedAt: IsoDate | null;
  updatedBy: { id: Id; role: string } | null;
}

export interface MealTotals {
  kcal: number;
  proteinG: number;
  slotsEaten: number;
}

/** A slot counts its full calories and protein once anything in it is ticked. */
export interface MealDay {
  date: string;
  timeZone: string;
  dietType: string;
  dietLabel: BiText;
  targets: DietTargets;
  totals: MealTotals;
  /** Whole percent of each target */
  percent: { kcal: number | null; protein: number | null };
  planVersion: number;
  slots: (Omit<MealSlot, 'options'> & { eaten: boolean; options: (FoodOption & { ticked: boolean })[]; loggedAt: IsoDate | null })[];
}

export interface MealHistoryDay {
  date: string;
  logged: boolean;
  totals: MealTotals | null;
  targets: DietTargets | null;
  percent: { kcal: number | null; protein: number | null } | null;
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
  /** Hindi text; each part falls back to English when empty */
  hi: ExerciseHindi | null;
  /** Incentive spirometry: ask for the volume reached (mL) with each tick */
  recordsVolume: boolean;
  video: Video | null;
  active: boolean;
  /** Who added it; null for exercises added before this was recorded */
  createdBy: { id: Id; role: 'ADMIN' | 'DOCTOR' } | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface ExerciseHindi {
  name: string | null;
  description: string | null;
  instructions: string[];
}

export type PlanExercise = Pick<Exercise, 'id' | 'name' | 'category' | 'description' | 'instructions' | 'hi' | 'recordsVolume' | 'video' | 'active'>;

export interface Target {
  sets: number | null;
  reps: number | null;
  durationMin: number | null;
  /** Incentive spirometry, mL */
  volumeMl: number | null;
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
  details: { durationMin?: number | null; note?: string | null; volumeMl?: number | null } | null;
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
