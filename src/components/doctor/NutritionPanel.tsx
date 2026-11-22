import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { nutritionService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { formatDateTime } from '../../lib/format';
import { qk } from '../../lib/queryClient';
import { Alert, buttonClass, Card, PageLoader, SectionTitle } from '../ui';
import { IntakeBars, MealHistory, MealSlots } from '../health/MealDay';
import { percentText, round1 } from '../../lib/reports';
import type { MealDay, MealHistoryDay } from '../../types/api';

/** One day of the last week, opened from its row. Only today has the meal-by-meal list. */
const DayDetail = ({ day, today }: { day: MealHistoryDay; today: MealDay }) => (
  <div className="space-y-3 pt-1">
    {day.logged && day.totals && day.targets ? (
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs font-bold uppercase text-slate-600">Calories</dt>
          <dd className="font-semibold text-slate-900">
            {Math.round(day.totals.kcal)} of {day.targets.kcal} kcal ({percentText(day.percent?.kcal)})
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase text-slate-600">Protein</dt>
          <dd className="font-semibold text-slate-900">
            {round1(day.totals.proteinG)} of {day.targets.proteinG} g ({percentText(day.percent?.protein)})
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase text-slate-600">Meals ticked</dt>
          <dd className="font-semibold text-slate-900">{day.totals.slotsEaten}</dd>
        </div>
      </dl>
    ) : (
      <p className="text-sm text-slate-700">Nothing ticked this day.</p>
    )}
    {day.date === today.date ? <MealSlots day={today} /> : <p className="text-xs text-slate-500">Meal-by-meal detail for past days isn’t available yet.</p>}
  </div>
);

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
        <SectionTitle
          title="Last 7 days"
          as="h3"
          actions={
            <Link to={`/doctor/patient/${patientId}/reports/nutrition`} target="_blank" rel="noopener" className={buttonClass('secondary', 'sm')}>
              <Printer className="h-4 w-4" aria-hidden="true" />
              Weekly calorie report
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>
          }
        />
        {history.isError ? (
          <Alert tone="error">{errorMessage(history.error)}</Alert>
        ) : history.data ? (
          <MealHistory days={history.data} detail={(d) => <DayDetail day={d} today={today.data} />} />
        ) : (
          <PageLoader />
        )}
      </Card>
    </div>
  );
};
