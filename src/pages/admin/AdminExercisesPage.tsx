import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Video } from 'lucide-react';
import { exerciseService, type ExerciseInput } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { useFormErrors } from '../../lib/forms';
import { labelize, splitList } from '../../lib/format';
import { Alert, Badge, Button, ConfirmDialog, ErrorState, Field, Input, Modal, ModalActions, PageHeader, PageLoader, Select, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import type { Category, Exercise } from '../../types/api';

const formOf = (ex?: Exercise) => ({
  name: ex?.name ?? '',
  categoryId: ex?.categoryId ?? '',
  description: ex?.description ?? '',
  instructions: ex?.instructions.join('\n') ?? '',
  videoUrl: ex?.video?.url ?? '',
});

/** Adds an exercise, or edits one. Only changed fields are sent; a video link is checked with YouTube on save. */
const ExerciseModal = ({ exercise, categories, onClose }: { exercise?: Exercise; categories: Category[]; onClose: () => void }) => {
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

export const AdminExercisesPage = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const [pendingToggle, setPendingToggle] = useState<Exercise | null>(null);

  const categories = useQuery({ queryKey: qk.categories(), queryFn: () => exerciseService.getCategories() });
  // The API lists active and deactivated exercises separately.
  // ponytail: first 100 of each; add cursor paging when the library outgrows that
  const library = useQuery({
    queryKey: qk.library({ admin: true }),
    queryFn: async () => {
      const [active, inactive] = await Promise.all([exerciseService.list({ active: true, limit: 100 }), exerciseService.list({ active: false, limit: 100 })]);
      return [...active.data, ...inactive.data];
    },
  });

  const toggle = useMutation({
    mutationFn: (ex: Exercise) => (ex.active ? exerciseService.deactivate(ex.id) : exerciseService.update(ex.id, { active: true })),
    onSuccess: (_res, ex) => {
      toast.success(`"${ex.name}" ${ex.active ? 'deactivated' : 'reactivated'}.`);
      setPendingToggle(null);
      void queryClient.invalidateQueries({ queryKey: ['library'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not update the exercise.')),
  });

  if (library.isPending || categories.isPending) return <PageLoader label="Loading exercise library…" />;
  if (library.isError || categories.isError) return <ErrorState error={library.error ?? categories.error} onRetry={() => void library.refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exercise library"
        description="Exercises doctors can put in a patient’s plan"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add exercise
          </Button>
        }
      />

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="p-4">Exercise</th>
                <th scope="col" className="p-4">Category</th>
                <th scope="col" className="p-4">Video</th>
                <th scope="col" className="p-4">Status</th>
                <th scope="col" className="p-4 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {library.data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-600">
                    The library is empty. Add the first exercise.
                  </td>
                </tr>
              ) : (
                library.data.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <span className="block font-semibold text-slate-900">{ex.name}</span>
                      {ex.description && <span className="line-clamp-1 text-slate-600">{ex.description}</span>}
                    </td>
                    <td className="p-4">
                      <Badge tone="teal">{labelize(ex.category)}</Badge>
                    </td>
                    <td className="p-4">
                      {ex.video ? (
                        <a href={ex.video.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-teal-800 underline">
                          <Video className="h-4 w-4" aria-hidden="true" />
                          Watch<span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      ) : (
                        <span className="text-slate-500">None</span>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge tone={ex.active ? 'emerald' : 'slate'}>{ex.active ? 'Active' : 'Deactivated'}</Badge>
                    </td>
                    <td className="whitespace-nowrap p-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(ex)} aria-label={`Edit ${ex.name}`}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button variant={ex.active ? 'danger' : 'success'} size="sm" onClick={() => setPendingToggle(ex)}>
                        {ex.active ? 'Deactivate' : 'Activate'}
                        <span className="sr-only"> {ex.name}</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <ExerciseModal exercise={editing === 'new' ? undefined : editing} categories={categories.data} onClose={() => setEditing(null)} />}

      {pendingToggle && (
        <ConfirmDialog
          title={pendingToggle.active ? 'Deactivate this exercise?' : 'Reactivate this exercise?'}
          message={
            pendingToggle.active
              ? `"${pendingToggle.name}" can’t be added to new plans. Plans that already include it keep it until the doctor changes them.`
              : `"${pendingToggle.name}" can be added to plans again.`
          }
          confirmLabel={pendingToggle.active ? 'Deactivate' : 'Reactivate'}
          tone={pendingToggle.active ? 'danger' : 'primary'}
          loading={toggle.isPending}
          onConfirm={() => toggle.mutate(pendingToggle)}
          onCancel={() => setPendingToggle(null)}
        />
      )}
    </div>
  );
};
