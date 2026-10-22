import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, ListTodo, Play } from 'lucide-react';
import { exerciseService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { formatDate, fromDateKey, labelize, localDateKey } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, PageLoader } from '../../components/ui';
import { ExerciseDetailModal } from '../../components/exercise/ExerciseDetailModal';
import { LogSessionModal } from '../../components/exercise/LogSessionModal';
import type { Exercise, ExerciseAssignment } from '../../types/api';

const HISTORY_DAYS = 14;

const shiftDateKey = (key: string, days: number) => {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
};

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
  const [view, setView] = useState<'protocols' | 'checklist'>('protocols');
  const today = localDateKey();
  const [selectedDate, setSelectedDate] = useState(today);
  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);
  const [loggingAssignment, setLoggingAssignment] = useState<ExerciseAssignment | null>(null);

  const assigned = useQuery({ queryKey: qk.myAssignments, queryFn: () => exerciseService.getMyAssigned().then((r) => r.assignments) });
  const sessions = useQuery({ queryKey: qk.mySessions(HISTORY_DAYS), queryFn: () => exerciseService.getMySessions({ days: HISTORY_DAYS }).then((r) => r.sessions) });

  if (assigned.isPending) return <PageLoader label="Loading your exercises…" />;
  if (assigned.isError) return <ErrorState error={assigned.error} onRetry={() => void assigned.refetch()} />;

  const assignments = assigned.data;
  const earliestDate = shiftDateKey(today, -(HISTORY_DAYS - 1));
  const isToday = selectedDate === today;

  const completedOn = (assignment: ExerciseAssignment, dateKey: string) =>
    (sessions.data ?? []).some((s) => s.status === 'completed' && s.assignment === assignment._id && localDateKey(s.completedAt) === dateKey);
  const doneCount = assignments.filter((a) => completedOn(a, selectedDate)).length;
  const donePercent = assignments.length ? Math.round((doneCount / assignments.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My exercises"
        description="Follow the instructions and safety guidance from your surgical team"
        actions={
          <div className="inline-flex rounded-2xl bg-slate-100 p-1">
            <TabButton active={view === 'protocols'} onClick={() => setView('protocols')}>
              Prescriptions
            </TabButton>
            <TabButton active={view === 'checklist'} onClick={() => setView('checklist')}>
              <ListTodo className="h-4 w-4" aria-hidden="true" />
              Daily checklist
            </TabButton>
          </div>
        }
      />

      {assignments.length === 0 ? (
        <Card>
          <EmptyState>No exercises prescribed yet. Your doctor will set up your prehab plan shortly.</EmptyState>
        </Card>
      ) : view === 'checklist' ? (
        <Card className="space-y-6">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Daily checklist</h2>
              <p className="mt-0.5 text-sm text-slate-600">Your completed sessions over the last {HISTORY_DAYS} days</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" aria-label="Previous day" disabled={selectedDate <= earliestDate} onClick={() => setSelectedDate(shiftDateKey(selectedDate, -1))}>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </Button>
              <span className="flex min-h-9 items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-800" aria-live="polite">
                <Calendar className="h-4 w-4 text-teal-800" aria-hidden="true" />
                {formatDate(fromDateKey(selectedDate), { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <Button variant="secondary" size="sm" aria-label="Next day" disabled={isToday} onClick={() => setSelectedDate(shiftDateKey(selectedDate, 1))}>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </Button>
              {!isToday && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(today)}>
                  Today
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-800">Completion</span>
              <span className="font-bold text-teal-900">
                {doneCount} of {assignments.length} ({donePercent}%)
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={donePercent} aria-valuemin={0} aria-valuemax={100} aria-label="Completion for selected day">
              <div className="h-full rounded-full bg-teal-700 transition-all duration-500" style={{ width: `${donePercent}%` }} />
            </div>
          </div>

          <ul className="space-y-3">
            {assignments.map((a) => {
              const done = completedOn(a, selectedDate);
              return (
                <li key={a._id} className={cn('flex flex-col justify-between gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center', done ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white')}>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className={cn('mt-0.5 h-6 w-6 shrink-0', done ? 'text-emerald-700' : 'text-slate-300')} aria-hidden="true" />
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {a.exercise?.title}
                        <span className="sr-only">{done ? ' (completed)' : ' (not completed)'}</span>
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {a.customizedDurationMinutes} mins • {a.customizedSets} × {a.customizedReps} reps • {a.frequency}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {a.exercise && (
                      <Button variant="secondary" size="sm" onClick={() => setDetailExercise(a.exercise)}>
                        <Play className="h-4 w-4 text-teal-700" aria-hidden="true" />
                        Instructions
                      </Button>
                    )}
                    {done ? (
                      <Badge tone="emerald">Logged</Badge>
                    ) : (
                      // Sessions are timestamped when saved, so only today can be logged
                      isToday && (
                        <Button size="sm" onClick={() => setLoggingAssignment(a)}>
                          Mark done
                        </Button>
                      )
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {assignments.map((a) => (
            <article key={a._id} className="flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xs">
              <div className="p-6">
                <div className="mb-3 flex items-center justify-between">
                  <Badge tone="teal">{labelize(a.exercise?.category)}</Badge>
                  {a.completedToday && (
                    <span className="flex items-center gap-1 text-sm font-semibold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Done today
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold leading-snug text-slate-900">{a.exercise?.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-700">{a.exercise?.description}</p>

                <dl className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center">
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-600">Duration</dt>
                    <dd className="text-base font-bold text-slate-900">{a.customizedDurationMinutes}m</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-600">Sets × reps</dt>
                    <dd className="text-base font-bold text-slate-900">
                      {a.customizedSets} × {a.customizedReps}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-600">How often</dt>
                    <dd className="text-sm font-bold text-slate-900">{a.frequency}</dd>
                  </div>
                </dl>

                {a.customizedInstructions && (
                  <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                    <strong className="block text-xs font-bold uppercase text-amber-900">Doctor’s note</strong>
                    {a.customizedInstructions}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 p-4">
                {a.exercise && (
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => setDetailExercise(a.exercise)}>
                    <Play className="h-4 w-4 text-teal-700" aria-hidden="true" />
                    Instructions & video
                  </Button>
                )}
                <Button size="sm" onClick={() => setLoggingAssignment(a)}>
                  Mark done
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {detailExercise && <ExerciseDetailModal exercise={detailExercise} onClose={() => setDetailExercise(null)} />}
      {loggingAssignment && <LogSessionModal assignment={loggingAssignment} onClose={() => setLoggingAssignment(null)} />}
    </div>
  );
};
