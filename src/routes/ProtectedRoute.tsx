import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, ErrorState, PageLoader } from '../components/ui';
import { t } from '../lib/i18n';
import { VerifyEmailScreen } from '../components/common/VerifyEmailScreen';
import { HOME_BY_ROLE } from '../lib/constants';
import type { Role } from '../types/api';

export const ProtectedRoute = ({ children, allowedRoles }: { children: ReactNode; allowedRoles: Role[] }) => {
  const { user, loading, endReason, restoreError, retryRestore, logout } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Verifying your session…" />;
  // Still signed in, but the API couldn't be reached: offer a retry, not the sign-in form
  if (!user && restoreError) {
    return (
      <main className="mx-auto max-w-md px-4 py-20">
        <ErrorState title="We couldn’t check your session" error={restoreError} onRetry={() => void retryRestore()} />
        {/* For an error that retrying won't fix */}
        <Button variant="ghost" className="mt-4 w-full" onClick={() => void logout()}>
          {t('Sign out')}
        </Button>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname, reason: endReason }} />;
  }
  if (!allowedRoles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role] ?? '/'} replace />;
  // Every API refuses an unverified email (but not after a code sign-in), so ask them to verify instead of showing pages that would all fail
  if (!user.emailVerified && user.loginMethod !== 'LOGIN_CODE') return <VerifyEmailScreen />;

  return children;
};
