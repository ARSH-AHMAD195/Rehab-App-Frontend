import { api, type QueryParams } from './api';
import type {
  Category,
  Checklist,
  Completion,
  Compliance,
  DailyLog,
  Doctor,
  Exercise,
  Id,
  InvitationStatus,
  MedicalFields,
  MedicalProfile,
  Page,
  Patient,
  Plan,
  Profile,
  SavedAlert,
  Target,
  Trend,
  TrendPeriod,
  VitalAlert,
  VitalType,
  VitalTypeDef,
  ReadingValue,
} from '../types/api';

export { authService } from './authService';

type ListParams = { q?: string; active?: 'true' | 'false' | 'all'; limit?: number; cursor?: string };
type Range = { from?: string; to?: string };
type Paged = { limit?: number; cursor?: string };
export type MedicalUpdate = Partial<MedicalFields> & { version: number };

// ---------- Auth API ----------

export const profileService = {
  getMine: () => api.get<Profile>('/users/me/profile'),
  updateMine: (data: { name?: string; phone?: string | null; timeZone?: string; specialization?: string | null }) =>
    api.patch<Profile>('/users/me/profile', data),
  getMyMedical: () => api.get<MedicalProfile>('/patients/me/medical-profile'),
  updateMyMedical: (data: MedicalUpdate) => api.patch<MedicalProfile>('/patients/me/medical-profile', data),
};

export const patientService = {
  /** Doctor: linked patients only (their own id is linked automatically). Admin: doctorIds required. */
  register: (data: { name: string; email: string; phone?: string | null; timeZone?: string; doctorIds?: Id[] }) =>
    api.post<Patient & { invitation: InvitationStatus }>('/patients', data),
  list: (params: ListParams & { doctorId?: Id } = {}) => api.get<Page<Patient>>('/patients', params),
  get: (id: Id) => api.get<Patient>(`/patients/${id}`),
  /** `active` is admin-only. */
  update: (id: Id, data: { name?: string; phone?: string | null; timeZone?: string; active?: boolean }) =>
    api.patch<Patient>(`/patients/${id}`, data),
  setDoctors: (id: Id, doctorIds: Id[]) => api.put<Patient>(`/patients/${id}/doctors`, { doctorIds }),
  getMedical: (id: Id) => api.get<MedicalProfile>(`/patients/${id}/medical-profile`),
  updateMedical: (id: Id, data: MedicalUpdate) => api.patch<MedicalProfile>(`/patients/${id}/medical-profile`, data),
};

export const doctorService = {
  register: (data: { name: string; email: string; phone?: string | null; specialization?: string | null }) =>
    api.post<Doctor & { invitation: InvitationStatus }>('/doctors', data),
  list: (params: ListParams = {}) => api.get<Page<Doctor>>('/doctors', params),
  get: (id: Id) => api.get<Doctor>(`/doctors/${id}`),
  update: (id: Id, data: { name?: string; phone?: string | null; specialization?: string | null; active?: boolean }) =>
    api.patch<Doctor>(`/doctors/${id}`, data),
};

export const adminService = {
  registerAdmin: (data: { name: string; email: string; phone?: string | null }) =>
    api.post<{ id: Id; invitation: InvitationStatus }>('/admins', data),
  getThresholds: (params: Paged & { type?: VitalType; patientId?: Id } = {}) => api.get<Page<unknown>>('/admin/alert-thresholds', params),
  setThreshold: (type: VitalType, data: Record<string, unknown>) => api.put<unknown>(`/admin/alert-thresholds/${type}`, data),
  updateVitalType: (type: VitalType, data: Record<string, unknown>) => api.put<VitalTypeDef>(`/admin/vital-types/${type}`, data),
};

/** Sends the set-password email again (also works as a password reset). */
export const resendInvitation = (userId: Id) => api.post<{ invitation: InvitationStatus }>(`/users/${userId}/invitations`);

// ---------- Health Monitoring API ----------

export type ReadingChanges = Partial<Record<VitalType, ReadingValue | null>>;

