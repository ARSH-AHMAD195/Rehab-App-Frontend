import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, CheckCircle2, Plus, Stethoscope } from 'lucide-react';
import { useSignedInUser } from '../../context/AuthContext';
import { consentService, exerciseService, followUpService, healthService, patientService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { QUICK_VITAL_TYPES } from '../../lib/constants';
import { formatDate, formatDateTime, fullName } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Button, Card, EmptyState, ErrorState, Modal, PageLoader, SectionTitle } from '../../components/ui';
import { LogSessionModal } from '../../components/exercise/LogSessionModal';
import { MeasurementForm } from '../../components/health/MeasurementForm';
import { ConsentModal } from '../../components/patient/ConsentModal';
import { ActivityTimeline } from '../../components/doctor/ActivityTimeline';
import type { ExerciseAssignment, HealthMeasurement, UserSummary } from '../../types/api';

const VITALS: { type: string; label: string; unit: string; format: (m: HealthMeasurement) => string | number | undefined }[] = [
  { type: 'blood_pressure', label: 'Blood pressure', unit: 'mmHg', format: (m) => `${m.systolic}/${m.diastolic}` },
  { type: 'spo2', label: 'Oxygen level', unit: '%', format: (m) => m.numericValue },
  { type: 'pulse', label: 'Pulse', unit: 'bpm', format: (m) => m.numericValue },
  { type: 'pain_score', label: 'Pain', unit: '/ 10', format: (m) => m.numericValue },
];

const greeting = (hour = new Date().getHours()) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

