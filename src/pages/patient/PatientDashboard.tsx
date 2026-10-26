import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, Stethoscope, Undo2 } from 'lucide-react';
import { useSignedInUser } from '../../context/AuthContext';
import { completionService, profileService, vitalsService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { daysUntil, describeTarget, formatDate, formatReading } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Button, Card, EmptyState, ErrorState, PageLoader, SectionTitle, buttonClass } from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import { CompleteExerciseModal } from '../../components/exercise/CompleteExerciseModal';
import type { ChecklistItem, Reading, VitalType } from '../../types/api';

const TILES: { type: VitalType; label: string }[] = [
  { type: 'BP', label: 'Blood pressure' },
  { type: 'SPO2', label: 'Oxygen level' },
  { type: 'PULSE', label: 'Pulse' },
  { type: 'PAIN', label: 'Pain' },
];

const greeting = (hour = new Date().getHours()) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

const VitalTile = ({ label, reading }: { label: string; reading?: Reading }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
    <span className="text-sm font-semibold text-slate-700">{label}</span>
    {reading?.value ? (
      <p className="mt-1 text-2xl font-bold text-slate-900">
        {formatReading(reading.value)}
        <span className="ml-1 text-sm font-normal text-slate-600">{reading.unit}</span>
      </p>
    ) : (
      <>
        <p className="mt-1 text-2xl font-bold text-slate-400" aria-hidden="true">
          —
        </p>
        <span className="mt-1 block text-xs text-slate-600">Not logged today</span>
      </>
    )}
  </div>
);

export const PatientDashboard = () => {
  const user = useSignedInUser();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [completing, setCompleting] = useState<ChecklistItem | null>(null);

  const profile = useQuery({ queryKey: qk.myProfile, queryFn: profileService.getMine });
  const medical = useQuery({ queryKey: qk.myMedical, queryFn: profileService.getMyMedical });
  const checklist = useQuery({ queryKey: qk.myChecklist, queryFn: completionService.getMyChecklist });
  const today = useQuery({ queryKey: qk.myToday, queryFn: vitalsService.getToday });

  const undo = useMutation({
    mutationFn: completionService.undo,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['my'] }),
    onError: (err) => toast.error(errorMessage(err, 'Could not undo. Please try again.')),
  });

  if (checklist.isPending) return <PageLoader label="Loading your day…" />;
  if (checklist.isError) return <ErrorState error={checklist.error} onRetry={() => void checklist.refetch()} />;

  const { items, doneCount, plannedCount, date } = checklist.data;
  const progress = plannedCount ? Math.round((doneCount / plannedCount) * 100) : 0;
  const ordered = [...items].sort((a, b) => Number(a.status === 'DONE') - Number(b.status === 'DONE'));
  const surgeryDate = medical.data?.plannedSurgeryDate;
  const days = daysUntil(surgeryDate);
  const doctors = profile.data?.doctors ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {greeting()}, {user.name.split(' ')[0]}
          </h1>
          {surgeryDate && days !== null && days >= 0 && (
            <p className="mt-1 text-base text-slate-700">
              <strong className="text-teal-900">
                {days} {days === 1 ? 'day' : 'days'}
              </strong>{' '}
              until your surgery on {formatDate(surgeryDate, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          )}
        </div>
        <Link to="/patient/health-tracker" className={buttonClass('primary', 'md', 'hidden lg:inline-flex')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Log vitals
        </Link>
      </header>

      <Card aria-labelledby="today-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="today-heading" className="text-lg font-bold text-slate-900">
              Today’s exercises
            </h2>
            <p className="text-sm text-slate-700">
              {plannedCount === 0 ? 'Nothing planned for today' : doneCount >= plannedCount ? 'All done for today. Great work!' : `${doneCount} of ${plannedCount} done`}
            </p>
          </div>
          <Link to="/patient/exercises" className="text-sm font-semibold text-teal-800 hover:underline">
            How to do them →
          </Link>
        </div>

        {plannedCount > 0 && (
          <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Today's exercises completed">
            <div className="h-3 rounded-full bg-teal-700 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState>{checklist.data.planVersion === 0 ? 'Your doctor will set up your exercises shortly.' : 'Rest day: nothing is planned for today.'}</EmptyState>
        ) : (
          <ul className="space-y-3">
            {ordered.map((item) => {
              const done = item.status === 'DONE';
              const lastTick = item.completions.at(-1);
              return (
                <li key={item.itemId} className={cn('flex items-center justify-between gap-3 rounded-2xl border p-4', done ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white')}>
                  <div className="min-w-0">
                    <h3 className={cn('text-base font-bold', done ? 'text-emerald-950' : 'text-slate-900')}>{item.exercise.name}</h3>
                    <p className="text-sm text-slate-600">
                      {[describeTarget(item.target), item.timesPerDay > 1 ? `${item.doneCount} of ${item.timesPerDay} times` : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {lastTick && (
                      <Button variant="ghost" size="sm" onClick={() => undo.mutate(lastTick.id)} loading={undo.isPending && undo.variables === lastTick.id} aria-label={`Undo last tick for ${item.exercise.name}`}>
                        <Undo2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                    {done ? (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900">
                        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                        Done
                      </span>
                    ) : (
                      <Button size="lg" onClick={() => setCompleting(item)}>
                        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                        Mark done<span className="sr-only">: {item.exercise.name}</span>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <section aria-labelledby="latest-vitals">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="latest-vitals" className="text-lg font-bold text-slate-900">
            Today’s readings
          </h2>
          <Link to="/patient/health-tracker" className="text-sm font-semibold text-teal-800 hover:underline">
            Log & charts →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TILES.map((t) => (
            <VitalTile key={t.type} label={t.label} reading={today.data?.readings[t.type]} />
          ))}
        </div>
      </section>

      <Card>
        <SectionTitle title="Your care team" />
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-800">
            <Stethoscope className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-900">{doctors.length ? doctors.map((d) => d.name).join(', ') : 'Not yet assigned'}</p>
            <p className="text-sm text-slate-600">{medical.data?.plannedSurgery ?? 'Procedure not recorded yet'}</p>
          </div>
        </div>
      </Card>

      {/* Phones: the main action stays one thumb-tap away, above the tab bar */}
      <Link
        to="/patient/health-tracker"
        className={buttonClass('primary', 'lg', 'fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-30 rounded-full px-5 shadow-lg lg:hidden')}
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        Log vitals
      </Link>

      {completing && <CompleteExerciseModal item={completing} date={date} onClose={() => setCompleting(null)} />}
    </div>
  );
};
