import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Heart, Printer } from 'lucide-react';
import { reportService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { downloadBlob } from '../../lib/download';
import { formatDate, formatDateTime, fullName, labelize, localDateKey } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Button, EmptyState, ErrorState, PageLoader } from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import { MeasurementTable } from '../../components/health/MeasurementTable';
import type { ExerciseAssignment, ExerciseSession, HealthMeasurement, PatientProfile, ReportSummary } from '../../types/api';

type Period = 'program' | 'weekly' | 'monthly';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'program', label: 'Whole program' },
  { value: 'weekly', label: 'Last 7 days' },
  { value: 'monthly', label: 'Last 30 days' },
];

interface ReportView {
  title: string;
  patient: { name: string; email: string; phone?: string };
  profile: PatientProfile | null;
  summary: ReportSummary;
  measurements: HealthMeasurement[];
  sessions: ExerciseSession[];
  assignments?: ExerciseAssignment[];
}

// The full and period reports have different shapes; normalise them for one layout.
const loadReport = async (period: Period): Promise<ReportView> => {
  if (period === 'program') {
    const { report } = await reportService.getMyReport();
    return {
      title: 'Whole program',
      patient: report.patient,
      profile: report.profile,
      summary: report.summary,
      measurements: report.recentMeasurements,
      sessions: report.recentSessions,
      assignments: report.assignments,
    };
  }
  const r = await reportService.getMyPeriodReport(period);
  return { title: r.period, patient: r.patient, profile: r.profile, summary: r.summary, measurements: r.measurements, sessions: r.sessions };
};

