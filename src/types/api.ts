// Shapes returned by the Fit for Surgery REST API (backend/models + backend/controllers).
// Dates arrive as ISO strings. Populated references are typed as the populated object.

export type Id = string;
export type IsoDate = string;
export type Role = 'patient' | 'doctor' | 'admin';

export interface User {
  _id: Id;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  phone: string;
  isActive: boolean;
  lastLogin: IsoDate | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export type UserSummary = Pick<User, '_id' | 'firstName' | 'lastName'> & Partial<Pick<User, 'email' | 'phone'>>;

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
}

export interface PatientProfile {
  _id: Id;
  user: Id;
  dateOfBirth: IsoDate;
  gender: 'male' | 'female' | 'other';
  surgeryType: string;
  surgeryDate: IsoDate;
  hospitalNumber: string;
  assignedDoctor: UserSummary | null;
  emergencyContact: EmergencyContact;
  targetWeeklyExerciseMinutes: number;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  allergies: string[];
  currentMedications: (Medication | string)[];
  baselineMobility: string;
  smokingStatus: string;
  alcoholIntake: string;
  medicalConditions: string[];
  clinicalNotesSummary: string;
}

export interface DoctorProfile {
  _id: Id;
  user: Id;
  specialization: string;
  department: string;
  licenseNumber: string;
  hospitalAffiliation: string;
  consultationHours: string;
}

export type ExerciseCategory = 'walking' | 'strength' | 'breathing' | 'stretching' | 'cardio' | 'mobility' | 'pelvic_floor' | 'other';

export interface Exercise {
  _id: Id;
  title: string;
  description: string;
  category: ExerciseCategory;
  instructions: string[];
  videoUrl: string;
  defaultDurationMinutes: number;
  defaultReps: number;
  defaultSets: number;
  defaultFrequency: string;
  contraindications: string[];
  safetyNotes: string;
  isActive: boolean;
}

export interface ExerciseAssignment {
  _id: Id;
  patient: Id;
  doctor: UserSummary | null;
  exercise: Exercise | null;
  startDate: IsoDate;
  endDate: IsoDate | null;
  frequency: string;
  customizedDurationMinutes: number;
  customizedReps: number;
  customizedSets: number;
  customizedInstructions: string;
  status: 'active' | 'paused' | 'completed';
  createdAt: IsoDate;
  completedToday?: boolean;
}

export interface ExerciseSession {
  _id: Id;
  assignment: Id;
  exercise: Exercise | null;
  patient: Id;
  completedAt: IsoDate;
  status: 'completed' | 'partial' | 'skipped';
  durationMinutes: number;
  repetitionsCompleted: number;
  setsCompleted: number;
  perceivedExertion: number;
  patientFeedback: string;
}

export type MeasurementType =
  | 'blood_pressure'
  | 'pulse'
  | 'spo2'
  | 'temperature'
  | 'weight'
  | 'blood_sugar'
  | 'pain_score'
  | 'walking_minutes'
  | 'step_count'
  | 'sleep_hours'
  | 'water_intake'
  | 'mood'
  | 'nutrition_intake';

export interface HealthMeasurement {
  _id: Id;
  patient: Id;
  type: MeasurementType;
  systolic?: number;
  diastolic?: number;
  numericValue?: number;
  textValue?: string;
  unit: string;
  measuredAt: IsoDate;
  notes: string;
}

export type NoteType = 'preop_assessment' | 'progress_review' | 'exercise_adjustment' | 'general_consultation';

export interface ClinicalNote {
  _id: Id;
  patient: Id;
  doctor: UserSummary | null;
  noteType: NoteType;
  content: string;
  followUpInstructions: string;
  isConfidential: boolean;
  createdAt: IsoDate;
}

export type FollowUpStatus = 'scheduled' | 'completed' | 'cancelled';

export interface FollowUp {
  _id: Id;
  patient: Id | UserSummary;
  doctor: UserSummary | Id | null;
  scheduledDate: IsoDate;
  reason: string;
  status: FollowUpStatus;
  notes: string;
}

export interface AppNotification {
  _id: Id;
  title: string;
  message: string;
  type: 'exercise_assigned' | 'reminder' | 'measurement_due' | 'clinical_note' | 'system';
  isRead: boolean;
  link: string;
  createdAt: IsoDate;
}

export interface TimelineItem {
  id: string;
  type: 'exercise' | 'measurement' | 'clinical_note' | 'follow_up' | 'prescription';
  timestamp: IsoDate;
  title: string;
  description: string;
  badge?: string;
}

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'info';

export interface PatientAlert {
  id: string;
  patientId: Id;
  patientName: string;
  type: 'vital_critical' | 'vital_warning' | 'upcoming_surgery' | 'inactivity';
  severity: AlertSeverity;
  message: string;
  timestamp: IsoDate;
  value: string;
}

export interface AuditLog {
  _id: Id;
  userEmail: string;
  role: string;
  action: string;
  targetResource: string;
  targetId: string;
  details: Record<string, unknown>;
  timestamp: IsoDate;
}

// ---------- Response envelopes ----------

export interface Ok {
  success: true;
  message?: string;
}

export interface Paginated {
  total: number;
  page: number;
  totalPages: number;
}

export interface PatientListItem {
  user: User;
  profile: PatientProfile | null;
}

export interface MyProfileResponse extends Ok {
  user: User;
  profile: PatientProfile;
  daysUntilSurgery: number;
  isPreOp: boolean;
}

export interface PatientChartResponse extends Ok {
  patient: User;
  profile: PatientProfile | null;
  activeAssignments: ExerciseAssignment[];
  adherence: { totalActiveExercises: number; completedSessionsLast7Days: number };
  recentMeasurements: HealthMeasurement[];
}

export interface ReportSummary {
  totalExercisesAssigned?: number;
  totalSessionsLogged?: number;
  completedSessionsCount: number;
  totalMinutesLogged: number;
  totalMeasurementsRecorded?: number;
  totalMeasurements?: number;
  adherenceRate?: number;
}

export interface FullReport {
  generatedAt: IsoDate;
  patient: { id: Id; name: string; email: string; phone?: string };
  profile: PatientProfile | null;
  summary: ReportSummary;
  recentMeasurements: HealthMeasurement[];
  recentSessions: ExerciseSession[];
  assignments: ExerciseAssignment[];
}

export interface PeriodReport extends Ok {
  reportType: 'weekly' | 'monthly';
  period: string;
  patient: { id: Id; name: string; email: string };
  profile: PatientProfile | null;
  summary: ReportSummary;
  sessions: ExerciseSession[];
  measurements: HealthMeasurement[];
}

export interface ConsentStatusResponse extends Ok {
  consentStatus: Record<string, boolean>;
  isFullyConsented: boolean;
}

export interface Analytics {
  totalPatients: number;
  totalDoctors: number;
  totalActiveExercises: number;
  totalSessions: number;
  totalMeasurements: number;
  sessionsLast7Days: number;
  measurementsLast7Days: number;
}

/** Body of a 400 from the backend's zod `validate` middleware. */
export interface ValidationErrorBody {
  success: false;
  message: string;
  errors?: { field: string; message: string }[];
}
