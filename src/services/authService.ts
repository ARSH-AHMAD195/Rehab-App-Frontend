import { sendEmailVerification, sendPasswordResetEmail, signInWithCustomToken, signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import { api, ApiError, errorMessage } from './api';
import { normalizePhone, phoneLoginEmail } from '../lib/phoneLogin';
import type { User } from '../types/api';

// Sign-in, sign-out and password reset happen in Firebase; the Auth API only says who we are.
// /auth/me answers even before the email is verified, so the app can show the "verify your email" screen.
const getMe = async (): Promise<User> => {
  const me = await api.get<User>('/auth/me');
  return { ...me, role: me.role.toLowerCase() as User['role'] };
};

/** Once Firebase has signed in, ask the Auth API who this is; undo the sign-in if it refuses. */
const meOrSignOut = async () => {
  try {
    return await getMe();
  } catch (err) {
    await signOut(firebaseAuth).catch(() => {});
    throw err;
  }
};

export const authService = {
  login: async ({ email, password }: { email: string; password: string }) => {
    await signInWithEmailAndPassword(firebaseAuth, email, password);
    return meOrSignOut();
  },
  /** Patients: mobile number and their own password (Firebase knows them by the phone's login alias). */
  loginWithPhone: async ({ phone, password }: { phone: string; password: string }) => {
    await signInWithEmailAndPassword(firebaseAuth, phoneLoginEmail(phone), password);
    return meOrSignOut();
  },
  /** Patients: ask their doctor for a sign-in code. Always "accepted", whether or not the number is known. */
  requestLoginCode: (phone: string) => api.post<unknown>('/auth/login-code/request', { phone: normalizePhone(phone) }),
  /** Patients: sign in with the code their doctor gave them. They must then set a password. */
  loginWithCode: async ({ phone, code }: { phone: string; code: string }) => {
    const { customToken } = await api.post<{ customToken: string }>('/auth/login-code/verify', { phone: normalizePhone(phone), code });
    await signInWithCustomToken(firebaseAuth, customToken);
    return meOrSignOut();
  },
  /** After a code sign-in: set the patient's own password, then tell the API it's done. */
  setPassword: async (password: string) => {
    const current = firebaseAuth.currentUser;
    if (!current) throw new Error('Not signed in');
    await updatePassword(current, password);
    await api.post<null>('/auth/me/password-set');
    return getMe();
  },
  logout: () => signOut(firebaseAuth),
  getMe,
  /** After the user clicks the link: refresh Firebase's copy of the account and a fresh token, then ask the API again. */
  recheckVerification: async () => {
    const current = firebaseAuth.currentUser;
    if (current) {
      await current.reload();
      await current.getIdToken(true);
    }
    return getMe();
  },
  sendVerificationEmail: async () => {
    if (firebaseAuth.currentUser) await sendEmailVerification(firebaseAuth.currentUser);
  },
  sendPasswordReset: (email: string) => sendPasswordResetEmail(firebaseAuth, email),
};

const FIREBASE_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect sign-in details. Check them and try again.',
  'auth/weak-password': 'Choose a longer password (at least 8 characters).',
  'auth/requires-recent-login': 'For your security, sign in again with a new code from your doctor, then set your password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-disabled': 'This account has been deactivated. Please contact your care team.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'Unable to reach the server. Check your connection and try again.',
};

const API_ERRORS: Record<string, string> = {
  // The API gives one answer for a wrong, expired or used-up code.
  INVALID_LOGIN_CODE: 'That code is not right, or it has expired. Check it, or ask your doctor for a new one.',
  RATE_LIMITED: 'Too many attempts. Please wait a few minutes and try again.',
};

/** True when a failure means "this account can't sign in" (401/403), not a network or server problem. */
export const isAccountRejection = (err: unknown) => err instanceof ApiError && (err.status === 401 || err.status === 403);

/** A sign-in or reset failure in words, whether it came from Firebase or the Auth API. */
export const authErrorMessage = (err: unknown, fallback: string) => {
  const code = (err as { code?: unknown } | null)?.code;
  return (typeof code === 'string' && (FIREBASE_ERRORS[code] || API_ERRORS[code])) || errorMessage(err, fallback);
};
