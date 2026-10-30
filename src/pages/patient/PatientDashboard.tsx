import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, Stethoscope, Undo2, XCircle } from 'lucide-react';
import { useSignedInUser } from '../../context/AuthContext';
import { completionService, profileService, vitalsService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { daysUntil, firstName, formatDate, formatReading, weekOf } from '../../lib/format';
import { useSkips } from '../../lib/skips';
import { Button, Card, EmptyState, ErrorState, PageLoader, SectionTitle, buttonClass } from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import { CompleteExerciseModal } from '../../components/exercise/CompleteExerciseModal';
import { SkipExerciseModal } from '../../components/exercise/SkipExerciseModal';
import { DonePill, ExerciseCard } from '../../components/exercise/ExerciseCard';
import type { Checklist, ChecklistItem, Reading, VitalType } from '../../types/api';

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

/** "Week 2 of 4 · Day 12 of 28": one bar segment per week, the current week filling up. */
const ProgrammeCard = ({ day, totalDays, surgeryDate }: { day: number; totalDays: number; surgeryDate: string }) => {
  const { week, weeks } = weekOf(day, totalDays);
  return (
    <Card aria-label="Your prehabilitation programme" className="py-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-base font-bold text-slate-900">
          Week {week} of {weeks}
        </p>
        <p className="text-sm text-slate-600">
          Day {day} of {totalDays}
        </p>
      </div>
      <div className="mt-3 flex gap-1.5" role="progressbar" aria-valuenow={day} aria-valuemin={1} aria-valuemax={totalDays} aria-label={`Day ${day} of ${totalDays}`}>
        {Array.from({ length: weeks }, (_, i) => {
          // Share of this week's days already reached (the last week may be shorter than 7)
          const weekDays = Math.min(7, totalDays - i * 7);
          const fill = Math.max(0, Math.min(1, (day - i * 7) / weekDays));
          return (
            <span key={i} className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
              <span className="block h-full rounded-full bg-teal-700" style={{ width: `${fill * 100}%` }} />
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-slate-700">Surgery planned for {formatDate(surgeryDate, { weekday: 'short', day: 'numeric', month: 'long' })}</p>
    </Card>
  );
};

/** Today's planned exercises as cards: mark done, or say you couldn't. */
const TodayExercises = ({ patientId, checklist }: { patientId: string; checklist: Checklist }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [completing, setCompleting] = useState<ChecklistItem | null>(null);
  const [skipping, setSkipping] = useState<ChecklistItem | null>(null);
  const { skips, skip, unskip } = useSkips(patientId, checklist.date);
  const { items, doneCount, plannedCount, date } = checklist;

  const undo = useMutation({
    mutationFn: completionService.undo,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['my'] }),
    onError: (err) => toast.error(errorMessage(err, 'Could not undo. Please try again.')),
  });

  const progress = plannedCount ? Math.round((doneCount / plannedCount) * 100) : 0;
  // To do first, then skipped, then done
  const rank = (i: ChecklistItem) => (i.status === 'DONE' ? 2 : skips[i.itemId] ? 1 : 0);
  const ordered = [...items].sort((a, b) => rank(a) - rank(b));

  const undoButton = (tickId: string, label: string) => (
    <Button variant="ghost" size="sm" className="w-full" onClick={() => undo.mutate(tickId)} loading={undo.isPending && undo.variables === tickId}>
      <Undo2 className="h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );

  return (
    <section aria-labelledby="today-heading" className="space-y-4">
      <div>
        <h2 id="today-heading" className="text-lg font-bold text-slate-900">
          Today’s exercises
        </h2>
        <p className="text-sm text-slate-700">
          {plannedCount === 0 ? 'Nothing planned for today' : doneCount >= plannedCount ? 'All done for today. Great work!' : `${doneCount} of ${plannedCount} done`}
        </p>
      </div>

      {plannedCount > 0 && (
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Today's exercises completed">
          <div className="h-3 rounded-full bg-teal-700 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <EmptyState>{checklist.planVersion === 0 ? 'Your doctor will set up your exercises shortly.' : 'Rest day: nothing is planned for today.'}</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {ordered.map((item) => {
            const done = item.status === 'DONE';
            const skipped = done ? undefined : skips[item.itemId];
            const lastTick = item.completions.at(-1);
            return (
              <ExerciseCard
                key={item.itemId}
                exercise={item.exercise}
                target={item.target}
                notes={item.notes}
                status={
                  done ? (
                    <DonePill />
                  ) : item.timesPerDay > 1 ? (
                    <span className="shrink-0 text-sm font-semibold text-slate-600">
                      {item.doneCount} of {item.timesPerDay} times
                    </span>
                  ) : undefined
                }
              >
                {skipped ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <XCircle className="h-4 w-4 text-amber-700" aria-hidden="true" />
                      Skipped today · {skipped}
                    </span>
                    <button type="button" onClick={() => unskip(item.itemId)} className="font-semibold text-teal-800 underline">
                      Undo<span className="sr-only"> skip for {item.exercise.name}</span>
                    </button>
                  </div>
                ) : done ? (
                  lastTick && undoButton(lastTick.id, 'Undo')
                ) : (
                  <div className="space-y-1">
                    <Button size="lg" className="w-full" onClick={() => setCompleting(item)}>
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                      Mark as done<span className="sr-only">: {item.exercise.name}</span>
                    </Button>
                    {lastTick && undoButton(lastTick.id, 'Undo last tick')}
                    <button
                      type="button"
                      onClick={() => setSkipping(item)}
                      className="flex min-h-11 w-full items-center justify-center gap-1.5 text-sm font-bold text-teal-900 hover:underline"
                    >
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      I couldn’t do this today
                    </button>
                  </div>
                )}
              </ExerciseCard>
            );
          })}
        </div>
      )}

      {completing && <CompleteExerciseModal item={completing} date={date} onClose={() => setCompleting(null)} />}
      {skipping && <SkipExerciseModal name={skipping.exercise.name} onSkip={(reason) => skip(skipping.itemId, reason)} onClose={() => setSkipping(null)} />}
    </section>
  );
};

