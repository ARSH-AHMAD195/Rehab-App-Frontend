import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import { authService, isAccountRejection } from '../services/authService';
import { onUnauthorized } from '../services/api';
import { setMonitoringUser } from '../lib/monitoring';
import type { User } from '../types/api';

export type EndReason = 'expired' | 'idle' | null;

interface AuthValue {
  user: User | null;
  loading: boolean;
  /** Why the last session ended without the user signing out, for the login page message. */
  endReason: EndReason;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  logout: (reason?: EndReason) => Promise<void>;
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
        if (firebaseUser) {
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
    [signedIn]
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

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      const next = await authService.login(credentials);
      signedIn(next);
      return next;
    },
    [signedIn]
  );

  const logout = useCallback(
    async (reason: EndReason = null) => {
      await authService.logout().catch(() => {});
      signedOut(reason);
    },
    [signedOut]
  );

  const value = useMemo(() => ({ user, loading, endReason, login, logout }), [user, loading, endReason, login, logout]);

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
