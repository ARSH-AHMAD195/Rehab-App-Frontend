import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authErrorMessage, authService } from '../../services/authService';
import { cleanCode } from '../../lib/phoneLogin';
import { PHONE_HINT, PHONE_PATTERN } from '../../lib/constants';
import { t } from '../../lib/i18n';
import { Alert, Button, Field, Input } from '../ui';

/**
 * How patients sign in: ask for a code, get it from the doctor, type it in. Success sets the user and the
 * login page sends them home. They stay signed in on that phone; if ever signed out, they ask for a new code.
 */
export const CodeSignIn = () => {
  const { loginWithCode } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('+91');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [askedAgain, setAskedAgain] = useState(false);

  const run = async (attempt: () => Promise<unknown>, fallback: string) => {
    setError('');
    setSubmitting(true);
    try {
      await attempt();
    } catch (err) {
      setError(t(authErrorMessage(err, fallback)));
    } finally {
      setSubmitting(false);
    }
  };

  const requestCode = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await authService.requestLoginCode(phone.trim());
      setCode('');
      setAskedAgain(false);
      setStep('code');
    }, 'Could not send your request. Please try again.');
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    void run(() => loginWithCode({ phone: phone.trim(), code }), 'Sign-in failed. Please try again.');
  };

  return (
    <div className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}

      {step === 'phone' ? (
        <form onSubmit={requestCode} className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-700">
            {t('Enter your mobile number. Your doctor will be asked to give you a 6-digit sign-in code.')}
          </p>
          <Field label="Mobile number" hint={PHONE_HINT}>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              pattern={PHONE_PATTERN}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            {t('Ask for a code')} <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <Alert tone="info">
            {t(askedAgain ? 'Asked again. Your doctor can now give you a new 6-digit code.' : 'Ask your doctor for your 6-digit code, then type it here.')}
          </Alert>
          <Field label="6-digit code" hint={t('For {phone}', { phone: phone.trim() })}>
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              minLength={6}
              maxLength={6}
              pattern="\d{6}"
              className="text-center text-2xl tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(cleanCode(e.target.value))}
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            {t('Sign in')} <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Button>
          <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold">
            <button type="button" className="min-h-10 text-teal-800 hover:underline" onClick={() => setStep('phone')}>
              {t('Change number')}
            </button>
            <button
              type="button"
              className="min-h-10 text-teal-800 hover:underline disabled:opacity-60"
              disabled={submitting}
              onClick={() =>
                void run(async () => {
                  await authService.requestLoginCode(phone.trim());
                  setAskedAgain(true);
                }, 'Could not send your request. Please try again.')
              }
            >
              {t('Ask again')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
