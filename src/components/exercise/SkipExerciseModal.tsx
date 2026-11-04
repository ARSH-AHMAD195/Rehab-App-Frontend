import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XCircle } from 'lucide-react';
import { completionService } from '../../services/apiServices';
import { ApiError } from '../../services/api';
import { useFormErrors } from '../../lib/forms';
import { cn } from '../../lib/cn';
import { t } from '../../lib/i18n';
import { Alert, Field, Input, Modal, ModalActions } from '../ui';
import { useToast } from '../ui/toast';
import type { ChecklistItem } from '../../types/api';

const REASONS = ['Too tired', 'Pain or discomfort', 'Felt unwell', 'No time', 'Other'] as const;

/** "I couldn't do this today": skips the rest of this exercise for the day, with a reason the doctor sees. */
export const SkipExerciseModal = ({ item, date, onClose }: { item: ChecklistItem; date: string; onClose: () => void }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const [reason, setReason] = useState<(typeof REASONS)[number]>('Too tired');
  const [other, setOther] = useState('');
  // One key per attempt: a retry after a timeout never records the skip twice
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const skip = useMutation({
    mutationFn: () =>
      completionService.complete({ itemId: item.itemId, date, status: 'SKIPPED', reason: reason === 'Other' ? other.trim() || 'Other' : reason }, idempotencyKey),
    onSuccess: () => {
      toast.success(t('"{name}" skipped for today. Your care team can see why.', { name: item.exercise.name }));
      void queryClient.invalidateQueries({ queryKey: ['my'] });
      onClose();
    },
    onError: (err) => {
      // Already done, already skipped, or the day changed: show the checklist as it is now
      if (err instanceof ApiError && ['EXERCISE_SKIPPED', 'EXERCISE_ALREADY_DONE', 'DAY_CHANGED', 'EXERCISE_NOT_IN_PLAN'].includes(err.code)) {
        void queryClient.invalidateQueries({ queryKey: ['my'] });
      }
      form.fromApiError(err, 'Could not save. Please try again.');
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.validate(e.currentTarget)) skip.mutate();
  };

  return (
    <Modal title="Couldn’t do it today?" description={item.exercise.name} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-slate-800">{t('What got in the way?')}</legend>
          <div className="grid gap-2">
            {REASONS.map((r) => (
              <label key={r} className="cursor-pointer">
                <input type="radio" name="reasonChoice" className="peer sr-only" checked={reason === r} onChange={() => setReason(r)} />
                <span
                  className={cn(
                    'flex min-h-11 items-center rounded-xl border-2 px-3 text-sm font-semibold',
                    'peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600 peer-focus-visible:ring-offset-2',
                    reason === r ? 'border-teal-700 bg-teal-50 text-teal-950' : 'border-slate-200 bg-white text-slate-800'
                  )}
                >
                  {t(r)}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {reason === 'Other' && (
          <Field label="Tell us briefly" error={form.errors.reason}>
            <Input name="reason" maxLength={500} value={other} onChange={(e) => setOther(e.target.value)} />
          </Field>
        )}
        <p className="text-sm text-slate-600">{t('Your care team will see this and your reason. Tell them if it keeps happening, or if you have pain.')}</p>
        <ModalActions onCancel={onClose} submitLabel="Skip for today" submitIcon={XCircle} loading={skip.isPending} />
      </form>
    </Modal>
  );
};
