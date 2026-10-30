import { useState, type FormEvent } from 'react';
import { XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Field, Input, Modal, ModalActions } from '../ui';

const REASONS = ['Too tired', 'Pain or discomfort', 'Felt unwell', 'No time', 'Other'] as const;

/** "I couldn't do this today": asks why. Saved on this device only (see lib/skips.ts). */
export const SkipExerciseModal = ({ name, onSkip, onClose }: { name: string; onSkip: (reason: string) => void; onClose: () => void }) => {
  const [reason, setReason] = useState<(typeof REASONS)[number]>('Too tired');
  const [other, setOther] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSkip(reason === 'Other' ? other.trim() || 'Other' : reason);
    onClose();
  };

  return (
    <Modal title="Couldn’t do it today?" description={name} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-800">What got in the way?</legend>
          <div className="grid gap-2">
            {REASONS.map((r) => (
              <label key={r} className="cursor-pointer">
                <input type="radio" name="reason" className="peer sr-only" checked={reason === r} onChange={() => setReason(r)} />
                <span
                  className={cn(
                    'flex min-h-11 items-center rounded-xl border-2 px-3 text-sm font-semibold',
                    'peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600 peer-focus-visible:ring-offset-2',
                    reason === r ? 'border-teal-700 bg-teal-50 text-teal-950' : 'border-slate-200 bg-white text-slate-800'
                  )}
                >
                  {r}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {reason === 'Other' && (
          <Field label="Tell us briefly (optional)">
            <Input name="other" maxLength={100} value={other} onChange={(e) => setOther(e.target.value)} />
          </Field>
        )}
        <p className="text-sm text-slate-600">Your care team will see this as not done. Tell them if it keeps happening, or if you have pain.</p>
        <ModalActions onCancel={onClose} submitLabel="Skip for today" submitIcon={XCircle} />
      </form>
    </Modal>
  );
};
