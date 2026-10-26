import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, History, ListTodo, Play } from 'lucide-react';
import { completionService, planService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { describeDays } from '../../lib/constants';
import { describeTarget, formatDate, formatDateTime, labelize } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, PageLoader } from '../../components/ui';
import { ExerciseDetailModal } from '../../components/exercise/ExerciseDetailModal';
import type { PlanItem } from '../../types/api';

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
  const [detail, setDetail] = useState<PlanItem | null>(null);

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
              <article key={item.itemId} className="flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
                <div className="p-6">
                  <Badge tone="teal">{labelize(item.exercise.category)}</Badge>
                  <h2 className="mt-3 text-lg font-bold leading-snug text-slate-900">{item.exercise.name}</h2>
                  {item.exercise.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-700">{item.exercise.description}</p>}

                  <dl className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-center">
                    <div>
                      <dt className="text-xs font-semibold uppercase text-slate-600">Target</dt>
                      <dd className="text-sm font-bold text-slate-900">{describeTarget(item.target) || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase text-slate-600">When</dt>
                      <dd className="text-sm font-bold text-slate-900">
                        {describeDays(item.schedule.daysOfWeek)}
                        {item.schedule.timesPerDay > 1 && `, ${item.schedule.timesPerDay}× a day`}
                      </dd>
                    </div>
                  </dl>

                  {item.notes && (
                    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                      <strong className="block text-xs font-bold uppercase text-amber-900">Doctor’s note</strong>
                      {item.notes}
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-100 bg-slate-50 p-4">
                  <Button variant="secondary" size="sm" className="w-full" onClick={() => setDetail(item)}>
                    <Play className="h-4 w-4 text-teal-700" aria-hidden="true" />
                    Instructions & video
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {detail && <ExerciseDetailModal exercise={detail.exercise} notes={detail.notes} onClose={() => setDetail(null)} />}
    </div>
  );
};
