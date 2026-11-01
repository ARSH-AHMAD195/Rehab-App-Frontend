import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Video } from 'lucide-react';
import { exerciseService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { labelize } from '../../lib/format';
import { Badge, Button, ConfirmDialog, ErrorState, PageHeader, PageLoader } from '../../components/ui';
import { ExerciseFormModal } from '../../components/exercise/ExerciseFormModal';
import { useToast } from '../../components/ui/toast';
import type { Exercise } from '../../types/api';

export const AdminExercisesPage = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const [pendingToggle, setPendingToggle] = useState<Exercise | null>(null);

  const categories = useQuery({ queryKey: qk.categories(), queryFn: () => exerciseService.getCategories() });
  // ponytail: first 100 exercises, active and deactivated; add cursor paging when the library outgrows that
  const library = useQuery({ queryKey: qk.library({ active: 'all' }), queryFn: () => exerciseService.list({ active: 'all', limit: 100 }).then((r) => r.data) });

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

      {editing && <ExerciseFormModal exercise={editing === 'new' ? undefined : editing} categories={categories.data} onClose={() => setEditing(null)} />}

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
