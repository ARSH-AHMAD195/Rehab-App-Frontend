import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/ui';
import { VerifyEmailScreen } from '../components/common/VerifyEmailScreen';
import { HOME_BY_ROLE } from '../lib/constants';
import type { Role } from '../types/api';

export const ProtectedRoute = ({ children, allowedRoles }: { children: ReactNode; allowedRoles: Role[] }) => {
  const { user, loading, endReason } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Verifying your session…" />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname, reason: endReason }} />;
  }
  if (!allowedRoles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role] ?? '/'} replace />;
  // Every API refuses an unverified email, so ask them to verify instead of showing pages that would all fail
  if (!user.emailVerified) return <VerifyEmailScreen />;

  return children;
};
