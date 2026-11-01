import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, History, ListTodo } from 'lucide-react';
import { useSignedInUser } from '../../context/AuthContext';
import { completionService, planService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { describeDays } from '../../lib/constants';
import { formatDate, formatDateTime } from '../../lib/format';
import { useSkips } from '../../lib/skips';
import { cn } from '../../lib/cn';
import { Card, EmptyState, ErrorState, PageHeader, PageLoader } from '../../components/ui';
import { ExerciseCard } from '../../components/exercise/ExerciseCard';
import { TodayExerciseCard } from '../../components/exercise/TodayExerciseCard';
import type { Checklist, PlanItem } from '../../types/api';

const TabButton = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn('flex min-h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-bold transition-colors', active ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-700 hover:text-slate-900')}
  >
    {children}
  </button>
);

export const PatientExercisesPage = () => {
  const [view, setView] = useState<'plan' | 'history'>('plan');

  const user = useSignedInUser();
  const plan = useQuery({ queryKey: qk.myPlan, queryFn: planService.getMine });
  // Same query as the Today tab, so ticks made on either page show on both
  const checklist = useQuery({ queryKey: qk.myChecklist, queryFn: completionService.getMyChecklist });
  // Last 30 days, newest first (the API's default range)
  const history = useQuery({ queryKey: qk.myCompletions, queryFn: () => completionService.getMine({ limit: 100 }), enabled: view === 'history' });

  if (plan.isPending) return <PageLoader label="Loading your exercises…" />;
  if (plan.isError) return <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />;

  const { items, assignedBy, updatedAt } = plan.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My exercises"
        description={assignedBy ? `Plan from ${assignedBy.name}, updated ${formatDate(updatedAt)}` : 'Follow the instructions and safety guidance from your surgical team'}
        actions={
          <div className="inline-flex rounded-2xl bg-slate-100 p-1">
            <TabButton active={view === 'plan'} onClick={() => setView('plan')}>
              <ListTodo className="h-4 w-4" aria-hidden="true" />
              My plan
            </TabButton>
            <TabButton active={view === 'history'} onClick={() => setView('history')}>
              <History className="h-4 w-4" aria-hidden="true" />
              History
            </TabButton>
          </div>
        }
      />

      {view === 'history' ? (
        <Card>
          <h2 className="mb-4 text-lg font-bold text-slate-900">Completed in the last 30 days</h2>
          {history.isPending ? (
            <PageLoader label="Loading your history…" />
          ) : history.isError ? (
            <ErrorState error={history.error} onRetry={() => void history.refetch()} />
          ) : history.data.data.length === 0 ? (
            <EmptyState>Nothing ticked off in the last 30 days yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.data.data.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span className="flex items-center gap-2 font-semibold text-slate-900">
                    <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
                    {c.exercise.name}
                  </span>
                  <span className="text-slate-600">
                    {formatDateTime(c.completedAt)}
                    {c.details?.durationMin ? ` · ${c.details.durationMin} min` : ''}
                    {c.details?.note ? ` · “${c.details.note}”` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState>No exercises prescribed yet. Your doctor will set up your prehab plan shortly.</EmptyState>
        </Card>
      ) : checklist.isPending ? (
        <PageLoader label="Loading today’s exercises…" />
      ) : (
        // Without today's checklist the cards still show, just without the tick buttons
        <PlanCards patientId={user.id} items={items} checklist={checklist.data} />
      )}
    </div>
  );
};

/** Every exercise in the plan. Those planned for today can be ticked off here, same as on the Today tab. */
const PlanCards = ({ patientId, items, checklist }: { patientId: string; items: PlanItem[]; checklist?: Checklist }) => {
  const { skips, skip, unskip } = useSkips(patientId, checklist?.date ?? '');
  const today = new Map((checklist?.items ?? []).map((i) => [i.itemId, i]));

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const schedule = (
          <span className="shrink-0 text-right text-sm font-semibold text-slate-600">
            {describeDays(item.schedule.daysOfWeek)}
            {item.schedule.timesPerDay > 1 && <span className="block">{item.schedule.timesPerDay}× a day</span>}
          </span>
        );
        const todays = today.get(item.itemId);
        return todays && checklist ? (
          <TodayExerciseCard
            key={item.itemId}
            item={todays}
            date={checklist.date}
            skipped={skips[item.itemId]}
            onSkip={(reason) => skip(item.itemId, reason)}
            onUnskip={() => unskip(item.itemId)}
            status={schedule}
          />
        ) : (
          <ExerciseCard key={item.itemId} exercise={item.exercise} target={item.target} notes={item.notes} status={schedule}>
            <p className="rounded-xl bg-slate-50 p-3 text-center text-sm text-slate-600">Not planned for today</p>
          </ExerciseCard>
        );
      })}
    </div>
  );
};
