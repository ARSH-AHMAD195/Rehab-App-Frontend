import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { exerciseService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { useFormErrors } from '../../lib/forms';
import { EXERCISE_CATEGORIES, FREQUENCIES, MIN } from '../../lib/constants';
import { labelize } from '../../lib/format';
import { Alert, Badge, Button, ConfirmDialog, ErrorState, Field, Input, Modal, ModalActions, PageHeader, PageLoader, Select, Textarea } from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import type { Exercise, ExerciseCategory } from '../../types/api';

const EMPTY_FORM = {
  title: '',
  description: '',
  category: 'mobility' as ExerciseCategory,
  instructions: '',
  videoUrl: '',
  defaultDurationMinutes: '15',
  defaultSets: '3',
  defaultReps: '10',
  defaultFrequency: 'Daily',
  safetyNotes: '',
  contraindications: '',
};
type FormState = typeof EMPTY_FORM;

const splitList = (text: string, separator: string | RegExp) =>
  text
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean);

const ADMIN_LIBRARY = { activeOnly: 'false' };

const AddExerciseModal = ({ onClose }: { onClose: () => void }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const [f, setF] = useState<FormState>(EMPTY_FORM);
  const set = (field: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [field]: e.target.value }));

  const create = useMutation({
    mutationFn: () =>
      exerciseService.createExercise({
        title: f.title.trim(),
        description: f.description.trim(),
        category: f.category,
        instructions: splitList(f.instructions, '\n'),
        videoUrl: f.videoUrl.trim(),
        defaultDurationMinutes: Number(f.defaultDurationMinutes),
        defaultSets: Number(f.defaultSets),
        defaultReps: Number(f.defaultReps),
        defaultFrequency: f.defaultFrequency,
        contraindications: splitList(f.contraindications, ','),
        // Omit when blank so the server's standard safety notice applies
        ...(f.safetyNotes.trim() && { safetyNotes: f.safetyNotes.trim() }),
      }),
    onSuccess: () => {
      toast.success(`"${f.title.trim()}" added to the exercise library.`);
      void queryClient.invalidateQueries({ queryKey: ['library'] });
      onClose();
    },
    onError: (err) => form.fromApiError(err, 'Could not create the exercise. Please try again.'),
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const steps = e.currentTarget.elements.namedItem('instructions') as HTMLTextAreaElement;
    steps.setCustomValidity(splitList(f.instructions, '\n').length ? '' : 'Add at least one step.');
    if (form.validate(e.currentTarget)) create.mutate();
  };

  return (
    <Modal title="Add an exercise" description="Becomes available to all doctors for prescribing" onClose={onClose} size="xl">
      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        <Field label="Title" error={form.errors.title}>
          <Input name="title" required minLength={MIN.exerciseTitle} maxLength={150} value={f.title} onChange={set('title')} placeholder="e.g. Inspiratory muscle training" />
        </Field>
        <Field label="Description" error={form.errors.description}>
          <Textarea name="description" rows={2} required minLength={MIN.exerciseDescription} maxLength={1000} value={f.description} onChange={set('description')} placeholder="Clinical objective and benefits." />
        </Field>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Category">
            <Select name="category" value={f.category} onChange={set('category')}>
              {EXERCISE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {labelize(c)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Default frequency">
            <Select name="defaultFrequency" value={f.defaultFrequency} onChange={set('defaultFrequency')}>
              {FREQUENCIES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </Field>
          <Field label="Minutes" error={form.errors.defaultDurationMinutes}>
            <Input name="defaultDurationMinutes" type="number" inputMode="numeric" min="1" max="180" required value={f.defaultDurationMinutes} onChange={set('defaultDurationMinutes')} />
          </Field>
          <Field label="Sets" error={form.errors.defaultSets}>
            <Input name="defaultSets" type="number" inputMode="numeric" min="1" max="20" required value={f.defaultSets} onChange={set('defaultSets')} />
          </Field>
          <Field label="Reps" error={form.errors.defaultReps}>
            <Input name="defaultReps" type="number" inputMode="numeric" min="0" max="100" required value={f.defaultReps} onChange={set('defaultReps')} />
          </Field>
        </div>
        <Field label="Step-by-step instructions" hint="One step per line" error={form.errors.instructions}>
          <Textarea name="instructions" rows={4} value={f.instructions} onChange={(e) => {
            e.target.setCustomValidity('');
            set('instructions')(e);
          }} />
        </Field>
        <Field label="Safety notes (optional)" hint="Leave blank to use the standard safety notice">
          <Textarea name="safetyNotes" rows={2} maxLength={1000} value={f.safetyNotes} onChange={set('safetyNotes')} />
        </Field>
        <Field label="Contraindications (optional)" hint="Separate with commas">
          <Input name="contraindications" value={f.contraindications} onChange={set('contraindications')} placeholder="e.g. Unstable angina, Acute DVT" />
        </Field>
        <Field label="Video URL (optional)" error={form.errors.videoUrl}>
          <Input name="videoUrl" type="url" value={f.videoUrl} onChange={set('videoUrl')} placeholder="https://www.youtube.com/watch?v=…" />
        </Field>
        <ModalActions onCancel={onClose} submitLabel="Save to library" loading={create.isPending} />
      </form>
    </Modal>
  );
};

export const AdminExercisesPage = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<Exercise | null>(null);

  const library = useQuery({ queryKey: qk.library(ADMIN_LIBRARY), queryFn: () => exerciseService.getLibrary(ADMIN_LIBRARY).then((r) => r.exercises) });

  const toggle = useMutation({
    mutationFn: (ex: Exercise) => (ex.isActive ? exerciseService.deactivateExercise(ex._id) : exerciseService.updateExercise(ex._id, { isActive: true })),
    onSuccess: (_res, ex) => {
      toast.success(`"${ex.title}" ${ex.isActive ? 'deactivated' : 'reactivated'}.`);
      setPendingToggle(null);
      void queryClient.invalidateQueries({ queryKey: ['library'] });
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not update the exercise.')),
  });

  if (library.isPending) return <PageLoader label="Loading exercise library…" />;
  if (library.isError) return <ErrorState error={library.error} onRetry={() => void library.refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exercise library"
        description="Standard prehabilitation exercises doctors can prescribe"
        actions={
          <Button onClick={() => setShowAdd(true)}>
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
                <th scope="col" className="p-4">Defaults</th>
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
                  <tr key={ex._id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <span className="block font-semibold text-slate-900">{ex.title}</span>
                      <span className="line-clamp-1 text-slate-600">{ex.description}</span>
                    </td>
                    <td className="p-4">
                      <Badge tone="teal">{labelize(ex.category)}</Badge>
                    </td>
                    <td className="whitespace-nowrap p-4 text-slate-700">
                      {ex.defaultDurationMinutes}m · {ex.defaultSets} × {ex.defaultReps} · {ex.defaultFrequency}
                    </td>
                    <td className="p-4">
                      <Badge tone={ex.isActive ? 'emerald' : 'slate'}>{ex.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="p-4 text-right">
                      <Button variant={ex.isActive ? 'danger' : 'success'} size="sm" onClick={() => setPendingToggle(ex)}>
                        {ex.isActive ? 'Deactivate' : 'Activate'}
                        <span className="sr-only"> {ex.title}</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && <AddExerciseModal onClose={() => setShowAdd(false)} />}

      {pendingToggle && (
        <ConfirmDialog
          title={pendingToggle.isActive ? 'Deactivate this exercise?' : 'Reactivate this exercise?'}
          message={
            pendingToggle.isActive
              ? `"${pendingToggle.title}" won't be available for new prescriptions. Existing prescriptions are not changed.`
              : `"${pendingToggle.title}" will be available for prescribing again.`
          }
          confirmLabel={pendingToggle.isActive ? 'Deactivate' : 'Reactivate'}
          tone={pendingToggle.isActive ? 'danger' : 'primary'}
          loading={toggle.isPending}
          onConfirm={() => toggle.mutate(pendingToggle)}
          onCancel={() => setPendingToggle(null)}
        />
      )}
    </div>
  );
};
