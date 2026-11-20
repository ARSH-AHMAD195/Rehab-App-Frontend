import { useQuery } from '@tanstack/react-query';
import { nutritionService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { formatDateTime } from '../../lib/format';
import { qk } from '../../lib/queryClient';
import { Alert, Card, PageLoader, SectionTitle } from '../ui';
import { IntakeBars, MealHistory, MealSlots } from '../health/MealDay';

/** The patient's diet chart: today's ticks, the last week, and their targets. Every read is audited. */
export const NutritionPanel = ({ patientId }: { patientId: string }) => {
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
              ? `Changed for this patient${plan.data.updatedAt ? `, ${formatDateTime(plan.data.updatedAt)}` : ''}`
              : 'The hospital chart'
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
    </div>
  );
};
