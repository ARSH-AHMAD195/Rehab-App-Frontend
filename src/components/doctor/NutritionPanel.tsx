import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { nutritionService } from '../../services/apiServices';
import { ApiError, errorMessage } from '../../services/api';
import { useFormErrors } from '../../lib/forms';
import { formatDateTime } from '../../lib/format';
import { qk } from '../../lib/queryClient';
import { Alert, Button, Card, Field, Input, Modal, ModalActions, PageLoader, SectionTitle } from '../ui';
import { useToast } from '../ui/toast';
import { IntakeBars, MealHistory, MealSlots } from '../health/MealDay';
import type { DietPlan } from '../../types/api';

const TargetsModal = ({ patientId, plan, onClose }: { patientId: string; plan: DietPlan; onClose: () => void }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const [kcal, setKcal] = useState(String(plan.targets.kcal));
  const [protein, setProtein] = useState(String(plan.targets.proteinG));

  const save = useMutation({
    mutationFn: () => nutritionService.updatePatientPlan(patientId, { version: plan.version, targets: { kcal: Number(kcal), proteinG: Number(protein) } }),
    onSuccess: () => {
      toast.success('Daily targets saved.');
      void queryClient.invalidateQueries({ queryKey: qk.patientPart(patientId, 'nutrition') });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'CONCURRENT_UPDATE') {
        void queryClient.invalidateQueries({ queryKey: qk.patientPart(patientId, 'nutrition') });
        return form.setFormError('Someone else changed this diet plan just now. Close this window to load their version.');
      }
      form.fromApiError(err, 'Could not save the targets.');
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.validate(e.currentTarget)) save.mutate();
  };

  return (
    <Modal title="Daily targets" description="For this patient only. The meal slots stay as they are." onClose={onClose}>
      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Calories (kcal)" error={form.errors['targets.kcal']}>
            <Input name="targets.kcal" type="number" inputMode="numeric" min="1" step="1" required value={kcal} onChange={(e) => setKcal(e.target.value)} />
          </Field>
          <Field label="Protein (g)" error={form.errors['targets.proteinG']}>
            <Input name="targets.proteinG" type="number" inputMode="decimal" min="1" step="any" required value={protein} onChange={(e) => setProtein(e.target.value)} />
          </Field>
        </div>
        <ModalActions onCancel={onClose} submitLabel="Save targets" loading={save.isPending} />
      </form>
    </Modal>
  );
};

/** The patient's diet chart: today's ticks, the last week, and their targets. Every read is audited. */
export const NutritionPanel = ({ patientId }: { patientId: string }) => {
  const [editing, setEditing] = useState(false);
  const plan = useQuery({ queryKey: qk.patientPart(patientId, 'nutrition', 'plan'), queryFn: () => nutritionService.getPatientPlan(patientId) });
  const today = useQuery({ queryKey: qk.patientPart(patientId, 'nutrition', 'today'), queryFn: () => nutritionService.getPatientToday(patientId) });
  const history = useQuery({ queryKey: qk.patientPart(patientId, 'nutrition', 'history'), queryFn: () => nutritionService.getPatientHistory(patientId) });

  if (today.isPending) return <PageLoader label="Loading the diet chart…" />;
  if (today.isError) return <Alert tone="error">The diet chart could not be loaded: {errorMessage(today.error)}</Alert>;

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle
          title={today.data.dietLabel.en}
          as="h3"
          description={
            plan.data?.version
              ? `Targets changed for this patient${plan.data.updatedAt ? `, ${formatDateTime(plan.data.updatedAt)}` : ''}`
              : 'The hospital chart'
          }
          actions={
            plan.data && (
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Change targets
              </Button>
            )
          }
        />
        <p className="text-sm text-slate-700">Today ({today.data.date}): what the patient has ticked. Under 75% of the calorie target on 3 days in a row raises a care-team alert.</p>
      </Card>
      <IntakeBars day={today.data} />
      <MealSlots day={today.data} />
      <Card>
        <SectionTitle title="Last 7 days" as="h3" />
        {history.isError ? <Alert tone="error">{errorMessage(history.error)}</Alert> : history.data ? <MealHistory days={history.data} /> : <PageLoader />}
      </Card>
      {editing && plan.data && <TargetsModal patientId={patientId} plan={plan.data} onClose={() => setEditing(false)} />}
    </div>
  );
};
