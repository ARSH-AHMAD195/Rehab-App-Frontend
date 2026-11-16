import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth, type EndReason } from '../context/AuthContext';
import { authErrorMessage } from '../services/authService';
import { HOME_BY_ROLE, PHONE_HINT, PHONE_PATTERN } from '../lib/constants';
import { t, useLang, usePatientLanguage } from '../lib/i18n';
import { LanguageSwitch } from '../components/common/LanguageSwitch';
import { cn } from '../lib/cn';
import { Alert, Button, Field, Input } from '../components/ui';
import { AuthShell } from '../components/common/AuthShell';
import { CodeSignIn } from '../components/auth/CodeSignIn';
import type { User } from '../types/api';

const END_MESSAGES: Record<Exclude<EndReason, null>, string> = {
  expired: 'Your session has expired. Please sign in again.',
  idle: 'You were signed out after a period of inactivity, to protect your privacy.',
};

/** Send users back where they were headed, but only within their own role's area. */
const destinationFor = (user: User, from?: string) => (from?.startsWith(`/${user.role}/`) ? from : HOME_BY_ROLE[user.role]);

type Audience = 'patient' | 'staff';


/** Patients (the default) sign in with their mobile number; doctors and admins with email. */
export const LoginPage = () => {
  const { user, login, loginWithPhone } = useAuth();
  const location = useLocation();
  const state = location.state as { from?: string; reason?: EndReason } | null;
  const [audience, setAudience] = useState<Audience>('patient');
  const [withCode, setWithCode] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const patient = audience === 'patient';
  usePatientLanguage(patient);
  useLang();

  // Also handles the redirect right after a successful login (login() sets `user`).
  if (user) return <Navigate to={destinationFor(user, state?.from)} replace />;

  const choose = (next: Audience) => {
    setAudience(next);
    setWithCode(false);
    setPassword('');
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await (patient ? loginWithPhone({ phone: phone.trim(), password }) : login({ email: email.trim(), password }));
    } catch (err) {
      setError(t(authErrorMessage(err, 'Sign-in failed. Please try again.')));
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title={t('Sign in')} subtitle={t('Supervised digital prehabilitation')}>
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label={t('I am a')}>
        {(
          [
            ['patient', 'Patient'],
            ['staff', 'Doctor or admin'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={audience === value}
            onClick={() => choose(value)}
            className={cn(
              'min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors',
              audience === value ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            )}
          >
            {t(label)}
          </button>
        ))}
      </div>

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

      {patient && withCode ? (
        <CodeSignIn initialPhone={phone} onCancel={() => setWithCode(false)} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {patient ? (
            <Field label="Mobile number" hint={PHONE_HINT}>
              <Input
                type="tel"
                inputMode="tel"
                required
                autoComplete="tel"
                pattern={PHONE_PATTERN}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          ) : (
            <Field label="Email address">
              <Input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          )}
          <Field label="Password">
            <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {!patient && (
            <div className="text-right">
              <Link to="/forgot-password" className="text-sm font-semibold text-teal-800 hover:underline">
                Forgot password?
              </Link>
            </div>
          )}
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            {t('Sign in')} <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Button>
          {patient && (
            <button
              type="button"
              onClick={() => {
                setError('');
                setWithCode(true);
              }}
              className="w-full rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-left text-sm text-teal-950 transition-colors hover:bg-teal-100"
            >
              <span className="block font-semibold">{t('First time, or forgot your password?')}</span>
              <span className="text-teal-800 underline">{t('Sign in with a code from your doctor')}</span>
            </button>
          )}
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-600">
        {t(patient ? 'New patient? Your hospital’s surgical team will set up your account.' : 'Clinical staff? Your hospital’s administrator will set up your account.')}
      </p>
      {patient && (
        <div className="mt-3 text-center">
          <LanguageSwitch className="inline-flex" />
        </div>
      )}
    </AuthShell>
  );
};
