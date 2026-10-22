import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exerciseService } from '../../services/apiServices';
import { useFormErrors } from '../../lib/forms';
import { cn } from '../../lib/cn';
import { Alert, Field, Input, Modal, Spinner, Textarea } from '../ui';
import { useToast } from '../ui/toast';
import type { ExerciseAssignment } from '../../types/api';

// Plain-language effort levels mapped onto the 1–10 perceived-exertion scale the backend stores.
// The patient always picks one: we never record an effort score they didn't give.
const EFFORT = [
  { value: 3, label: 'Easy', hint: 'I could talk normally' },
  { value: 5, label: 'Moderate', hint: 'A little out of breath' },
  { value: 7, label: 'Hard', hint: 'Hard to hold a conversation' },
  { value: 9, label: 'Very hard', hint: 'I couldn’t have kept going much longer' },
] as const;

/** Two taps to log a session: "Done" → how it felt. Minutes default to the prescription. */
export const LogSessionModal = ({ assignment, onClose }: { assignment: ExerciseAssignment; onClose: () => void }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const prescribed = assignment.customizedDurationMinutes || 15;
  const [duration, setDuration] = useState(String(prescribed));
  const [feedback, setFeedback] = useState('');

  const save = useMutation({
    mutationFn: (perceivedExertion: number) =>
      exerciseService.logSession({
        assignmentId: assignment._id,
        durationMinutes: Number(duration),
        perceivedExertion,
        patientFeedback: feedback.trim(),
        status: 'completed',
      }),
    onSuccess: () => {
      toast.success(`Well done! "${assignment.exercise?.title}" is logged.`);
      void queryClient.invalidateQueries({ queryKey: ['my'] });
      onClose();
    },
    onError: (err) => form.fromApiError(err, 'Could not save this session. Please try again.'),
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const effort = Number(((e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null)?.value);
    if (effort && form.validate(e.currentTarget)) save.mutate(effort);
  };

  return (
    <Modal title="How hard did it feel?" description={`${assignment.exercise?.title} · ${duration || prescribed} minutes`} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}

        <div className="grid gap-2" role="group" aria-label="Choose how hard it felt to save the session">
          {EFFORT.map(({ value, label, hint }) => (
            <button
              key={value}
              type="submit"
              name="effort"
              value={value}
              disabled={save.isPending}
              className={cn(
                'flex min-h-14 items-center justify-between gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-left transition-colors',
                'hover:border-teal-600 hover:bg-teal-50 focus-visible:border-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 disabled:opacity-60'
              )}
            >
              <span>
                <span className="block text-base font-bold text-slate-900">{label}</span>
                <span className="block text-sm text-slate-600">{hint}</span>
              </span>
              {save.isPending && save.variables === value && <Spinner className="h-5 w-5 border-2" />}
            </button>
          ))}
        </div>

        <details className="rounded-2xl border border-slate-200 p-3" open={Boolean(form.errors.durationMinutes)}>
          <summary className="cursor-pointer text-sm font-semibold text-teal-800">Change minutes or add a note</summary>
          <div className="mt-3 space-y-3">
            <Field label="Minutes completed" error={form.errors.durationMinutes} hint={`Prescribed: ${prescribed} minutes`}>
              <Input name="durationMinutes" type="number" inputMode="numeric" min="1" max="300" required value={duration} onChange={(e) => setDuration(e.target.value)} />
            </Field>
            <Field label="Note for your care team (optional)">
              <Textarea name="patientFeedback" rows={2} maxLength={500} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="e.g. Slight knee soreness at the end" />
            </Field>
          </div>
        </details>
      </form>
    </Modal>
  );
};
