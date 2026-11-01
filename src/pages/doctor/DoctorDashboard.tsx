import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, BellOff, CheckCircle2, ShieldAlert, Stethoscope, UserPlus } from 'lucide-react';
import { alertService, completionService, patientService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { formatDate, formatDateTime } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Alert, Badge, Button, Card, EmptyState, ErrorState, PageLoader, SectionTitle, StatCard, buttonClass } from '../../components/ui';
import { adherenceOf, completeDays, incompleteDays, missedOnLastDay, ON_TRACK } from '../../lib/compliance';
import { useToast } from '../../components/ui/toast';
import { AlertSummary } from '../../components/doctor/AlertSummary';
import type { AlertSeverity, VitalAlert } from '../../types/api';

const SEVERITIES = ['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const;

const SEVERITY_STYLES: Record<AlertSeverity, [string, string, string]> = {
  HIGH: ['border-rose-200 bg-rose-50', 'bg-rose-700', 'bg-rose-200 text-rose-950'],
  MEDIUM: ['border-amber-300 bg-amber-50', 'bg-amber-700', 'bg-amber-200 text-amber-950'],
  LOW: ['border-slate-200 bg-slate-50', 'bg-slate-600', 'bg-slate-200 text-slate-900'],
};

const RECENT_PATIENTS = 6;
// ponytail: compliance is one request per patient (no caseload endpoint yet), so only the first 50 patients are counted
const CASELOAD_LIMIT = 50;

export const DoctorDashboard = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('ALL');

  const patients = useQuery({ queryKey: qk.patients({ limit: CASELOAD_LIMIT }), queryFn: () => patientService.list({ limit: CASELOAD_LIMIT }) });
  const week = completeDays(7);
  const compliance = useQueries({
    queries: (patients.data?.data ?? []).map((p) => ({
      queryKey: qk.patientPart(p.id, 'compliance', 'week'),
      queryFn: () => completionService.getCompliance(p.id, week),
      // Each read is audited and costs a request, so don't refetch on every focus
      staleTime: 5 * 60_000,
    })),
  });
  const alerts = useQuery({ queryKey: qk.alerts({ status: 'OPEN' }), queryFn: () => alertService.list({ status: 'OPEN', limit: 100 }), refetchInterval: 60_000 });

  const acknowledge = useMutation({
    mutationFn: (alert: VitalAlert) => alertService.acknowledge(alert.id),
    onSuccess: (_res, alert) => {
      toast.success(`Alert for ${alert.patient.name} acknowledged.`);
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
    onError: (err) => {
      toast.error(errorMessage(err, 'Could not acknowledge the alert.'));
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  if (patients.isPending) return <PageLoader label="Loading your caseload…" />;
  if (patients.isError) return <ErrorState error={patients.error} onRetry={() => void patients.refetch()} />;

  const alertList = alerts.data?.data ?? [];
  const count = (s: AlertSeverity) => alertList.filter((a) => a.severity === s).length;
  const visibleAlerts = alertList.filter((a) => severity === 'ALL' || a.severity === severity);

  const caseload = patients.data.data;
  const loaded = caseload.flatMap((p, i) => (compliance[i]?.data ? [{ patient: p, c: compliance[i]!.data! }] : []));
  const complianceLoading = compliance.some((q) => q.isPending);
  const countOf = (a: ReturnType<typeof adherenceOf>) => (complianceLoading ? '—' : loaded.filter((x) => adherenceOf(x.c) === a).length);
  const missed = loaded.flatMap(({ patient, c }) => {
    const day = missedOnLastDay(c);
    return day ? [{ patient, day, incomplete: incompleteDays(c) }] : [];
  });

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-teal-900 via-teal-800 to-navy-900 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-teal-50">
              <Stethoscope className="h-4 w-4" aria-hidden="true" />
              Prehabilitation monitoring
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Clinician dashboard</h1>
            <p className="max-w-xl text-base text-teal-50">Vital sign alerts and recent patients across your caseload.</p>
          </div>
          <Link to="/doctor/onboard-patient" className={buttonClass('secondary', 'md', 'shrink-0 border-0 font-bold text-teal-950')}>
            <UserPlus className="h-4 w-4 text-teal-800" aria-hidden="true" />
            Onboard patient
          </Link>
        </div>
      </div>

      <section aria-label="Routine adherence">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Patients" value={patients.data.nextCursor ? `${caseload.length}+` : caseload.length} hint="Linked to you" />
          <StatCard label="Following their routine" value={countOf('on-track')} hint={`${Math.round(ON_TRACK * 100)}%+ of planned exercises done`} tone="teal" />
          <StatCard label="Falling behind" value={countOf('behind')} hint={`Under ${Math.round(ON_TRACK * 100)}% done`} />
          <StatCard label="No plan yet" value={countOf('no-plan')} hint="Nothing planned this week" />
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Based on the last 7 complete days{patients.data.nextCursor ? `, first ${CASELOAD_LIMIT} patients` : ''}.
        </p>
      </section>

      <Card className="space-y-4">
        <SectionTitle title="Missed exercises yesterday" description="Patients who didn’t do everything planned for them" />
        {complianceLoading ? (
          <PageLoader label="Checking exercise routines…" />
        ) : missed.length === 0 ? (
          <p className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            Everyone did their planned exercises yesterday.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {missed.map(({ patient, day, incomplete }) => (
              <li key={patient.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900">{patient.name}</span>
                    <Badge tone={day.done === 0 ? 'rose' : 'amber'}>
                      {day.done} of {day.planned} done
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-700">
                    {incomplete > 1 ? `${incomplete} of the last 7 days incomplete` : 'First missed day this week'}
                  </p>
                </div>
                <Link to={`/doctor/patient/${patient.id}?tab=exercises`} className={buttonClass('secondary', 'sm', 'shrink-0 self-end sm:self-auto')}>
                  Exercises<span className="sr-only"> for {patient.name}</span>
                  <ArrowRight className="h-4 w-4 text-teal-700" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Abnormal vitals</h2>
              <p className="text-sm text-slate-600">Readings that crossed a patient’s alert limit</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter alerts by severity">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={severity === s}
                onClick={() => setSeverity(s)}
                className={cn('min-h-9 rounded-xl px-3 text-sm font-semibold capitalize transition-colors', severity === s ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200')}
              >
                {s.toLowerCase()} {s !== 'ALL' && alerts.data && `(${count(s)})`}
              </button>
            ))}
          </div>
        </div>

        {alerts.isError ? (
          <Alert tone="error">Alerts could not be loaded: {errorMessage(alerts.error)}</Alert>
        ) : alerts.isPending ? (
          <PageLoader label="Checking patient alerts…" />
        ) : alertList.length === 0 ? (
          <p className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            No open alerts for your patients.
          </p>
        ) : visibleAlerts.length === 0 ? (
          <EmptyState>No {severity.toLowerCase()} alerts.</EmptyState>
        ) : (
          <ul className="max-h-[28rem] space-y-2.5 overflow-y-auto pr-1">
            {visibleAlerts.map((alert) => {
              const [row, icon, pill] = SEVERITY_STYLES[alert.severity];
              return (
                <li key={alert.id} className={cn('flex flex-col justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center', row)}>
                  <div className="flex items-start gap-3">
                    <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white', icon)}>
                      <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-900">{alert.patient.name}</span>
                        <span className={cn('rounded-md px-1.5 py-0.5 text-xs font-bold uppercase', pill)}>{alert.severity}</span>
                      </div>
                      <p className="mt-0.5 text-sm font-medium leading-relaxed text-slate-800">
                        <AlertSummary alert={alert} />
                      </p>
                      <time dateTime={alert.createdAt} className="mt-1 block text-xs text-slate-600">
                        {formatDateTime(alert.createdAt)}
                      </time>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 self-end sm:self-auto">
                    <Button size="sm" variant="secondary" onClick={() => acknowledge.mutate(alert)} loading={acknowledge.isPending && acknowledge.variables?.id === alert.id}>
                      <BellOff className="h-4 w-4" aria-hidden="true" />
                      Acknowledge
                    </Button>
                    <Link to={`/doctor/patient/${alert.patient.id}?tab=vitals`} className={buttonClass('secondary', 'sm')}>
                      Chart<span className="sr-only"> for {alert.patient.name}</span>
                      <ArrowRight className="h-4 w-4 text-teal-700" aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle
          title="Recently enrolled patients"
          description="Only patients linked to you are shown"
          actions={
            <Link to="/doctor/patients" className="text-sm font-semibold text-teal-800 hover:underline">
              View all patients →
            </Link>
          }
        />
        {caseload.length === 0 ? (
          <EmptyState>
            No patients linked to you yet.{' '}
            <Link to="/doctor/onboard-patient" className="font-semibold text-teal-800 underline">
              Onboard your first patient
            </Link>
          </EmptyState>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {caseload.slice(0, RECENT_PATIENTS).map((p) => (
              <li key={p.id} className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{p.name}</h3>
                  <p className="mt-1 text-sm text-slate-700">{p.email}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Enrolled {formatDate(p.createdAt)}
                    {!p.emailVerified && ' · hasn’t signed in yet'}
                  </p>
                </div>
                <Link to={`/doctor/patient/${p.id}`} className="mt-4 inline-flex items-center gap-1 self-end text-sm font-semibold text-teal-800 hover:underline">
                  Open chart<span className="sr-only"> for {p.name}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
