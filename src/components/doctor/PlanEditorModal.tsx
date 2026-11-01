import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2 } from 'lucide-react';
import { exerciseService, planService, type PlanItemInput } from '../../services/apiServices';
import { ApiError } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { useFormErrors } from '../../lib/forms';
import { EVERY_DAY, WEEKDAYS } from '../../lib/constants';
import { cn } from '../../lib/cn';
import { Alert, Button, EmptyState, Field, Input, Modal, ModalActions, PageLoader, Select } from '../ui';
import { useToast } from '../ui/toast';
import type { Plan } from '../../types/api';

type Row = { exerciseId: string; daysOfWeek: number[]; timesPerDay: string; sets: string; reps: string; durationMin: string; notes: string };

const toRows = (plan: Plan): Row[] =>
  plan.items.map((i) => ({
    exerciseId: i.exercise.id,
    daysOfWeek: i.schedule.daysOfWeek,
    timesPerDay: String(i.schedule.timesPerDay),
    sets: i.target?.sets?.toString() ?? '',
    reps: i.target?.reps?.toString() ?? '',
    durationMin: i.target?.durationMin?.toString() ?? '',
    notes: i.notes ?? '',
  }));

const num = (s: string) => (s.trim() ? Number(s) : null);

const toItems = (rows: Row[]): PlanItemInput[] =>
  rows.map((r) => ({
    exerciseId: r.exerciseId,
    schedule: { daysOfWeek: [...r.daysOfWeek].sort(), timesPerDay: Number(r.timesPerDay) },
    target: r.sets || r.reps || r.durationMin ? { sets: num(r.sets), reps: num(r.reps), durationMin: num(r.durationMin) } : null,
    notes: r.notes.trim() || null,
  }));

