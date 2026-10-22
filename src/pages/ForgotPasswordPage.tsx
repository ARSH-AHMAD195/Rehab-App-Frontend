import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { authService } from '../services/authService';
import { useFormErrors } from '../lib/forms';
import { MIN_PASSWORD_LENGTH } from '../lib/password';
import { Alert, Button, Field, Input, buttonClass } from '../components/ui';
import { AuthShell } from '../components/common/AuthShell';

export const ForgotPasswordPage = () => {
  const form = useFormErrors();
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setSubmitting(true);
    try {
      await action();
    } catch (err) {
      form.fromApiError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequest = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.validate(e.currentTarget)) return;
    void run(async () => {
      const res = await authService.forgotPassword(email.trim());
      // The API only returns the code outside production; normally it arrives by email.
      if (res.demoResetToken) setResetToken(res.demoResetToken);
      setStep('reset');
    });
  };

  const handleReset = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const confirm = e.currentTarget.elements.namedItem('confirmPassword') as HTMLInputElement;
    confirm.setCustomValidity(newPassword === confirmPassword ? '' : 'The passwords do not match.');
    if (!form.validate(e.currentTarget)) return;
    void run(async () => {
      await authService.resetPassword({ resetToken: resetToken.trim(), newPassword });
      setStep('done');
    });
  };

  return (
    <AuthShell title="Reset your password">
      {form.formError && (
        <Alert tone="error" className="mb-4">
          {form.formError}
        </Alert>
      )}

      {step === 'request' && (
        <form noValidate onSubmit={handleRequest} onChange={form.onChange} className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-700">Enter the email address on your account and we’ll send you a reset code.</p>
          <Field label="Email address" error={form.errors.email}>
            <Input name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Send reset code
          </Button>
        </form>
      )}

      {step === 'reset' && (
        <form noValidate onSubmit={handleReset} onChange={form.onChange} className="space-y-4">
          <Alert tone="info">If an account exists for {email.trim()}, a reset code has been sent. Enter it below.</Alert>
          <Field label="Reset code" error={form.errors.resetToken}>
            <Input name="resetToken" required autoComplete="one-time-code" value={resetToken} onChange={(e) => setResetToken(e.target.value)} />
          </Field>
          <Field label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters`} error={form.errors.newPassword}>
            <Input name="newPassword" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <Field label="Confirm new password" error={form.errors.confirmPassword}>
            <Input
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                e.target.setCustomValidity('');
                setConfirmPassword(e.target.value);
              }}
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Save new password
          </Button>
        </form>
      )}

      {step === 'done' && (
        <div className="space-y-4 py-4 text-center" role="status">
          <CheckCircle2 className="mx-auto h-12 w-12 text-teal-700" aria-hidden="true" />
          <p className="text-lg font-bold text-slate-900">Your password has been updated</p>
          <Link to="/login" className={buttonClass('primary', 'lg', 'w-full')}>
            Sign in
          </Link>
        </div>
      )}

      <div className="mt-6 text-center">
        <Link to="/login" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-teal-800">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
};
