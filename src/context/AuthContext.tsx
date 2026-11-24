import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import { authService, isAccountRejection } from '../services/authService';
import { onUnauthorized } from '../services/api';
import { idleExpired, idleSignOutApplies, readLastActivity, writeLastActivity } from '../lib/idle';
import { setMonitoringUser } from '../lib/monitoring';
import type { User } from '../types/api';

export type EndReason = 'expired' | 'idle' | null;

interface AuthValue {
  user: User | null;
  loading: boolean;
  /** Why the last session ended without the user signing out, for the login page message. */
  endReason: EndReason;
  /** A saved session couldn't be checked (network or a sleeping API); it's kept, and can be retried. */
  restoreError: unknown;
  retryRestore: () => Promise<void>;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  /** Patients: mobile number + a code from their doctor. */
  loginWithCode: (credentials: { phone: string; code: string }) => Promise<User>;
  /** Patients: mobile number + the password they set. */
  passwordLogin: (credentials: { phone: string; password: string }) => Promise<User>;
  /** Patients: save a new password. Afterwards the app is let through for the rest of this session. */
  setPassword: (password: string) => Promise<void>;
  /** True once a password was set during the current sign-in (kept across reloads of that sign-in). */
  passwordSet: boolean;
  logout: (reason?: EndReason) => Promise<void>;
  /** Asks again whether the email is verified, after the user clicked the link. */
  recheckVerification: () => Promise<User>;
}

const AuthContext = createContext<AuthValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [endReason, setEndReason] = useState<EndReason>(null);
  const [restoreError, setRestoreError] = useState<unknown>(null);
  const [passwordSet, setPasswordSet] = useState(false);

  const signedIn = useCallback((next: User) => {
    setUser(next);
    setPasswordSet(authService.passwordSetThisSignIn());
    setMonitoringUser(next);
    setEndReason(null);
  }, []);

  const signedOut = useCallback(
    (reason: EndReason) => {
      setUser(null);
      setPasswordSet(false);
      setEndReason(reason);
      setMonitoringUser(null);
      // Never let one user's cached health data be visible to the next person on this device
      queryClient.clear();
    },
    [queryClient]
  );

  // Set while login()/loginWithCode() run: they fetch /auth/me themselves, so the listener needn't.
  const signingIn = useRef(false);

  /** Who a restored Firebase session belongs to. Health data only loads once `user` is set. */
  const restore = useCallback(async () => {
    setRestoreError(null);
    // Judged now, before any wait: a sign-in started meanwhile on the login page refreshes the stamp
    const expired = idleExpired();
    const uid = firebaseAuth.currentUser?.uid;
    try {
      const me = await authService.getMe();
      // Someone else signed in while this was loading: their sign-in sets the user, not this
      if (firebaseAuth.currentUser?.uid !== uid) return;
      // Left signed in with the tab closed
      if (idleSignOutApplies(me) && expired) {
        await authService.logout().catch(() => {});
        signedOut('idle');
      } else {
        signedIn(me);
      }
    } catch (err) {
      // Only end the Firebase session if the account itself was refused. A network error or a
      // sleeping API keeps it, and the app offers to try again.
      if (isAccountRejection(err)) await authService.logout().catch(() => {});
      else setRestoreError(err);
      setUser(null);
    }
  }, [signedIn, signedOut]);

  // Firebase restores a saved session on load; the Auth API tells us who that is.
  useEffect(
    () =>
      onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
        if (firebaseUser && !signingIn.current) await restore();
        if (!firebaseUser) setRestoreError(null);
        setLoading(false);
      }),
    [restore]
  );

  const retryRestore = useCallback(async () => {
    setLoading(true);
    if (firebaseAuth.currentUser) await restore();
    else setRestoreError(null);
    setLoading(false);
  }, [restore]);

  // A 401 from any API means the session ended (expired, revoked or account deactivated).
  const userRef = useRef(user);
  userRef.current = user;
  useEffect(() => {
    onUnauthorized(() => {
      if (!userRef.current) return;
      void authService.logout().catch(() => {});
      signedOut('expired');
    });
    return () => onUnauthorized(() => {});
  }, [signedOut]);

  /**
   * Every sign-in: record activity first, so it isn't judged by the last session's idle time. A failed
   * attempt puts the old time back, or it would revive an idle session still saved on this device.
   */
  const signIn = useCallback(
    async (attempt: () => Promise<User>) => {
      const previous = readLastActivity();
      writeLastActivity();
      setPasswordSet(false);
      signingIn.current = true;
      try {
        const next = await attempt();
        signedIn(next);
        return next;
      } catch (err) {
        writeLastActivity(previous);
        throw err;
      } finally {
        signingIn.current = false;
      }
    },
    [signedIn]
  );
  const login = useCallback((c: { email: string; password: string }) => signIn(() => authService.login(c)), [signIn]);
  const loginWithCode = useCallback((c: { phone: string; code: string }) => signIn(() => authService.loginWithCode(c)), [signIn]);

  const passwordLogin = useCallback((c: { phone: string; password: string }) => signIn(() => authService.passwordLogin(c)), [signIn]);
  const setPassword = useCallback(async (password: string) => {
    await authService.setPassword(password);
    setPasswordSet(true);
  }, []);

  const logout = useCallback(
    async (reason: EndReason = null) => {
      await authService.logout().catch(() => {});
      signedOut(reason);
    },
    [signedOut]
  );

  const recheckVerification = useCallback(async () => {
    const next = await authService.recheckVerification();
    signedIn(next);
    return next;
  }, [signedIn]);

  const value = useMemo(
    () => ({ user, loading, endReason, restoreError, retryRestore, login, loginWithCode, passwordLogin, setPassword, passwordSet, logout, recheckVerification }),
    [user, loading, endReason, restoreError, retryRestore, login, loginWithCode, passwordLogin, setPassword, passwordSet, logout, recheckVerification]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

/** For components only rendered inside a ProtectedRoute. */
// eslint-disable-next-line react-refresh/only-export-components
export const useSignedInUser = () => {
  const { user } = useAuth();
  if (!user) throw new Error('useSignedInUser used outside a protected route');
  return user;
};
