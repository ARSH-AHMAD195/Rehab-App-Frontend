import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth, type EndReason } from '../context/AuthContext';
import { authErrorMessage } from '../services/authService';
import { HOME_BY_ROLE } from '../lib/constants';
import { Alert, Button, Field, Input } from '../components/ui';
import { AuthShell } from '../components/common/AuthShell';
import type { User } from '../types/api';

const END_MESSAGES: Record<Exclude<EndReason, null>, string> = {
  expired: 'Your session has expired. Please sign in again.',
  idle: 'You were signed out after a period of inactivity, to protect your privacy.',
};

/** Send users back where they were headed, but only within their own role's area. */
const destinationFor = (user: User, from?: string) => (from?.startsWith(`/${user.role}/`) ? from : HOME_BY_ROLE[user.role]);

export const LoginPage = () => {
  const { user, login } = useAuth();
  const location = useLocation();
  const state = location.state as { from?: string; reason?: EndReason } | null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Also handles the redirect right after a successful login (login() sets `user`).
  if (user) return <Navigate to={destinationFor(user, state?.from)} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      setError(authErrorMessage(err, 'Sign-in failed. Please try again.'));
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Sign in" subtitle="Supervised digital prehabilitation">
      {state?.reason && !error && (
        <Alert tone="warning" className="mb-4">
          {END_MESSAGES[state.reason]}
        </Alert>
      )}
      {error && (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email address">
          <Input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm font-semibold text-teal-800 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Sign in <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Button>
      </form>


      <p className="mt-6 text-center text-sm text-slate-600">New patient or clinical staff? Your hospital’s surgical team will set up your account.</p>
    </AuthShell>
  );
};
