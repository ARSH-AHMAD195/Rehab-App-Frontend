import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clinicalNoteService, exerciseService, followUpService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { useFormErrors } from '../../lib/forms';
import { FREQUENCIES, MIN, NOTE_TYPES } from '../../lib/constants';
import { labelize } from '../../lib/format';
import { Alert, Field, Input, Modal, ModalActions, PageLoader, Select, Textarea } from '../ui';
import { useToast } from '../ui/toast';
import type { NoteType } from '../../types/api';

type ModalProps = { patientId: string; onClose: () => void };

/** Save → toast → refresh this patient's chart → close; inline (field-level) errors on failure. */
const usePatientMutation = <T,>(patientId: string, fn: (input: T) => Promise<unknown>, successMessage: string, onClose: () => void) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const mutation = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(successMessage);
      void queryClient.invalidateQueries({ queryKey: qk.patient(patientId) });
      void queryClient.invalidateQueries({ queryKey: qk.alerts });
      onClose();
    },
    onError: (err) => form.fromApiError(err),
  });
  const submit = (input: T) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.validate(e.currentTarget)) mutation.mutate(input);
  };
  return { form, mutation, submit };
};

export const PrescribeExerciseModal = ({ patientId, onClose }: ModalProps) => {
  const library = useQuery({ queryKey: qk.library({}), queryFn: () => exerciseService.getLibrary().then((r) => r.exercises) });
  const [f, setF] = useState({ exerciseId: '', frequency: 'Daily', duration: '15', sets: '3', reps: '10', instructions: '' });
  const set = (field: keyof typeof f) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [field]: e.target.value }));

  const pickExercise = (e: ChangeEvent<HTMLSelectElement>) => {
    const ex = library.data?.find((x) => x._id === e.target.value);
    setF((p) => ({
      ...p,
      exerciseId: e.target.value,
      ...(ex && {
        duration: String(ex.defaultDurationMinutes),
        sets: String(ex.defaultSets),
        reps: String(Math.max(1, ex.defaultReps)),
        frequency: (FREQUENCIES as readonly string[]).includes(ex.defaultFrequency) ? ex.defaultFrequency : p.frequency,
      }),
    }));
  };

  const { form, mutation, submit } = usePatientMutation(
    patientId,
    () =>
      exerciseService.assignExercise({
        patientId,
        exerciseId: f.exerciseId,
        frequency: f.frequency,
        customizedDurationMinutes: Number(f.duration),
        customizedSets: Number(f.sets),
        customizedReps: Number(f.reps),
        customizedInstructions: f.instructions.trim(),
      }),
    'Exercise prescribed. The patient has been notified.',
    onClose
  );

  return (
    <Modal title="Prescribe exercise" description="Choose an approved exercise and calibrate its parameters" onClose={onClose} size="lg">
      {library.isPending ? (
        <PageLoader label="Loading exercise library…" />
      ) : library.isError ? (
        <Alert tone="error">{errorMessage(library.error)}</Alert>
      ) : (
        <form noValidate onSubmit={submit(undefined)} onChange={form.onChange} className="space-y-4">
          {form.formError && <Alert tone="error">{form.formError}</Alert>}
          <Field label="Exercise" error={form.errors.exerciseId}>
            <Select name="exerciseId" required value={f.exerciseId} onChange={pickExercise}>
              <option value="">Choose an exercise…</option>
              {library.data.map((ex) => (
                <option key={ex._id} value={ex._id}>
                  {ex.title} ({labelize(ex.category)})
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Minutes" error={form.errors.customizedDurationMinutes}>
              <Input name="customizedDurationMinutes" type="number" inputMode="numeric" min="1" max="180" required value={f.duration} onChange={set('duration')} />
            </Field>
            <Field label="Sets" error={form.errors.customizedSets}>
              <Input name="customizedSets" type="number" inputMode="numeric" min="1" max="20" required value={f.sets} onChange={set('sets')} />
            </Field>
            <Field label="Reps" error={form.errors.customizedReps}>
              <Input name="customizedReps" type="number" inputMode="numeric" min="1" max="100" required value={f.reps} onChange={set('reps')} />
            </Field>
          </div>
          <Field label="Frequency">
            <Select name="frequency" value={f.frequency} onChange={set('frequency')}>
              {FREQUENCIES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </Field>
          <Field label="Guidance for the patient (optional)">
            <Textarea name="customizedInstructions" rows={3} maxLength={1000} value={f.instructions} onChange={set('instructions')} placeholder="e.g. Slow controlled descent. Rest 60s between sets." />
          </Field>
          <ModalActions onCancel={onClose} submitLabel="Confirm prescription" loading={mutation.isPending} />
        </form>
      )}
    </Modal>
  );
};

export const ClinicalNoteModal = ({ patientId, onClose }: ModalProps) => {
  const [noteType, setNoteType] = useState<NoteType>('progress_review');
  const [content, setContent] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);

  const { form, mutation, submit } = usePatientMutation(
    patientId,
    () => clinicalNoteService.createNote({ patientId, noteType, content: content.trim(), followUpInstructions: instructions.trim(), isConfidential }),
    'Clinical note saved to the patient chart.',
    onClose
  );

  return (
    <Modal title="Add clinical note" description="Recorded to the patient’s surgical chart" onClose={onClose} size="lg">
      <form noValidate onSubmit={submit(undefined)} onChange={form.onChange} className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        <Field label="Note type">
          <Select name="noteType" value={noteType} onChange={(e) => setNoteType(e.target.value as NoteType)}>
            {NOTE_TYPES.map((t) => (
              <option key={t} value={t}>
                {labelize(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Clinical assessment" error={form.errors.content} hint={`At least ${MIN.noteContent} characters`}>
          <Textarea name="content" rows={5} required minLength={MIN.noteContent} maxLength={5000} value={content} onChange={(e) => setContent(e.target.value)} />
        </Field>
        <Field label="Instructions for the patient (optional)">
          <Input name="followUpInstructions" maxLength={1000} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </Field>
        <label className="flex items-start gap-3 text-sm text-slate-800">
          <input type="checkbox" checked={isConfidential} onChange={(e) => setIsConfidential(e.target.checked)} className="mt-0.5 h-5 w-5 rounded border-slate-400 text-teal-700 focus:ring-teal-600" />
          <span>
            <strong>Confidential</strong>: visible to clinicians only, and the patient is not notified.
          </span>
        </label>
        <ModalActions onCancel={onClose} submitLabel="Save note" loading={mutation.isPending} />
      </form>
    </Modal>
  );
};

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time
const nowForInput = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export const FollowUpModal = ({ patientId, onClose }: ModalProps) => {
  const [scheduledDate, setScheduledDate] = useState('');
  const [reason, setReason] = useState('Pre-operative adherence check-in');
  const [notes, setNotes] = useState('');

  const { form, mutation, submit } = usePatientMutation(
    patientId,
    () =>
      followUpService.createFollowUp({
        patientId,
        // The input is local wall-clock time; send an absolute instant so the server can't reinterpret it
        scheduledDate: new Date(scheduledDate).toISOString(),
        reason: reason.trim(),
        notes: notes.trim(),
      }),
    'Follow-up scheduled. The patient has been notified.',
    onClose
  );

  return (
    <Modal title="Schedule follow-up" description="The patient is notified in their portal" onClose={onClose}>
      <form noValidate onSubmit={submit(undefined)} onChange={form.onChange} className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        <Field label="Date & time" error={form.errors.scheduledDate}>
          <Input name="scheduledDate" type="datetime-local" required min={nowForInput()} value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
        </Field>
        <Field label="Reason / milestone" error={form.errors.reason}>
          <Input name="reason" required minLength={MIN.followUpReason} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field label="Notes (optional)">
          <Input name="notes" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Clinical objectives to evaluate." />
        </Field>
        <ModalActions onCancel={onClose} submitLabel="Schedule" loading={mutation.isPending} />
      </form>
    </Modal>
  );
};
