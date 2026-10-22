import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '../services/authService';
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

  // The session is an httpOnly cookie, so the only way to know who's signed in is to ask.
  useEffect(() => {
    authService
      .getMe()
      .then((res) => {
        setUser(res.user);
        setMonitoringUser(res.user);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Any 401 from a protected endpoint means the cookie expired or was revoked.
  const userRef = useRef(user);
  userRef.current = user;
  useEffect(() => {
    onUnauthorized(() => signedOut(userRef.current ? 'expired' : null));
    return () => onUnauthorized(() => {});
  }, [signedOut]);

  const login = useCallback(async (credentials: { email: string; password: string }) => {
    const res = await authService.login(credentials);
    setEndReason(null);
    setUser(res.user);
    setMonitoringUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(
    async (reason: EndReason = null) => {
      try {
        await authService.logout();
      } catch {
        // The local session is cleared regardless; an expired cookie can't be logged out twice.
      } finally {
        signedOut(reason);
      }
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
