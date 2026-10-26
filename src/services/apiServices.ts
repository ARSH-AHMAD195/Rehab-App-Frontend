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
  getMyProfile: () =>
    api.get('/users/me/profile'),

  updateMyProfile: (data: {
    name?: string;
    timeZone?: string;
  }) =>
    api.patch('/users/me/profile', data),

  getPatients: (params?: {
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    api.get('/patients', params),
};

export const exerciseService = {
  getLibrary: (params?: {
    category?: string;
    search?: string;
  }) =>
    api.get('/exercises', params),

  getMyPlan: () =>
    api.get('/patients/me/exercise-plan'),

  getMyChecklist: () =>
    api.get('/patients/me/exercise-checklist'),

  getMyCompletions: () =>
    api.get('/patients/me/exercise-completions'),

  completeExercise: (data: Record<string, unknown>) =>
    api.post('/exercise-completions', data),
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
  getMyTodayVitals: () =>
    api.get('/me/vitals/today'),

  getMyVitalLogs: (params?: QueryParams) =>
    api.get('/me/vitals/logs', params),

  getMyVitalTrends: (params?: QueryParams) =>
    api.get('/me/vitals/trends', params),
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
  getAlerts: () =>
    api.get('/doctor/alerts'),
};

export const consentService = {
  getMyConsents: () => api.get<ConsentStatusResponse>('/consent'),
  recordConsents: (consents: { consentType: string; agreed: boolean }[]) => api.post<Ok>('/consent', { consents }),
};