const Metric = ({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <span className="text-xs font-semibold uppercase text-slate-600">{label}</span>
    <p className={cn('mt-1 text-2xl font-bold', accent ? 'text-teal-800' : 'text-slate-900')}>{value}</p>
  </div>
);

export const PatientReportPage = () => {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>('program');
  const report = useQuery({ queryKey: qk.myReport(period), queryFn: () => loadReport(period), placeholderData: (prev) => prev });

  const exportCsv = useMutation({
    mutationFn: reportService.exportMyCsv,
    onSuccess: (blob) => downloadBlob(blob, `prehab_report_${localDateKey()}.csv`),
    onError: (err) => toast.error(errorMessage(err, 'Could not export the report. Please try again.')),
  });

  if (report.isPending) return <PageLoader label="Compiling your report…" />;
  if (report.isError) return <ErrorState error={report.error} onRetry={() => void report.refetch()} />;

  const { patient, profile, summary, measurements, sessions, assignments } = report.data;
  const doctor = profile?.assignedDoctor;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:p-6 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Progress report</h1>
          <p className="text-sm text-slate-600">Your exercise adherence and recorded measurements</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => exportCsv.mutate()} loading={exportCsv.isPending}>
            <Download className="h-4 w-4 text-teal-800" aria-hidden="true" />
            Export CSV
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print
          </Button>
        </div>
      </div>

      <div className="inline-flex rounded-2xl bg-slate-100 p-1 print:hidden" role="group" aria-label="Report period">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={period === p.value}
            onClick={() => setPeriod(p.value)}
            className={cn('min-h-10 rounded-xl px-4 text-sm font-bold', period === p.value ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-700 hover:text-slate-900')}
          >
            {p.label}
          </button>
        ))}
      </div>

      <article aria-busy={report.isFetching} className="space-y-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-800 text-white">
              <Heart className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xl font-extrabold tracking-tight text-slate-900">Fit for Surgery</p>
              <p className="text-sm font-semibold text-teal-900">Prehabilitation report · {report.data.title}</p>
            </div>
          </div>
          <div className="text-sm text-slate-700 sm:text-right">
            <p>
              Generated: <strong>{formatDate(new Date())}</strong>
            </p>
            <p>
              Hospital ID: <strong>{profile?.hospitalNumber || '—'}</strong>
            </p>
          </div>
        </header>

        <div className="grid gap-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div>
            <h2 className="mb-1 text-xs font-bold uppercase text-slate-600">Patient</h2>
            <p className="text-base font-bold text-slate-900">{patient.name}</p>
            <p className="text-slate-700">{patient.email}</p>
            {patient.phone && <p className="text-slate-700">{patient.phone}</p>}
            <p className="mt-2 font-semibold text-slate-900">Procedure: {profile?.surgeryType || '—'}</p>
            <p className="font-bold text-teal-900">Surgery date: {formatDate(profile?.surgeryDate)}</p>
          </div>
          <div>
            <h2 className="mb-1 text-xs font-bold uppercase text-slate-600">Supervising clinician</h2>
            <p className="text-base font-bold text-slate-900">{doctor ? `Dr. ${fullName(doctor)}` : 'Not assigned'}</p>
            {doctor?.email && <p className="text-slate-700">{doctor.email}</p>}
            <p className="mt-2 text-slate-700">
              Weekly exercise goal: <strong>{profile?.targetWeeklyExerciseMinutes ?? 150} minutes</strong>
            </p>
          </div>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Summary</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {summary.totalExercisesAssigned !== undefined && <Metric label="Prescribed exercises" value={summary.totalExercisesAssigned} />}
            {summary.adherenceRate !== undefined && <Metric label="Adherence" value={`${summary.adherenceRate}%`} accent />}
            <Metric label="Completed sessions" value={summary.completedSessionsCount} accent={summary.adherenceRate === undefined} />
            <Metric label="Active minutes" value={summary.totalMinutesLogged} />
            <Metric label="Measurements" value={summary.totalMeasurementsRecorded ?? summary.totalMeasurements ?? 0} />
          </div>
        </section>

        {assignments && (
          <section>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Prescribed exercises</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-600">
                  <tr>
                    <th scope="col" className="p-3">Exercise</th>
                    <th scope="col" className="p-3">Category</th>
                    <th scope="col" className="p-3">Frequency</th>
                    <th scope="col" className="p-3">Sets × reps</th>
                    <th scope="col" className="p-3">Duration</th>
                    <th scope="col" className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-600">
                        No exercises prescribed yet.
                      </td>
                    </tr>
                  ) : (
                    assignments.map((a) => (
                      <tr key={a._id}>
                        <td className="p-3 font-semibold text-slate-900">{a.exercise?.title}</td>
                        <td className="p-3">{labelize(a.exercise?.category)}</td>
                        <td className="p-3">{a.frequency}</td>
                        <td className="p-3">
                          {a.customizedSets} × {a.customizedReps}
                        </td>
                        <td className="p-3">{a.customizedDurationMinutes} mins</td>
                        <td className="p-3">{labelize(a.status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Exercise sessions</h2>
          {sessions.length === 0 ? (
            <EmptyState>No sessions logged in this period.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {sessions.slice(0, 15).map((s) => (
                <li key={s._id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                  <span className="font-semibold text-slate-900">{s.exercise?.title ?? 'Exercise'}</span>
                  <span className="text-slate-700">
                    {s.durationMinutes} min · effort {s.perceivedExertion}/10 · {formatDateTime(s.completedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-700">Recent measurements</h2>
          <MeasurementTable measurements={measurements.slice(0, 15)} emptyMessage="No measurements in this period." />
        </section>

        <footer className="space-y-2 border-t border-slate-200 pt-6 text-sm text-slate-700">
          <p>
            <strong>Note:</strong> This report reflects tracked adherence and recorded measurements under clinician guidance. It does not calculate surgical risk or
            predict outcomes.
          </p>
          <div className="flex items-end justify-between pt-8">
            <p className="w-48 border-t border-slate-500 pt-1 font-semibold text-slate-900">Patient signature</p>
            <p className="w-48 border-t border-slate-500 pt-1 text-right font-semibold text-slate-900">Clinician signature / date</p>
          </div>
        </footer>
      </article>
    </div>
  );
};
