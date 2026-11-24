import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authErrorMessage } from '../../services/authService';
import { normalizePhone } from '../../lib/phoneLogin';
import { PHONE_HINT, PHONE_PATTERN } from '../../lib/constants';
import { t } from '../../lib/i18n';
import { Alert, Button, Field, Input } from '../ui';

/** How patients normally sign in: mobile number + the password they set. Success sets the user and the login page sends them home. */
export const PasswordSignIn = () => {
  const { passwordLogin } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await passwordLogin({ phone: phone.trim(), password });
    } catch (err) {
      setError(t(authErrorMessage(err, 'Sign-in failed. Please try again.')));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Mobile number" hint={PHONE_HINT}>
        <Input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          required
          pattern={PHONE_PATTERN}
          value={phone}
          onChange={(e) => setPhone(normalizePhone(e.target.value))}
        />
      </Field>
      <Field label="Password">
        <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={submitting}>
        {t('Sign in')} <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </Button>
    </form>
  );
};