export const vitalsService = {
  getTypes: () => api.get<{ data: VitalTypeDef[] }>('/vital-types').then((r) => r.data),
  getToday: () => api.get<DailyLog>('/me/vitals/today'),
  /** Send only changed readings; null clears one. `date` is the day the form was opened for. */
  saveToday: (date: string, readings: ReadingChanges, idempotencyKey = crypto.randomUUID()) =>
    api.put<DailyLog & { alerts: SavedAlert[] }>('/me/vitals/today', { date, readings }, idempotencyKey),
  getLogs: (params: Range & Paged = {}) => api.get<Page<DailyLog>>('/me/vitals/logs', params),
  getTrend: (type: VitalType, period: TrendPeriod) => api.get<Trend>('/me/vitals/trends', { type, period }),
  getPatientToday: (patientId: Id) => api.get<DailyLog>(`/doctor/patients/${patientId}/vitals/today`),
  getPatientLogs: (patientId: Id, params: Range & Paged = {}) => api.get<Page<DailyLog>>(`/doctor/patients/${patientId}/vitals/logs`, params),
  getPatientTrend: (patientId: Id, type: VitalType, period: TrendPeriod) =>
    api.get<Trend>(`/doctor/patients/${patientId}/vitals/trends`, { type, period }),
};

export const alertService = {
  list: (params: Paged & { status?: 'OPEN' | 'ACKNOWLEDGED'; patientId?: Id } = {}) => api.get<Page<VitalAlert>>('/doctor/alerts', params),
  acknowledge: (id: Id, note?: string) => api.patch<VitalAlert>(`/doctor/alerts/${id}`, { status: 'ACKNOWLEDGED', note: note || undefined }),
};

// ---------- Exercise API ----------

export interface ExerciseInput {
  name?: string;
  categoryId?: Id;
  description?: string | null;
  instructions?: string[];
  /** Any YouTube link (Unlisted or Public, embedding allowed); null removes it. */
  videoUrl?: string | null;
  active?: boolean;
}

export interface PlanItemInput {
  exerciseId: Id;
  schedule: { daysOfWeek: number[]; timesPerDay: number };
  target?: Partial<Target> | null;
  notes?: string | null;
}

export const exerciseService = {
  getCategories: (params: { includeInactive?: boolean } = {}) => api.get<{ data: Category[] }>('/exercise-categories', params).then((r) => r.data),
  createCategory: (data: { code: string; name: string; order?: number }) => api.post<Category>('/exercise-categories', data),
  updateCategory: (id: Id, data: { name?: string; order?: number; active?: boolean }) => api.patch<Category>(`/exercise-categories/${id}`, data),
  deactivateCategory: (id: Id) => api.delete<Category>(`/exercise-categories/${id}`),

  /** Admin/doctor: the library. Patient: only the exercises in their plan. */
  list: (params: Paged & { category?: string; active?: boolean; q?: string } = {}) => api.get<Page<Exercise>>('/exercises', params as QueryParams),
  get: (id: Id) => api.get<Exercise>(`/exercises/${id}`),
  create: (data: ExerciseInput & { name: string; categoryId: Id }) => api.post<Exercise>('/exercises', data),
  update: (id: Id, data: ExerciseInput) => api.patch<Exercise>(`/exercises/${id}`, data),
  deactivate: (id: Id) => api.delete<Exercise>(`/exercises/${id}`),
};

export const planService = {
  getMine: () => api.get<Plan>('/patients/me/exercise-plan'),
  get: (patientId: Id) => api.get<Plan>(`/patients/${patientId}/exercise-plan`),
  /** `version` is the one last seen (0 for a first plan); 409 CONCURRENT_UPDATE if someone saved since. */
  save: (patientId: Id, version: number, items: PlanItemInput[]) => api.put<Plan>(`/patients/${patientId}/exercise-plan`, { version, items }),
  versions: (patientId: Id, params: Paged = {}) => api.get<Page<Plan>>(`/patients/${patientId}/exercise-plan/versions`, params),
};

export const completionService = {
  getMyChecklist: () => api.get<Checklist>('/patients/me/exercise-checklist'),
  complete: (data: { itemId: string; date: string; details?: { durationMin?: number; note?: string } | null }, idempotencyKey = crypto.randomUUID()) =>
    api.post<Completion>('/exercise-completions', data, idempotencyKey),
  undo: (completionId: Id) => api.delete<null>(`/exercise-completions/${completionId}`),
  getMine: (params: Range & Paged = {}) => api.get<Page<Completion>>('/patients/me/exercise-completions', params),
  getChecklist: (patientId: Id, date?: string) => api.get<Checklist>(`/patients/${patientId}/exercise-checklist`, { date }),
  getHistory: (patientId: Id, params: Range & Paged = {}) => api.get<Page<Completion>>(`/patients/${patientId}/exercise-completions`, params),
  getCompliance: (patientId: Id, params: Range = {}) => api.get<Compliance>(`/patients/${patientId}/exercise-compliance`, params),
};
