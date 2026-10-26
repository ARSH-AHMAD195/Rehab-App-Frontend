import {
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import { firebaseAuth } from '../lib/firebase';
import { api } from './api';

import type {
  DoctorProfile,
  Ok,
  PatientProfile,
  User,
} from '../types/api';

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
  // Sign in using Firebase, then verify the user with our backend.
  login: async (credentials: {
    email: string;
    password: string;
  }): Promise<User> => {
    try {
      await signInWithEmailAndPassword(
        firebaseAuth,
        credentials.email,
        credentials.password
      );

      return await api.get<User>('/auth/me');
    } catch (error) {
      await signOut(firebaseAuth).catch(() => {});
      throw error;
    }
  },

  // Firebase manages the authentication session.
  logout: async () => {
    await signOut(firebaseAuth);
    return { success: true };
  },

  // Fetch the currently authenticated user's backend profile.
  getMe: () => api.get<User>('/auth/me'),

  // Keep registration and password-reset methods for now.
  registerDoctor: (data: RegisterDoctorInput) =>
    api.post<Ok & { doctor: User }>('/auth/register-doctor', data),

  registerPatient: (data: RegisterPatientInput) =>
    api.post<Ok & { patient: User }>('/auth/register-patient', data),

  forgotPassword: (email: string) =>
    api.post<Ok & { demoResetToken?: string }>(
      '/auth/forgot-password',
      { email }
    ),

  resetPassword: (data: {
    resetToken: string;
    newPassword: string;
  }) => api.post<Ok>('/auth/reset-password', data),
};

