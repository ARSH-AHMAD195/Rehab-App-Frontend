import { sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import { api, ApiError, errorMessage } from './api';
import type { User } from '../types/api';

// Sign-in, sign-out and password reset happen in Firebase; the Auth API only says who we are.
// /auth/me answers even before the email is verified, so the app can show the "verify your email" screen.
const getMe = async (): Promise<User> => {
  const me = await api.get<User>('/auth/me');
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
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/user-disabled': 'This account has been deactivated. Please contact your care team.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'Unable to reach the server. Check your connection and try again.',
};

/** True when a failure means "this account can't sign in" (401/403), not a network or server problem. */
export const isAccountRejection = (err: unknown) => err instanceof ApiError && (err.status === 401 || err.status === 403);

/** A sign-in or reset failure in words, whether it came from Firebase or the Auth API. */
export const authErrorMessage = (err: unknown, fallback: string) => {
  const code = (err as { code?: unknown } | null)?.code;
  return (typeof code === 'string' && FIREBASE_ERRORS[code]) || errorMessage(err, fallback);
};
