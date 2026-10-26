import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from '../components/ui';
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

  return children;
};