/** Assigns or replaces a patient's whole plan. Every save is a new version; old ones are kept. */
export const PlanEditorModal = ({ patientId, plan, onClose }: { patientId: string; plan: Plan; onClose: () => void }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const [rows, setRows] = useState<Row[]>(() => toRows(plan));
  const [search, setSearch] = useState('');

  const library = useQuery({ queryKey: qk.library({ active: true, limit: 100 }), queryFn: () => exerciseService.list({ active: true, limit: 100 }) });
  const exercises = library.data?.data ?? [];
  // Exercises already in the plan stay pickable even if an admin has since deactivated them
  const options = [...exercises, ...plan.items.map((i) => i.exercise).filter((e) => !exercises.some((x) => x.id === e.id))];
  const term = search.trim().toLowerCase();
  // A row's current choice always stays in its list, even when the search hides it
  const optionsFor = (selected: string) => options.filter((ex) => !term || ex.id === selected || ex.name.toLowerCase().includes(term) || ex.category.toLowerCase().includes(term));

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = useMutation({
    mutationFn: () => planService.save(patientId, plan.version, toItems(rows)),
    onSuccess: (saved) => {
      toast.success(saved.version === plan.version ? 'No changes to save.' : `Plan saved (version ${saved.version}).`);
      void queryClient.invalidateQueries({ queryKey: qk.patient(patientId) });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'CONCURRENT_UPDATE') {
        void queryClient.invalidateQueries({ queryKey: qk.patient(patientId) });
        form.setFormError('Someone else changed this plan while you were editing. Close this window to load their version, then make your changes again.');
        return;
      }
      form.fromApiError(err, 'Could not save the plan. Please try again.');
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const noDays = rows.findIndex((r) => r.daysOfWeek.length === 0);
    if (noDays >= 0) return form.setFormError(`Pick at least one day for exercise ${noDays + 1}.`);
    if (form.validate(e.currentTarget)) save.mutate();
  };

  return (
    <Modal title={plan.version ? 'Change exercise plan' : 'Assign exercise plan'} description="The patient sees only the exercises in their plan" onClose={onClose} size="xl">
      {library.isPending ? (
        <PageLoader label="Loading the exercise library…" />
      ) : (
        <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
          {form.formError && <Alert tone="error">{form.formError}</Alert>}
          {library.isError && <Alert tone="error">The exercise library could not be loaded.</Alert>}
          {!library.isError && options.length === 0 && <Alert tone="warning">The exercise library is empty. An admin needs to add exercises first.</Alert>}

          {options.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" aria-hidden="true" />
              <Input type="search" aria-label="Search exercises by name or category" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} placeholder="Search exercises…" className="pl-9" />
            </div>
          )}

          {rows.length === 0 ? (
            <EmptyState>No exercises in the plan. Saving an empty plan clears it.</EmptyState>
          ) : (
            <ol className="space-y-3">
              {rows.map((r, i) => {
                const taken = new Set(rows.filter((_, j) => j !== i).map((x) => x.exerciseId));
                return (
                  <li key={i} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-end gap-2">
                      <Field label={`Exercise ${i + 1}`} error={form.errors[`items.${i}.exerciseId`]} className="flex-1">
                        <Select name={`items.${i}.exerciseId`} required value={r.exerciseId} onChange={(e) => update(i, { exerciseId: e.target.value })}>
                          <option value="">Choose…</option>
                          {optionsFor(r.exerciseId).map((ex) => (
                            <option key={ex.id} value={ex.id} disabled={taken.has(ex.id)}>
                              {ex.name}
                              {ex.active ? '' : ' (deactivated)'}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Button variant="ghost" size="sm" aria-label={`Remove exercise ${i + 1}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4 text-rose-700" aria-hidden="true" />
                      </Button>
                    </div>

                    <fieldset>
                      <legend className="mb-1 text-sm font-semibold text-slate-800">Days</legend>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAYS.map((label, d) => {
                          const day = d + 1;
                          const on = r.daysOfWeek.includes(day);
                          return (
                            <button
                              key={label}
                              type="button"
                              aria-pressed={on}
                              onClick={() => update(i, { daysOfWeek: on ? r.daysOfWeek.filter((x) => x !== day) : [...r.daysOfWeek, day] })}
                              className={cn('min-h-9 rounded-lg px-2.5 text-sm font-semibold', on ? 'bg-teal-700 text-white' : 'border border-slate-300 bg-white text-slate-800')}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Field label="Times a day" error={form.errors[`items.${i}.schedule.timesPerDay`]}>
                        <Input name={`items.${i}.schedule.timesPerDay`} type="number" inputMode="numeric" min="1" max="10" required value={r.timesPerDay} onChange={(e) => update(i, { timesPerDay: e.target.value })} />
                      </Field>
                      <Field label="Sets" error={form.errors[`items.${i}.target.sets`]}>
                        <Input name={`items.${i}.target.sets`} type="number" inputMode="numeric" min="1" max="20" value={r.sets} onChange={(e) => update(i, { sets: e.target.value })} />
                      </Field>
                      <Field label="Reps" error={form.errors[`items.${i}.target.reps`]}>
                        <Input name={`items.${i}.target.reps`} type="number" inputMode="numeric" min="1" max="100" value={r.reps} onChange={(e) => update(i, { reps: e.target.value })} />
                      </Field>
                      <Field label="Minutes" error={form.errors[`items.${i}.target.durationMin`]}>
                        <Input name={`items.${i}.target.durationMin`} type="number" inputMode="numeric" min="1" max="240" value={r.durationMin} onChange={(e) => update(i, { durationMin: e.target.value })} />
                      </Field>
                    </div>
                    <Field label="Note for the patient (optional)" error={form.errors[`items.${i}.notes`]}>
                      <Input name={`items.${i}.notes`} maxLength={500} value={r.notes} onChange={(e) => update(i, { notes: e.target.value })} placeholder="e.g. Stop if pain goes above 5" />
                    </Field>
                  </li>
                );
              })}
            </ol>
          )}

          <Button
            variant="subtle"
            disabled={rows.length >= 30}
            onClick={() => setRows((rs) => [...rs, { exerciseId: '', daysOfWeek: EVERY_DAY, timesPerDay: '1', sets: '', reps: '', durationMin: '', notes: '' }])}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add exercise
          </Button>

          <ModalActions onCancel={onClose} submitLabel="Save plan" loading={save.isPending} />
        </form>
      )}
    </Modal>
  );
};
