import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import { api, ApiError, errorMessage } from './api';
import type { User } from '../types/api';

// Sign-in, sign-out and password reset happen in Firebase; the Auth API only says who we are.
const getMe = async (): Promise<User> => {
  const me = await api.get<User>('/auth/me');
  // Every Auth API route except /auth/me refuses an unverified email, so don't let them in half-working
  if (!me.emailVerified) throw Object.assign(new Error('Email not verified'), { code: 'auth/email-not-verified' });
  return { ...me, role: me.role.toLowerCase() as User['role'] };
};

export const authService = {
  login: async ({ email, password }: { email: string; password: string }) => {
    await signInWithEmailAndPassword(firebaseAuth, email, password);
    try {
      return await getMe();
    } catch (err) {
      await signOut(firebaseAuth).catch(() => {});
      throw err;
    }
  },
  logout: () => signOut(firebaseAuth),
  getMe,
  sendPasswordReset: (email: string) => sendPasswordResetEmail(firebaseAuth, email),
};

const FIREBASE_ERRORS: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-disabled': 'This account has been deactivated. Please contact your care team.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'Unable to reach the server. Check your connection and try again.',
  'auth/email-not-verified': 'Your email address isn’t verified yet. Use the link in your invitation email, or “Forgot password?” to get a new one.',
};

/** True when a failure means "this account can't sign in", not a network or server problem. */
export const isAccountRejection = (err: unknown) =>
  (err instanceof ApiError && (err.status === 401 || err.status === 403)) || (err as { code?: unknown } | null)?.code === 'auth/email-not-verified';

/** A sign-in or reset failure in words, whether it came from Firebase or the Auth API. */
export const authErrorMessage = (err: unknown, fallback: string) => {
  const code = (err as { code?: unknown } | null)?.code;
  return (typeof code === 'string' && FIREBASE_ERRORS[code]) || errorMessage(err, fallback);
};
