import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import { authService, isAccountRejection } from '../services/authService';
import { onUnauthorized } from '../services/api';
import { idleExpired, writeLastActivity } from '../lib/idle';
import { setMonitoringUser } from '../lib/monitoring';
import type { User } from '../types/api';

export type EndReason = 'expired' | 'idle' | null;

interface AuthValue {
  user: User | null;
  loading: boolean;
  /** Why the last session ended without the user signing out, for the login page message. */
  endReason: EndReason;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  /** Patients: mobile number + password. */
  loginWithPhone: (credentials: { phone: string; password: string }) => Promise<User>;
  /** Patients: mobile number + a code from their doctor. Leaves `user.mustSetPassword` true. */
  loginWithCode: (credentials: { phone: string; code: string }) => Promise<User>;
  /** After a code sign-in: set the patient's own password. */
  setPassword: (password: string) => Promise<User>;
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

  const signedIn = useCallback((next: User) => {
    setUser(next);
    setMonitoringUser(next);
    setEndReason(null);
  }, []);

  const signedOut = useCallback(
    (reason: EndReason) => {
      setUser(null);
      setEndReason(reason);
      setMonitoringUser(null);
      // Never let one user's cached health data be visible to the next person on this device
      queryClient.clear();
    },
    [queryClient]
  );

  // Firebase restores a saved session on load; the Auth API tells us who that is.
  useEffect(
    () =>
      onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
        if (firebaseUser && idleExpired()) {
          // Left signed in with the tab closed: end it here, before any health data loads
          await authService.logout().catch(() => {});
          signedOut('idle');
        } else if (firebaseUser) {
          try {
            signedIn(await authService.getMe());
          } catch (err) {
            // Only end the Firebase session if the account itself was refused. A network error or a
            // sleeping API keeps it, so the next load can try again without asking for the password.
            if (isAccountRejection(err)) await authService.logout().catch(() => {});
            setUser(null);
          }
        }
        setLoading(false);
      }),
    [signedIn, signedOut]
  );

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

  /** Every sign-in: record activity first, so it isn't judged by the last session's idle time. */
  const signIn = useCallback(
    async (attempt: () => Promise<User>) => {
      writeLastActivity();
      const next = await attempt();
      signedIn(next);
      return next;
    },
    [signedIn]
  );
  const login = useCallback((c: { email: string; password: string }) => signIn(() => authService.login(c)), [signIn]);
  const loginWithPhone = useCallback((c: { phone: string; password: string }) => signIn(() => authService.loginWithPhone(c)), [signIn]);
  const loginWithCode = useCallback((c: { phone: string; code: string }) => signIn(() => authService.loginWithCode(c)), [signIn]);
  const setPassword = useCallback(async (password: string) => {
    const next = await authService.setPassword(password);
    signedIn(next);
    return next;
  }, [signedIn]);

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
    () => ({ user, loading, endReason, login, loginWithPhone, loginWithCode, setPassword, logout, recheckVerification }),
    [user, loading, endReason, login, loginWithPhone, loginWithCode, setPassword, logout, recheckVerification]
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
