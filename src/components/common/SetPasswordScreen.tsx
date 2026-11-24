import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth, useSignedInUser } from '../../context/AuthContext';
import { authErrorMessage } from '../../services/authService';
import { t } from '../../lib/i18n';
import { Alert, Button, Field, Input } from '../ui';
import { useToast } from '../ui/toast';
import { AuthShell } from './AuthShell';

const MIN_LENGTH = 6;
const MAX_LENGTH = 128;

/**
 * Shown instead of the app to a patient who signed in with a doctor's code, until they choose a password.
 * The password is sent as typed (not trimmed) and kept nowhere.
 */
export const SetPasswordScreen = () => {
  const user = useSignedInUser();
  const { setPassword, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [password, setValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_LENGTH) return setError(t('Your password must be at least {n} characters.', { n: MIN_LENGTH }));
    if (password !== confirm) return setError(t('The two passwords do not match.'));
    setError('');
    setSubmitting(true);
    try {
      await setPassword(password);
      toast.success(t('Your password is saved.'));
    } catch (err) {
      setError(t(authErrorMessage(err, 'Could not save your password. Please try again.')));
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title={t(user.hasPassword ? 'Set a new password' : 'Set your password')}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm leading-relaxed text-slate-700">{t('Choose a password you will remember. You’ll use it with your phone number next time.')}</p>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="New password" hint={t('At least {n} characters.', { n: MIN_LENGTH })}>
          <Input type="password" required autoComplete="new-password" maxLength={MAX_LENGTH} value={password} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <Field label="Type it again">
          <Input type="password" required autoComplete="new-password" maxLength={MAX_LENGTH} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          {t('Save password')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t('Sign out')}
        </Button>
      </form>
    </AuthShell>
  );
};
