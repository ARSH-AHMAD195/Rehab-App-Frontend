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
});

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
  const set = (field: keyof typeof initial) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [field]: e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      const all: ExerciseInput = {
        name: f.name.trim(),
        categoryId: f.categoryId,
        description: f.description.trim() || null,
        instructions: splitList(f.instructions, '\n'),
        videoUrl: f.videoUrl.trim() || null,
      };
      if (!exercise) return exerciseService.create({ ...all, name: all.name!, categoryId: all.categoryId! });
      const changed = Object.fromEntries(Object.entries(all).filter(([k]) => f[k as keyof typeof f] !== initial[k as keyof typeof initial]));
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
        <ModalActions onCancel={onClose} submitLabel={exercise ? 'Save changes' : 'Save to library'} loading={save.isPending} />
      </form>
    </Modal>
  );
};
