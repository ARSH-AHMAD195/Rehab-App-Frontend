import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Activity, ArrowRight, Shield, Stethoscope } from 'lucide-react';
import { useAuth, type EndReason } from '../context/AuthContext';
import { errorMessage, USE_MOCK } from '../services/api';
import { HOME_BY_ROLE } from '../lib/constants';
import { Alert, Button, Field, Input } from '../components/ui';
import { AuthShell } from '../components/common/AuthShell';
import type { User } from '../types/api';

// Seeded accounts in src/mocks/db.js. Only offered when running against the mock API.
const DEMO_ACCOUNTS = [
  { email: 'patient.john@example.com', label: 'Patient: John Davis (CABG)', icon: Activity },
  { email: 'doctor.jenkins@fitforsurgery.org', label: 'Doctor: Dr. Sarah Jenkins', icon: Stethoscope },
  { email: 'admin@fitforsurgery.org', label: 'Admin: Platform administrator', icon: Shield },
];
const DEMO_PASSWORD = 'Password123!';

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
      setError(errorMessage(err, 'Sign-in failed. Please try again.'));
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

      {USE_MOCK && (
        <div className="mt-6 border-t border-slate-200 pt-6">
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Demo accounts (mock API)</p>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map(({ email: demoEmail, label, icon: Icon }) => (
              <button
                key={demoEmail}
                type="button"
                onClick={() => {
                  setEmail(demoEmail);
                  setPassword(DEMO_PASSWORD);
                  setError('');
                }}
                className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900 hover:bg-slate-100"
              >
                <Icon className="h-4 w-4 text-teal-700" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-slate-600">New patient or clinical staff? Your hospital’s surgical team will set up your account.</p>
    </AuthShell>
  );
};
