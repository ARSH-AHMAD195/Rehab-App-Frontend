import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Stethoscope } from 'lucide-react';
import { useSignedInUser } from '../../context/AuthContext';
import { completionService, profileService, vitalsService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { firstName, formatDate, formatReading, fromDateKey } from '../../lib/format';
import { Card, EmptyState, ErrorState, PageLoader, SectionTitle, buttonClass } from '../../components/ui';
import { TodayExerciseCard } from '../../components/exercise/TodayExerciseCard';
import { ProgramProgressCard } from '../../components/patient/ProgramProgressCard';
import { programmeFor } from '../../lib/programme';
import { t, useLang } from '../../lib/i18n';
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
        <span className="mt-1 block text-xs text-slate-600">{t('Not logged today')}</span>
      </>
    )}
  </div>
);

/** Today's planned exercises as cards: mark done, or say you couldn't. */
const TodayExercises = ({ checklist }: { checklist: Checklist }) => {
  const { items, doneCount, plannedCount, date } = checklist;

  const progress = plannedCount ? Math.round((doneCount / plannedCount) * 100) : 0;
  // To do first, then skipped, then done
  const rank = (i: ChecklistItem) => (i.status === 'DONE' ? 2 : i.status === 'SKIPPED' ? 1 : 0);
  const ordered = [...items].sort((a, b) => rank(a) - rank(b));

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          {t('Today’s exercises')}
        </h2>
        <p className="text-sm text-slate-700">
          {plannedCount === 0 ? t('Nothing planned for today') : doneCount >= plannedCount ? t('All done for today. Great work!') : t('{done} of {planned} done', { done: doneCount, planned: plannedCount })}
        </p>
      </div>

      {plannedCount > 0 && (
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t('Today’s exercises')}>
          <div className="h-3 rounded-full bg-teal-700 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <EmptyState>{checklist.planVersion === 0 ? 'Your doctor will set up your exercises shortly.' : 'Rest day: nothing is planned for today.'}</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {ordered.map((item) => (
            <TodayExerciseCard
              key={item.itemId}
              item={item}
              date={date}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export const PatientDashboard = () => {
  useLang();
  const user = useSignedInUser();

  const profile = useQuery({ queryKey: qk.myProfile, queryFn: profileService.getMine });
  const medical = useQuery({ queryKey: qk.myMedical, queryFn: profileService.getMyMedical });
  const checklist = useQuery({ queryKey: qk.myChecklist, queryFn: completionService.getMyChecklist });
  const today = useQuery({ queryKey: qk.myToday, queryFn: vitalsService.getToday });

  if (checklist.isPending) return <PageLoader label="Loading your day…" />;
  if (checklist.isError) return <ErrorState error={checklist.error} onRetry={() => void checklist.refetch()} />;

  const surgeryDate = medical.data?.plannedSurgeryDate;
  const programme = programmeFor({
    startDate: medical.data?.programmeStartDate,
    lengthDays: medical.data?.programmeLengthDays,
    surgeryDate,
    enrolledAt: profile.data?.createdAt,
  });
  const doctors = profile.data?.doctors ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {t(greeting())}, {firstName(user.name)}
          </h1>
          <p className="mt-1 text-base text-slate-700">{formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <Link to="/patient/health-tracker" className={buttonClass('primary', 'md', 'hidden lg:inline-flex')}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('Log vitals')}
        </Link>
      </header>

      {/* 30px above Today’s exercises, as designed (24px from the page’s spacing + 6) */}
      {programme && (
        <div className="pb-1.5">
          {programme.started ? (
            <ProgramProgressCard currentDay={programme.currentDay} totalDays={programme.totalDays} surgeryDate={surgeryDate ? fromDateKey(surgeryDate) : null} />
          ) : (
            <p className="rounded-2xl border border-ffs-border bg-ffs-surface p-[18px] text-[17px] text-ffs-ink">
              {t('Your {n}-day programme starts on {date}.', { n: programme.totalDays, date: formatDate(programme.start, { weekday: 'long', day: 'numeric', month: 'long' }) })}
            </p>
          )}
        </div>
      )}

      <TodayExercises checklist={checklist.data} />

      <section aria-labelledby="latest-vitals">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="latest-vitals" className="text-lg font-bold text-slate-900">
            {t('Today’s readings')}
          </h2>
          <Link to="/patient/health-tracker" className="text-sm font-semibold text-teal-800 hover:underline">
            {t('Log & charts →')}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TILES.map((tile) => (
            <VitalTile key={tile.type} label={t(tile.label)} reading={today.data?.readings[tile.type]} />
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
            <p className="text-base font-bold text-slate-900">{doctors.length ? doctors.map((d) => d.name).join(', ') : t('Not yet assigned')}</p>
            <p className="text-sm text-slate-600">{medical.data?.plannedSurgery ?? t('Procedure not recorded yet')}</p>
          </div>
        </div>
      </Card>

      {/* Phones: the main action stays one thumb-tap away, above the tab bar */}
      <Link
        to="/patient/health-tracker"
        className={buttonClass('primary', 'lg', 'fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom))] right-4 z-30 rounded-full px-5 shadow-lg lg:hidden')}
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        {t('Log vitals')}
      </Link>
    </div>
  );
};
