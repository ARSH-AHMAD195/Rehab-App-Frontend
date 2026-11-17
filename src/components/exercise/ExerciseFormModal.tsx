import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { exerciseService, type ExerciseInput } from '../../services/apiServices';
import { useFormErrors } from '../../lib/forms';
import { splitList } from '../../lib/format';
import { Alert, Field, Input, Modal, ModalActions, Select, Textarea } from '../ui';
import { useToast } from '../ui/toast';
import type { Category, Exercise } from '../../types/api';

const formOf = (ex?: Exercise) => ({
  name: ex?.name ?? '',
  categoryId: ex?.categoryId ?? '',
  description: ex?.description ?? '',
  instructions: ex?.instructions.join('\n') ?? '',
  videoUrl: ex?.video?.url ?? '',
  recordsVolume: ex?.recordsVolume ?? false,
  hiName: ex?.hi?.name ?? '',
  hiDescription: ex?.hi?.description ?? '',
  hiInstructions: ex?.hi?.instructions.join('\n') ?? '',
});
type Form = ReturnType<typeof formOf>;

const toInput = (f: Form): ExerciseInput => {
  const hi = { name: f.hiName.trim() || null, description: f.hiDescription.trim() || null, instructions: splitList(f.hiInstructions, '\n') };
  return {
    name: f.name.trim(),
    categoryId: f.categoryId,
    description: f.description.trim() || null,
    instructions: splitList(f.instructions, '\n'),
    videoUrl: f.videoUrl.trim() || null,
    recordsVolume: f.recordsVolume,
    hi: hi.name || hi.description || hi.instructions.length ? hi : null,
  };
};

/**
 * Adds an exercise, or edits one. Admins and doctors both use it; the API lets a doctor edit only
 * exercises they added. Only changed fields are sent; a video link is checked with YouTube on save.
 */
export const ExerciseFormModal = ({ exercise, categories, onClose }: { exercise?: Exercise; categories: Category[]; onClose: () => void }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const initial = formOf(exercise);
  const [f, setF] = useState(initial);
  const set = (field: Exclude<keyof Form, 'recordsVolume'>) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [field]: e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      const all = toInput(f);
      if (!exercise) return exerciseService.create({ ...all, name: all.name!, categoryId: all.categoryId! });
      const before = toInput(initial);
      const changed = Object.fromEntries(Object.entries(all).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(before[k as keyof ExerciseInput])));
      return exerciseService.update(exercise.id, changed);
    },
    onSuccess: (ex) => {
      toast.success(`"${ex.name}" ${exercise ? 'updated' : 'added to the library'}.`);
      void queryClient.invalidateQueries({ queryKey: ['library'] });
      onClose();
    },
    onError: (err) => form.fromApiError(err, 'Could not save the exercise. Please try again.'),
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.validate(e.currentTarget)) save.mutate();
  };

  return (
    <Modal title={exercise ? 'Edit exercise' : 'Add an exercise'} description="Doctors pick from the library when assigning plans" onClose={onClose} size="xl">
      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={form.errors.name}>
            <Input name="name" required maxLength={150} value={f.name} onChange={set('name')} placeholder="e.g. Seated knee extension" />
          </Field>
          <Field label="Category" error={form.errors.categoryId}>
            <Select name="categoryId" required value={f.categoryId} onChange={set('categoryId')}>
              <option value="">Choose…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Description (optional)" error={form.errors.description}>
          <Textarea name="description" rows={2} value={f.description} onChange={set('description')} placeholder="What it’s for." />
        </Field>
        <Field label="Step-by-step instructions" hint="One step per line" error={form.errors.instructions}>
          <Textarea name="instructions" rows={4} value={f.instructions} onChange={set('instructions')} />
        </Field>
        <Field label="YouTube video (optional)" hint="Unlisted or Public, with embedding allowed. It’s checked with YouTube when you save." error={form.errors.videoUrl}>
          <Input name="videoUrl" value={f.videoUrl} onChange={set('videoUrl')} placeholder="https://youtu.be/…" />
        </Field>
        <label className="flex min-h-11 items-center gap-2.5 text-sm font-semibold text-slate-800">
          <input
            type="checkbox"
            name="recordsVolume"
            className="h-4 w-4 accent-teal-700"
            checked={f.recordsVolume}
            onChange={(e) => setF((p) => ({ ...p, recordsVolume: e.target.checked }))}
          />
          Incentive spirometry: ask the patient for the volume reached (mL)
        </label>
        <details className="rounded-xl border border-slate-200 p-3" open={Boolean(initial.hiName || initial.hiDescription || initial.hiInstructions)}>
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">Hindi text (optional)</summary>
          <p className="mt-1 text-xs text-slate-600">Shown to patients using the app in Hindi. Anything left blank shows in English.</p>
          <div className="mt-3 space-y-4" lang="hi">
            <Field label="Name in Hindi" error={form.errors['hi.name']}>
              <Input name="hi.name" value={f.hiName} onChange={set('hiName')} />
            </Field>
            <Field label="Description in Hindi" error={form.errors['hi.description']}>
              <Textarea name="hi.description" rows={2} value={f.hiDescription} onChange={set('hiDescription')} />
            </Field>
            <Field label="Instructions in Hindi" hint="One step per line" error={form.errors['hi.instructions']}>
              <Textarea name="hi.instructions" rows={4} value={f.hiInstructions} onChange={set('hiInstructions')} />
            </Field>
          </div>
        </details>
        <ModalActions onCancel={onClose} submitLabel={exercise ? 'Save changes' : 'Save to library'} loading={save.isPending} />
      </form>
    </Modal>
  );
};
