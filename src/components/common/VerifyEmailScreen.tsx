import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, MailCheck, RefreshCw, Send } from 'lucide-react';
import { useAuth, useSignedInUser } from '../../context/AuthContext';
import { authErrorMessage, authService } from '../../services/authService';
import { Alert, Button } from '../ui';
import { AuthShell } from './AuthShell';

/**
 * Shown instead of the app until the email is verified: every API refuses an unverified account
 * (403 EMAIL_NOT_VERIFIED). The user stays signed in; this is a message, not a sign-out.
 */
export const VerifyEmailScreen = () => {
  const user = useSignedInUser();
  const { logout, recheckVerification } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<{ tone: 'info' | 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState<'send' | 'check' | null>(null);

  const run = async (kind: 'send' | 'check', action: () => Promise<void>) => {
    setBusy(kind);
    setStatus(null);
    try {
      await action();
    } catch (err) {
      setStatus({ tone: 'error', text: authErrorMessage(err, 'Something went wrong. Please try again.') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthShell title="Please verify your email">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 h-6 w-6 shrink-0 text-teal-700" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-slate-700">
            Before you can use Fit for Surgery, confirm that <strong>{user.email}</strong> is yours. Open the link in the email we sent, then come back here.
          </p>
        </div>
        {status && <Alert tone={status.tone}>{status.text}</Alert>}
        <Button
          size="lg"
          className="w-full"
          loading={busy === 'check'}
          onClick={() =>
            void run('check', async () => {
              const next = await recheckVerification();
              if (!next.emailVerified) setStatus({ tone: 'info', text: 'Not verified yet. Open the link in the email, then try again.' });
            })
          }
        >
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
          I’ve verified my email
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          loading={busy === 'send'}
          onClick={() =>
            void run('send', async () => {
              await authService.sendVerificationEmail();
              setStatus({ tone: 'success', text: `We’ve sent a new verification email to ${user.email}.` });
            })
          }
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Send the email again
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </Button>
      </div>
    </AuthShell>
  );
};
