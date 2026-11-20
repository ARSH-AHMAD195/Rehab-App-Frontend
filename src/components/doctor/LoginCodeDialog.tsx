import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, MessageCircle, RefreshCw } from 'lucide-react';
import { patientService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { firstName } from '../../lib/format';
import { qk } from '../../lib/queryClient';
import { Alert, Button, buttonClass, Modal } from '../ui';
import { useToast } from '../ui/toast';
import type { LoginCode } from '../../types/api';

type Props = { patientId: string; patientName: string; phone: string | null | undefined };

/** +919876543210 → +91••••••3210: country code and last four digits stay visible. */
const maskPhone = (phone: string) => phone.replace(/^(\+\d{2})?(\d*)(\d{4})$/, (_, cc = '', mid: string, last: string) => cc + '•'.repeat(mid.length) + last);
const groupCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;
const pad = (n: number) => String(n).padStart(2, '0');
/** Seconds left → "23:59:59", or "9:59" under an hour. */
const clock = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}` : `${Math.floor(s / 60)}`) + `:${pad(s % 60)}`;

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / non-secure contexts
    const el = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    return ok;
  }
};

/** Bilingual, like whatsapp.ts. No health details. */
const whatsappCodeUrl = (name: string, phone: string | null | undefined, code: string, minutes: number) => {
  // Rounded down: never promise the patient more time than the code has
  const hours = minutes >= 90 ? Math.floor(minutes / 60) : 0;
  const text = [
    `Hello ${firstName(name)}, your Fit for Surgery sign-in code is ${groupCode(code)}. It expires in ${hours ? `${hours} hours` : `${minutes} minutes`}, or once you sign in with it. Do not share it with anyone.`,
    '',
    `नमस्ते ${firstName(name)}, आपका Fit for Surgery साइन-इन कोड ${groupCode(code)} है। यह ${hours ? `${hours} घंटे` : `${minutes} मिनट`} में, या इससे साइन इन करते ही, समाप्त हो जाएगा। इसे किसी के साथ साझा न करें।`,
  ].join('\n');
  return `https://wa.me/${phone?.replace(/\D/g, '') ?? ''}?text=${encodeURIComponent(text)}`;
};

const CodeView = ({ code, patientName, phone, onNew, creating }: { code: LoginCode; patientName: string; phone: Props['phone']; onNew: () => void; creating: boolean }) => {
  const toast = useToast();
  const expiresAt = new Date(code.expiresAt).getTime();
  const [now, setNow] = useState(Date.now);
  const left = Math.max(0, Math.round((expiresAt - now) / 1000));

  useEffect(() => {
    if (left === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [left === 0]); // eslint-disable-line react-hooks/exhaustive-deps

  if (left === 0) {
    return (
      <div className="space-y-4">
        <Alert tone="warning">This code has expired. Create a new one for {patientName}.</Alert>
        <Button className="w-full" onClick={onNew} loading={creating}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Create a new code
        </Button>
      </div>
    );
  }

  const copy = async () => (await copyText(code.code) ? toast.success('Code copied.') : toast.error('Could not copy. Please read the code out instead.'));
  const minutes = Math.max(1, Math.round((expiresAt - Date.now()) / 60_000));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-center">
        <p className="text-sm text-slate-700">
          {patientName}
          {phone && <span className="text-slate-600"> · {maskPhone(phone)}</span>}
        </p>
        <p className="mt-2 font-mono text-4xl font-bold tracking-[0.2em] text-slate-900 sm:text-5xl" aria-label={`Code ${code.code.split('').join(' ')}`}>
          {groupCode(code.code)}
        </p>
        <p className="mt-2 text-sm font-semibold text-teal-900" role="timer" aria-live="off">
          Expires in {clock(left)}
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => void copy()}>
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copy
        </Button>
        <a href={whatsappCodeUrl(patientName, phone, code.code, minutes)} target="_blank" rel="noopener noreferrer" className={buttonClass('success', 'md', 'flex-1')}>
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          WhatsApp
        </a>
      </div>
    </div>
  );
};

/** "Give sign-in code" button and its dialog: creates a one-time code for the patient to sign in with. */
export const LoginCodeDialog = ({ patientId, patientName, phone }: Props) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const create = useMutation({ mutationFn: () => patientService.createLoginCode(patientId) });

  const close = () => {
    setOpen(false);
    // Refreshed on close, not on success: on the requests page the row (and this dialog) would vanish mid-use
    if (create.data) void queryClient.invalidateQueries({ queryKey: qk.loginRequests });
    create.reset();
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        Give sign-in code
      </Button>
      {open && (
        <Modal title="Sign-in code" description={`For ${patientName}`} onClose={close}>
          <div className="space-y-4">
            {create.isError && <Alert tone="error">{errorMessage(create.error, 'Could not create a code. Please try again.')}</Alert>}
            {create.data ? (
              <CodeView key={create.data.code + create.data.expiresAt} code={create.data} patientName={patientName} phone={phone} onNew={() => create.mutate()} creating={create.isPending} />
            ) : (
              <Button className="w-full" onClick={() => create.mutate()} loading={create.isPending}>
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                Create code
              </Button>
            )}
            <p className="text-sm text-slate-600">
              A new code replaces any earlier one. The patient stays signed in on their phone after using it.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
};
