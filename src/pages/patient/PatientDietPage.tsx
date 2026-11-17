import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { nutritionService } from '../../services/apiServices';
import { ApiError, errorMessage } from '../../services/api';
import { biText, t, useLang } from '../../lib/i18n';
import { qk } from '../../lib/queryClient';
import { Alert, Card, ErrorState, PageHeader, PageLoader, SectionTitle } from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import { IntakeBars, MealHistory, MealSlots } from '../../components/health/MealDay';
import type { MealDay } from '../../types/api';

/** The patient's diet chart for today: tick what you ate, see the day's calories and protein. */
export const PatientDietPage = () => {
  useLang();
  const toast = useToast();
  const queryClient = useQueryClient();
  const today = useQuery({ queryKey: qk.myMeals, queryFn: nutritionService.getToday });
  const history = useQuery({ queryKey: qk.myMealHistory, queryFn: () => nutritionService.getHistory() });

  const save = useMutation({
    mutationFn: ({ slot, codes, date }: { slot: string; codes: string[]; date: string }) => nutritionService.saveSlot(slot, date, codes),
    onSuccess: (day) => {
      queryClient.setQueryData<MealDay>(qk.myMeals, day);
      void queryClient.invalidateQueries({ queryKey: qk.myMealHistory });
    },
    onError: (err) => {
      // After midnight the chart is a new day: load it
      if (err instanceof ApiError && err.code === 'DAY_CHANGED') void queryClient.invalidateQueries({ queryKey: qk.myMeals });
      toast.error(errorMessage(err, 'Could not save. Please try again.'));
    },
  });

  if (today.isPending) return <PageLoader label={t('Loading your diet chart…')} />;
  if (today.isError) return <ErrorState error={today.error} onRetry={() => void today.refetch()} />;
  const day = today.data;

  return (
    <div className="space-y-6">
      <PageHeader title={biText(day.dietLabel)} description={t('Tick what you ate today. About {kcal} kcal and {protein} g protein a day.', { kcal: day.targets.kcal, protein: day.targets.proteinG })} />

      <IntakeBars day={day} />

      <Alert>If your care team has given you a different diet, follow their advice. Calories and protein are approximate, for the whole meal.</Alert>

      <MealSlots
        day={day}
        busySlot={save.isPending ? save.variables.slot : null}
        onToggle={(slot, code, ticked) => {
          const codes = slot.options.filter((o) => (o.code === code ? ticked : o.ticked)).map((o) => o.code);
          save.mutate({ slot: slot.code, codes, date: day.date });
        }}
      />

      <Card>
        <SectionTitle title={t('Last 7 days')} as="h2" />
        {history.isError ? <Alert tone="error">{errorMessage(history.error)}</Alert> : history.data ? <MealHistory days={history.data} /> : <PageLoader />}
      </Card>
    </div>
  );
};
