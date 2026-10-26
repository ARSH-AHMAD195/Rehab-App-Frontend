import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { completionService } from '../../services/apiServices';
import { ApiError } from '../../services/api';
import { useFormErrors } from '../../lib/forms';
import { Alert, Field, Input, Modal, ModalActions, Textarea } from '../ui';
import { useToast } from '../ui/toast';
import type { ChecklistItem } from '../../types/api';

/** Ticks one planned exercise off for today. Minutes and a note are optional. */
export const CompleteExerciseModal = ({ item, date, onClose }: { item: ChecklistItem; date: string; onClose: () => void }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const [minutes, setMinutes] = useState(item.target?.durationMin ? String(item.target.durationMin) : '');
  const [note, setNote] = useState('');
  // One key per tick attempt: a retry after a timeout is never counted twice
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const save = useMutation({
    mutationFn: () => {
      const details = { ...(minutes && { durationMin: Number(minutes) }), ...(note.trim() && { note: note.trim() }) };
      return completionService.complete({ itemId: item.itemId, date, details: Object.keys(details).length ? details : null }, idempotencyKey);
    },
    onSuccess: () => {
      toast.success(`Well done! "${item.exercise.name}" is ticked off.`);
      void queryClient.invalidateQueries({ queryKey: ['my'] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && ['DAY_CHANGED', 'EXERCISE_ALREADY_DONE', 'EXERCISE_NOT_IN_PLAN'].includes(err.code)) {
        void queryClient.invalidateQueries({ queryKey: ['my'] });
      }
      form.fromApiError(err, 'Could not save. Please try again.');
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.validate(e.currentTarget)) save.mutate();
  };

  return (
    <Modal title="Mark as done" description={item.exercise.name} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        <Field label="Minutes (optional)" error={form.errors['details.durationMin']}>
          <Input name="details.durationMin" type="number" inputMode="numeric" min="1" max="240" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
        <Field label="Note for your care team (optional)" error={form.errors['details.note']}>
          <Textarea name="details.note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Slight knee soreness at the end" />
        </Field>
        <ModalActions onCancel={onClose} submitLabel="Done" loading={save.isPending} />
      </form>
    </Modal>
  );
};
