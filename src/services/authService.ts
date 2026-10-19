import { api } from './api';
import type { DoctorProfile, Ok, PatientProfile, User } from '../types/api';

export interface RegisterPatientInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth: string;
  gender: string;
  surgeryType: string;
  surgeryDate: string;
  hospitalNumber?: string;
  medicalConditions?: string[];
  emergencyContact?: { name: string; relationship: string; phone: string };
}

export interface RegisterDoctorInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  specialization: string;
  department: string;
  licenseNumber: string;
  hospitalAffiliation?: string;
}

// The session itself is the backend's httpOnly cookie; nothing is persisted client-side.
export const authService = {
  login: (credentials: { email: string; password: string }) => api.post<Ok & { user: User }>('/auth/login', credentials),
  logout: () => api.post<Ok>('/auth/logout'),
  getMe: () => api.get<Ok & { user: User; profile: PatientProfile | DoctorProfile | null }>('/auth/me'),
  registerDoctor: (data: RegisterDoctorInput) => api.post<Ok & { doctor: User }>('/auth/register-doctor', data),
  registerPatient: (data: RegisterPatientInput) => api.post<Ok & { patient: User }>('/auth/register-patient', data),
  forgotPassword: (email: string) => api.post<Ok & { demoResetToken?: string }>('/auth/forgot-password', { email }),
  resetPassword: (data: { resetToken: string; newPassword: string }) => api.post<Ok>('/auth/reset-password', data),
};