const VitalTile = ({ label, unit, reading, format }: (typeof VITALS)[number] & { reading?: HealthMeasurement }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
    <span className="text-sm font-semibold text-slate-700">{label}</span>
    {reading ? (
      <>
        <p className="mt-1 text-2xl font-bold text-slate-900">
          {format(reading)}
          <span className="ml-1 text-sm font-normal text-slate-600">{unit}</span>
        </p>
        <span className="mt-1 block text-xs text-slate-600">{formatDate(reading.measuredAt, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
      </>
    ) : (
      <>
        <p className="mt-1 text-2xl font-bold text-slate-400" aria-hidden="true">
          —
        </p>
        <span className="mt-1 block text-xs text-slate-600">No reading this week</span>
      </>
    )}
  </div>
);

export const PatientDashboard = () => {
  const user = useSignedInUser();
  const [loggingAssignment, setLoggingAssignment] = useState<ExerciseAssignment | null>(null);
  const [showVitalModal, setShowVitalModal] = useState(false);

  const profile = useQuery({ queryKey: qk.myProfile, queryFn: patientService.getMyProfile });
  const assigned = useQuery({ queryKey: qk.myAssignments, queryFn: () => exerciseService.getMyAssigned().then((r) => r.assignments) });
  const measurements = useQuery({ queryKey: qk.myMeasurements({ days: 7 }), queryFn: () => healthService.getMyMeasurements({ days: 7 }).then((r) => r.measurements) });
  const consents = useQuery({ queryKey: qk.myConsents, queryFn: consentService.getMyConsents });
  const followUps = useQuery({ queryKey: qk.myFollowUps, queryFn: () => followUpService.getMyFollowUps().then((r) => r.followUps) });
  const timeline = useQuery({ queryKey: qk.myTimeline, queryFn: () => patientService.getMyTimeline().then((r) => r.timeline) });

  if (profile.isPending || assigned.isPending) return <PageLoader label="Loading your day…" />;
  if (profile.isError || assigned.isError) {
    return (
      <ErrorState
        error={profile.error ?? assigned.error}
        onRetry={() => {
          void profile.refetch();
          void assigned.refetch();
        }}
      />
    );
  }

  const { profile: p, daysUntilSurgery } = profile.data;
  const assignments = assigned.data;
  const doctor = p.assignedDoctor;
  const remaining = assignments.filter((a) => !a.completedToday);
  const doneCount = assignments.length - remaining.length;
  const progress = assignments.length ? Math.round((doneCount / assignments.length) * 100) : 0;
  const latest = (type: string) => measurements.data?.find((m) => m.type === type);
  const upcoming = (followUps.data ?? []).filter((f) => f.status === 'scheduled' && new Date(f.scheduledDate) >= new Date()).slice(0, 3);
  // To-do first, done at the bottom
  const ordered = [...remaining, ...assignments.filter((a) => a.completedToday)];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {greeting()}, {user.firstName}
          </h1>
          <p className="mt-1 text-base text-slate-700">
            <strong className="text-teal-900">
              {daysUntilSurgery} {daysUntilSurgery === 1 ? 'day' : 'days'}
            </strong>{' '}
            until your surgery on {formatDate(p.surgeryDate, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Button onClick={() => setShowVitalModal(true)} className="hidden lg:inline-flex">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Log vitals
        </Button>
      </header>

      <Card aria-labelledby="today-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="today-heading" className="text-lg font-bold text-slate-900">
              Today’s exercises
            </h2>
            <p className="text-sm text-slate-700">
              {assignments.length === 0
                ? 'Nothing prescribed yet'
                : remaining.length === 0
                  ? 'All done for today. Great work!'
                  : `${doneCount} of ${assignments.length} done · ${remaining.length} to go`}
            </p>
          </div>
          <Link to="/patient/exercises" className="text-sm font-semibold text-teal-800 hover:underline">
            How to do them →
          </Link>
        </div>

        {assignments.length > 0 && (
          <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Today's exercises completed">
            <div className="h-3 rounded-full bg-teal-700 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        )}

        {assignments.length === 0 ? (
          <EmptyState>Your doctor will set up your exercises shortly.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {ordered.map((a) => (
              <li
                key={a._id}
                className={cn('flex items-center justify-between gap-3 rounded-2xl border p-4', a.completedToday ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white')}
              >
                <div className="min-w-0">
                  <h3 className={cn('text-base font-bold', a.completedToday ? 'text-emerald-950' : 'text-slate-900')}>{a.exercise?.title}</h3>
                  <p className="text-sm text-slate-600">
                    {a.customizedDurationMinutes} min · {a.customizedSets} × {a.customizedReps} · {a.frequency}
                  </p>
                </div>
                {a.completedToday ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-900">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    Done
                  </span>
                ) : (
                  <Button size="lg" onClick={() => setLoggingAssignment(a)} className="shrink-0">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    Mark done<span className="sr-only">: {a.exercise?.title}</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section aria-labelledby="latest-vitals">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="latest-vitals" className="text-lg font-bold text-slate-900">
            Your latest readings
          </h2>
          <Link to="/patient/health-tracker" className="text-sm font-semibold text-teal-800 hover:underline">
            Charts →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {VITALS.map((v) => (
            <VitalTile key={v.type} {...v} reading={latest(v.type)} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Upcoming appointments" />
          {followUps.isPending ? (
            <PageLoader label="Loading appointments…" />
          ) : upcoming.length === 0 ? (
            <EmptyState>No upcoming appointments.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((f) => (
                <li key={f._id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-teal-800" aria-hidden="true" />
                  <div>
                    <time dateTime={f.scheduledDate} className="block text-base font-bold text-slate-900">
                      {formatDateTime(f.scheduledDate)}
                    </time>
                    <p className="text-sm text-slate-700">{f.reason}</p>
                    {typeof f.doctor === 'object' && f.doctor && <p className="text-sm text-slate-600">with Dr. {fullName(f.doctor as UserSummary)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionTitle title="Your care team" />
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-800">
              <Stethoscope className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">{doctor ? `Dr. ${fullName(doctor)}` : 'Not yet assigned'}</p>
              <p className="text-sm text-slate-600">{p.surgeryType}</p>
            </div>
          </div>
          <dl className="mt-4 space-y-1 border-t border-slate-100 pt-4 text-sm text-slate-700">
            {doctor?.phone && (
              <div className="flex gap-1">
                <dt>Phone:</dt>
                <dd>
                  <a href={`tel:${doctor.phone}`} className="font-semibold text-teal-800 underline">
                    {doctor.phone}
                  </a>
                </dd>
              </div>
            )}
            <div className="flex gap-1">
              <dt>Hospital ID:</dt>
              <dd className="font-semibold">{p.hospitalNumber || '—'}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card>
        <SectionTitle
          title="Recent activity"
          actions={
            <Link to="/patient/report" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-800 hover:underline">
              Full report <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          }
        />
        {timeline.isPending ? <PageLoader label="Loading activity…" /> : <ActivityTimeline items={(timeline.data ?? []).slice(0, 5)} />}
      </Card>

      {/* Phones: the main action stays one thumb-tap away, above the tab bar */}
      <Button
        size="lg"
        onClick={() => setShowVitalModal(true)}
        className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 rounded-full px-5 shadow-lg lg:hidden"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        Log vitals
      </Button>

      {loggingAssignment && <LogSessionModal assignment={loggingAssignment} onClose={() => setLoggingAssignment(null)} />}

      {showVitalModal && (
        <Modal title="Log a reading" description="Your care team reviews these" onClose={() => setShowVitalModal(false)} size="lg">
          <MeasurementForm
            types={QUICK_VITAL_TYPES}
            onCancel={() => setShowVitalModal(false)}
            // Keep the dialog open so the patient reads any safety notice
            onSaved={(notice) => !notice && setShowVitalModal(false)}
          />
        </Modal>
      )}

      {consents.data && !consents.data.isFullyConsented && <ConsentModal />}
    </div>
  );
};
