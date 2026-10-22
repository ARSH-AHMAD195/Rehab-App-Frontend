import { api, type QueryParams } from './api';
import type {
  Analytics,
  AppNotification,
  AuditLog,
  ClinicalNote,
  ConsentStatusResponse,
  EmergencyContact,
  Exercise,
  ExerciseAssignment,
  ExerciseSession,
  FollowUp,
  FollowUpStatus,
  FullReport,
  HealthMeasurement,
  Id,
  MeasurementType,
  MyProfileResponse,
  NoteType,
  Ok,
  Paginated,
  PatientAlert,
  PatientChartResponse,
  PatientListItem,
  PatientProfile,
  PeriodReport,
  TimelineItem,
  User,
} from '../types/api';

export { authService } from './authService';

export const patientService = {
  getMyProfile: () => api.get<MyProfileResponse>('/patients/me'),
  updateMyProfile: (data: { phone?: string; emergencyContact?: EmergencyContact }) =>
    api.patch<Ok & { profile: PatientProfile }>('/patients/me', data),
  getMyTimeline: () => api.get<Ok & { timeline: TimelineItem[] }>('/patients/me/timeline'),
  getPatients: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<Ok & Paginated & { patients: PatientListItem[] }>('/patients', params),
  getPatientById: (id: Id) => api.get<PatientChartResponse>(`/patients/${id}`),
  getPatientTimeline: (id: Id) => api.get<Ok & { timeline: TimelineItem[] }>(`/patients/${id}/timeline`),
};

export const exerciseService = {
  getLibrary: (params?: { category?: string; search?: string; activeOnly?: string }) =>
    api.get<Ok & { exercises: Exercise[] }>('/exercises/library', params),
  createExercise: (data: Omit<Exercise, '_id' | 'isActive' | 'safetyNotes'> & { safetyNotes?: string }) =>
    api.post<Ok & { exercise: Exercise }>('/exercises', data),
  updateExercise: (id: Id, data: Partial<Exercise>) => api.patch<Ok & { exercise: Exercise }>(`/exercises/${id}`, data),
  deactivateExercise: (id: Id) => api.delete<Ok>(`/exercises/${id}`),
  getMyAssigned: () => api.get<Ok & { assignments: ExerciseAssignment[] }>('/exercises/assigned'),
  assignExercise: (data: {
    patientId: Id;
    exerciseId: Id;
    frequency: string;
    customizedDurationMinutes: number;
    customizedSets: number;
    customizedReps: number;
    customizedInstructions: string;
  }) => api.post<Ok & { assignment: ExerciseAssignment }>('/exercises/assign', data),
  logSession: (data: { assignmentId: Id; durationMinutes: number; perceivedExertion: number; patientFeedback: string; status: 'completed' }) =>
    api.post<Ok & { session: ExerciseSession }>('/exercise-sessions', data),
  getMySessions: (params: { days: number }) => api.get<Ok & { sessions: ExerciseSession[] }>('/exercise-sessions/me', params),
};

export interface NewMeasurement {
  type: MeasurementType;
  unit: string;
  notes: string;
  systolic?: number;
  diastolic?: number;
  numericValue?: number;
}

type MeasurementQuery = { type?: string; days?: number | 'all' };

export const healthService = {
  logMeasurement: (data: NewMeasurement) =>
    api.post<Ok & { measurement: HealthMeasurement; guidanceNotice: string | null }>('/health-measurements', data),
  getMyMeasurements: (params: MeasurementQuery) =>
    api.get<Ok & { measurements: HealthMeasurement[] }>('/health-measurements/me', params as QueryParams),
  getPatientMeasurements: (patientId: Id, params: MeasurementQuery) =>
    api.get<Ok & { measurements: HealthMeasurement[] }>(`/health-measurements/patient/${patientId}`, params as QueryParams),
};

export const reportService = {
  getMyReport: () => api.get<Ok & { report: FullReport }>('/reports/me'),
  getMyPeriodReport: (period: 'weekly' | 'monthly') => api.get<PeriodReport>(`/reports/${period}`),
  exportMyCsv: () => api.getBlob('/reports/me/csv'),
  exportPatientCsv: (id: Id) => api.getBlob(`/reports/patient/${id}/csv`),
};

export const clinicalNoteService = {
  createNote: (data: { patientId: Id; noteType: NoteType; content: string; followUpInstructions: string; isConfidential: boolean }) =>
    api.post<Ok & { note: ClinicalNote }>('/clinical-notes', data),
  getPatientNotes: (patientId: Id) => api.get<Ok & { notes: ClinicalNote[] }>(`/clinical-notes/patient/${patientId}`),
};

export const followUpService = {
  createFollowUp: (data: { patientId: Id; scheduledDate: string; reason: string; notes: string }) =>
    api.post<Ok & { followUp: FollowUp }>('/follow-ups', data),
  /** Patients: their own. (The backend ignores a patientId query; use getPatientFollowUps.) */
  getMyFollowUps: () => api.get<Ok & { followUps: FollowUp[] }>('/follow-ups'),
  getPatientFollowUps: (patientId: Id) => api.get<Ok & { followUps: FollowUp[] }>(`/follow-ups/patient/${patientId}`),
  updateStatus: (id: Id, status: FollowUpStatus) => api.patch<Ok & { followUp: FollowUp }>(`/follow-ups/${id}`, { status }),
};

export const notificationService = {
  getNotifications: () => api.get<Ok & { unreadCount: number; notifications: AppNotification[] }>('/notifications'),
  markAsRead: (id: Id) => api.patch<Ok>(`/notifications/${id}/read`),
  markAllRead: () => api.patch<Ok>('/notifications/read-all'),
};

export const adminService = {
  getAnalytics: () => api.get<Ok & { analytics: Analytics }>('/admin/analytics'),
  getAuditLogs: (params: { page: number; limit: number; action?: string }) =>
    api.get<Ok & Paginated & { logs: AuditLog[] }>('/admin/audit-logs', params),
  getUsers: (params: { role?: string; search?: string }) => api.get<Ok & { users: User[] }>('/admin/users', params),
  toggleUserStatus: (userId: Id) => api.patch<Ok & { user: User }>(`/admin/users/${userId}/toggle-status`),
};

export const doctorService = {
  getAlerts: () => api.get<Ok & { alerts: PatientAlert[] }>('/doctors/alerts'),
};

export const consentService = {
  getMyConsents: () => api.get<ConsentStatusResponse>('/consent'),
  recordConsents: (consents: { consentType: string; agreed: boolean }[]) => api.post<Ok>('/consent', { consents }),
};
