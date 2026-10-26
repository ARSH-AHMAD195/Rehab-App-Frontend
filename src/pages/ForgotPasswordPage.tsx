import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { authErrorMessage, authService } from '../services/authService';
import { useFormErrors } from '../lib/forms';
import { Alert, Button, Field, Input } from '../components/ui';
import { AuthShell } from '../components/common/AuthShell';

/** Firebase emails a link to choose a new password; the same link sets a first password for new accounts. */
export const ForgotPasswordPage = () => {
  const form = useFormErrors();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.validate(e.currentTarget)) return;
    setSubmitting(true);
    try {
      await authService.sendPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      form.setFormError(authErrorMessage(err, 'Could not send the email. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Reset your password">
      {form.formError && (
        <Alert tone="error" className="mb-4">
          {form.formError}
        </Alert>
      )}

      {sent ? (
        <div className="space-y-3 py-4 text-center" role="status">
          <MailCheck className="mx-auto h-12 w-12 text-teal-700" aria-hidden="true" />
          <p className="text-lg font-bold text-slate-900">Check your email</p>
          <p className="text-sm text-slate-700">If an account exists for {email.trim()}, we’ve sent a link to choose a new password.</p>
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-700">Enter the email address on your account and we’ll email you a link to choose a new password.</p>
          <Field label="Email address" error={form.errors.email}>
            <Input name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Send reset link
          </Button>
        </form>
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