export const PatientDashboard = () => {
  const user = useSignedInUser();

  const profile = useQuery({ queryKey: qk.myProfile, queryFn: profileService.getMine });
  const medical = useQuery({ queryKey: qk.myMedical, queryFn: profileService.getMyMedical });
  const checklist = useQuery({ queryKey: qk.myChecklist, queryFn: completionService.getMyChecklist });
  const today = useQuery({ queryKey: qk.myToday, queryFn: vitalsService.getToday });

  if (checklist.isPending) return <PageLoader label="Loading your day…" />;
  if (checklist.isError) return <ErrorState error={checklist.error} onRetry={() => void checklist.refetch()} />;

  const surgeryDate = medical.data?.plannedSurgeryDate;
  const days = daysUntil(surgeryDate);
  // Programme progress: day 1 is the day they were enrolled, the last day is surgery day
  const enrolled = profile.data?.createdAt;
  const totalDays = enrolled && surgeryDate ? daysUntil(surgeryDate, new Date(enrolled)) : null;
  const dayNumber = enrolled ? -(daysUntil(enrolled) ?? 0) + 1 : null;
  const showProgramme = totalDays !== null && totalDays > 0 && dayNumber !== null && days !== null && days >= 0;
  const doctors = profile.data?.doctors ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {greeting()}, {firstName(user.name)}
          </h1>
          <p className="mt-1 text-base text-slate-700">{formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <Link to="/patient/health-tracker" className={buttonClass('primary', 'md', 'hidden lg:inline-flex')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Log vitals
        </Link>
      </header>

      {showProgramme && <ProgrammeCard day={Math.min(dayNumber, totalDays)} totalDays={totalDays} surgeryDate={surgeryDate!} />}

      <TodayExercises patientId={user.id} checklist={checklist.data} />

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
    </div>
  );
};
