import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { planService } from '../../services/apiServices';
import { ApiError, errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { describeDays } from '../../lib/constants';
import { useFormErrors } from '../../lib/forms';
import { describeTarget } from '../../lib/format';
import { Alert, Badge, Button, Field, Input } from '../ui';
import { useToast } from '../ui/toast';
import type { Plan, PlanItem } from '../../types/api';

const num = (s: string) => (s.trim() ? Number(s) : null);

/** One exercise in a patient's plan. Sets, reps and minutes can be changed right on the card. */
export const PlanItemCard = ({ patientId, plan, item }: { patientId: string; plan: Plan; item: PlanItem }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState({ sets: '', reps: '', durationMin: '' });

  const startEditing = () => {
    setT({ sets: item.target?.sets?.toString() ?? '', reps: item.target?.reps?.toString() ?? '', durationMin: item.target?.durationMin?.toString() ?? '' });
    form.setFormError('');
    setEditing(true);
  };

  // The API replaces the whole plan, so send every item with just this one's target changed
  const save = useMutation({
    mutationFn: () => {
      const target = t.sets || t.reps || t.durationMin ? { sets: num(t.sets), reps: num(t.reps), durationMin: num(t.durationMin) } : null;
      return planService.save(
        patientId,
        plan.version,
        plan.items.map((i) => ({ exerciseId: i.exercise.id, schedule: i.schedule, target: i.itemId === item.itemId ? target : i.target, notes: i.notes }))
      );
    },
    onSuccess: () => {
      toast.success(`${item.exercise.name} updated.`);
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: qk.patient(patientId) });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'CONCURRENT_UPDATE') {
        void queryClient.invalidateQueries({ queryKey: qk.patient(patientId) });
        return form.setFormError('Someone else changed this plan just now. It has been reloaded; try again.');
      }
      // e.g. NOT_ALLOWED when another exercise in the plan has since been deactivated
      form.setFormError(errorMessage(err, 'Could not save. Please try again.'));
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.validate(e.currentTarget)) save.mutate();
  };

  const input = (key: keyof typeof t, label: string, max: number) => (
    <Field label={label} error={form.errors[key]}>
      <Input name={key} type="number" inputMode="numeric" min="1" max={max} value={t[key]} onChange={(e) => setT((s) => ({ ...s, [key]: e.target.value }))} />
    </Field>
  );

  return (
    <li className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-slate-900">{item.exercise.name}</span>
        <div className="flex items-center gap-1">
          {!item.exercise.active && <Badge tone="rose">Deactivated</Badge>}
          {!editing && (
            <Button variant="ghost" size="sm" onClick={startEditing} aria-label={`Edit sets, reps and minutes for ${item.exercise.name}`}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
      <p className="mt-1.5 text-slate-700">
        {[describeDays(item.schedule.daysOfWeek), item.schedule.timesPerDay > 1 ? `${item.schedule.timesPerDay}× a day` : null, editing ? null : describeTarget(item.target)]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {editing && (
        <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="mt-3 space-y-3">
          {form.formError && <Alert tone="error">{form.formError}</Alert>}
          <div className="grid grid-cols-3 gap-2">
            {input('sets', 'Sets', 20)}
            {input('reps', 'Reps', 100)}
            {input('durationMin', 'Minutes', 240)}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={save.isPending}>
              Save
            </Button>
          </div>
        </form>
      )}

      {item.notes && !editing && <p className="mt-2 rounded-lg border border-teal-200 bg-teal-50 p-2 text-teal-950">{item.notes}</p>}
    </li>
  );
};
