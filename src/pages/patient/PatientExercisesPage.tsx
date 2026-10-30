import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, History, ListTodo } from 'lucide-react';
import { completionService, planService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { describeDays } from '../../lib/constants';
import { formatDate, formatDateTime } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Card, EmptyState, ErrorState, PageHeader, PageLoader } from '../../components/ui';
import { ExerciseCard } from '../../components/exercise/ExerciseCard';

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

  const plan = useQuery({ queryKey: qk.myPlan, queryFn: planService.getMine });
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
            <EmptyState>Nothing ticked off yet. Tick exercises off on the Today page.</EmptyState>
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
      ) : (
        <>
          <p className="text-sm text-slate-700">
            Tick exercises off on the{' '}
            <Link to="/patient/dashboard" className="font-semibold text-teal-800 underline">
              Today
            </Link>{' '}
            page.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <ExerciseCard
                key={item.itemId}
                exercise={item.exercise}
                target={item.target}
                notes={item.notes}
                status={
                  <span className="shrink-0 text-right text-sm font-semibold text-slate-600">
                    {describeDays(item.schedule.daysOfWeek)}
                    {item.schedule.timesPerDay > 1 && <span className="block">{item.schedule.timesPerDay}× a day</span>}
                  </span>
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
