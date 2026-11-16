import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, LogOut } from 'lucide-react';
import { useAuth, useSignedInUser } from '../../context/AuthContext';
import { authErrorMessage } from '../../services/authService';
import { t, useLang, usePatientLanguage } from '../../lib/i18n';
import { validateNewPassword } from '../../lib/password';
import { Alert, Button, Field, inputClass } from '../ui';
import { AuthShell } from './AuthShell';
import { LanguageSwitch } from './LanguageSwitch';

/**
 * Shown instead of the app after signing in with a doctor's code (`user.mustSetPassword`).
 * Once the password is saved the refreshed user no longer needs it and the page renders.
 */
export const SetPasswordScreen = () => {
  const user = useSignedInUser();
  const { setPassword, logout } = useAuth();
  const navigate = useNavigate();
  // Rendered outside DashboardLayout, so apply the patient's language here too
  useLang();
  usePatientLanguage(user.role === 'patient');

  const [password, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const next = validateNewPassword(password, confirm);
    setErrors(next);
    if (next.password) return passwordRef.current?.focus();
    if (next.confirm) return confirmRef.current?.focus();
    setSaving(true);
    try {
      await setPassword(password);
    } catch (err) {
      setFormError(authErrorMessage(err, 'Could not save your password. Please try again.'));
      passwordRef.current?.focus();
    } finally {
      setSaving(false);
    }
  };

  const type = show ? 'text' : 'password';

  return (
    <AuthShell title={t('Set your password')}>
      <form noValidate onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-6 w-6 shrink-0 text-teal-700" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-slate-700">
            {t('Choose a password. Next time, sign in with your mobile number and this password.')}
          </p>
        </div>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="New password" hint="At least 8 characters." error={errors.password && t(errors.password)}>
          <input className={inputClass} ref={passwordRef} type={type} autoComplete="new-password" value={password} onChange={(e) => setPw(e.target.value)} readOnly={saving} />
        </Field>
        <Field label="Confirm password" error={errors.confirm && t(errors.confirm)}>
          <input className={inputClass} ref={confirmRef} type={type} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} readOnly={saving} />
        </Field>
        <Button type="button" variant="ghost" size="sm" aria-pressed={show} onClick={() => setShow((s) => !s)}>
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          {show ? t('Hide passwords') : t('Show passwords')}
        </Button>
        <Button type="submit" size="lg" className="w-full" loading={saving}>
          {t('Save password')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          disabled={saving}
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t('Sign out')}
        </Button>
      </form>
      {user.role === 'patient' && (
        <div className="mt-3 text-center">
          <LanguageSwitch className="inline-flex" />
        </div>
      )}
    </AuthShell>
  );
};
