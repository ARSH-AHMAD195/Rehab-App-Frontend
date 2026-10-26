import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Mail, Pencil } from 'lucide-react';
import { alertService, completionService, patientService, planService, resendInvitation, vitalsService } from '../../services/apiServices';
import { ApiError, errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { describeDays } from '../../lib/constants';
import { useFormErrors } from '../../lib/forms';
import { useVitalLabel } from '../../lib/vitals';
import { formToMedical, medicalChanges, medicalToForm, type MedicalForm } from '../../lib/medical';
import { describeTarget, formatDate, formatDateTime, formatReading, initials, labelize } from '../../lib/format';
import { Alert, Badge, Button, Card, EmptyState, ErrorState, Modal, ModalActions, PageLoader, SectionTitle } from '../../components/ui';
import { panelId, tabId, Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/toast';
import { VitalTrend } from '../../components/health/VitalTrend';
import { LogsTable } from '../../components/health/LogsTable';
import { AlertSummary } from '../../components/doctor/AlertSummary';
import { MedicalFieldsInputs } from '../../components/doctor/MedicalFieldsInputs';
import { PlanEditorModal } from '../../components/doctor/PlanEditorModal';
import { SurgeryCountdown } from '../../components/doctor/SurgeryCountdown';
import type { MedicalProfile } from '../../types/api';

const TAB_IDS = ['overview', 'vitals', 'exercises', 'alerts'] as const;
type TabKey = (typeof TAB_IDS)[number];

const Detail = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => (
  <div className={className}>
    <dt className="text-xs font-bold uppercase text-slate-600">{label}</dt>
    <dd className="mt-0.5 font-semibold text-slate-900">{children || '—'}</dd>
  </div>
);

const EditMedicalModal = ({ patientId, medical, onClose }: { patientId: string; medical: MedicalProfile; onClose: () => void }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const [f, setF] = useState<MedicalForm>(() => medicalToForm(medical));

  const save = useMutation({
    mutationFn: () => patientService.updateMedical(patientId, { version: medical.version, ...medicalChanges(medical, formToMedical(f)) }),
    onSuccess: () => {
      toast.success('Medical details saved.');
      void queryClient.invalidateQueries({ queryKey: qk.patientPart(patientId, 'medical') });
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'CONCURRENT_UPDATE') {
        void queryClient.invalidateQueries({ queryKey: qk.patientPart(patientId, 'medical') });
        return form.setFormError('Someone else changed these details while you were editing. Close this window to load their version.');
      }
      form.fromApiError(err, 'Could not save the medical details.');
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.validate(e.currentTarget)) save.mutate();
  };

  return (
    <Modal title="Edit medical details" onClose={onClose} size="xl">
      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        <MedicalFieldsInputs value={f} onChange={setF} errors={form.errors} />
        <ModalActions onCancel={onClose} submitLabel="Save" loading={save.isPending} />
      </form>
    </Modal>
  );
};

export const DoctorPatientDetailPage = () => {
  const { id: patientId = '' } = useParams();
  const tabsBase = useId();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState<'plan' | 'medical' | null>(null);
  const vitalLabel = useVitalLabel();

  // The active tab lives in the URL so it survives reloads and works with Back
  const requested = searchParams.get('tab') as TabKey | null;
  const tab: TabKey = requested && TAB_IDS.includes(requested) ? requested : 'overview';
  const setTab = (next: TabKey) => setSearchParams(next === 'overview' ? {} : { tab: next }, { replace: true });

  const patient = useQuery({ queryKey: qk.patient(patientId), queryFn: () => patientService.get(patientId) });
  const medical = useQuery({ queryKey: qk.patientPart(patientId, 'medical'), queryFn: () => patientService.getMedical(patientId) });
  const plan = useQuery({ queryKey: qk.patientPart(patientId, 'plan'), queryFn: () => planService.get(patientId) });
  const alerts = useQuery({ queryKey: qk.alerts({ patientId }), queryFn: () => alertService.list({ patientId, limit: 50 }) });
  const today = useQuery({ queryKey: qk.patientPart(patientId, 'today'), queryFn: () => vitalsService.getPatientToday(patientId), enabled: tab === 'vitals' });
  const logs = useQuery({ queryKey: qk.patientPart(patientId, 'logs'), queryFn: () => vitalsService.getPatientLogs(patientId, { limit: 30 }), enabled: tab === 'vitals' });
  const checklist = useQuery({ queryKey: qk.patientPart(patientId, 'checklist'), queryFn: () => completionService.getChecklist(patientId), enabled: tab === 'exercises' });
  const compliance = useQuery({ queryKey: qk.patientPart(patientId, 'compliance'), queryFn: () => completionService.getCompliance(patientId), enabled: tab === 'exercises' });
  const history = useQuery({ queryKey: qk.patientPart(patientId, 'history'), queryFn: () => completionService.getHistory(patientId, { limit: 20 }), enabled: tab === 'exercises' });

  const invite = useMutation({
    mutationFn: () => resendInvitation(patientId),
    onSuccess: (r) => (r.invitation === 'SENT' ? toast.success('Set-password email sent.') : toast.error('The email could not be sent. Try again later.')),
    onError: (err) => toast.error(errorMessage(err, 'Could not send the email.')),
  });

  const acknowledge = useMutation({
    mutationFn: (id: string) => alertService.acknowledge(id),
    onSuccess: () => toast.success('Alert acknowledged.'),
    onError: (err) => toast.error(errorMessage(err, 'Could not acknowledge the alert.')),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const backLink = (
    <Link to="/doctor/patients" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-teal-800">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to patients
    </Link>
  );

  if (patient.isPending) return <PageLoader label="Loading patient chart…" />;
  if (patient.isError) {
    const retryable = !(patient.error instanceof ApiError) || patient.error.status === 0 || patient.error.status >= 500;
    return (
      <div className="space-y-4">
        {backLink}
        <ErrorState error={patient.error} onRetry={retryable ? () => void patient.refetch() : undefined} title="This patient chart is unavailable" />
      </div>
    );
  }

  const p = patient.data;
  const m = medical.data;
  const openAlerts = (alerts.data?.data ?? []).filter((a) => a.status === 'OPEN');

  const panels: Record<TabKey, ReactNode> = {
    overview: (
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle
            title="Medical details"
            as="h3"
            actions={
              m && (
                <Button size="sm" variant="subtle" onClick={() => setModal('medical')}>
                  <Pencil className="h-4 w-4 text-teal-800" aria-hidden="true" />
                  Edit
                </Button>
              )
            }
          />
          {medical.isPending ? (
            <PageLoader label="Loading medical details…" />
          ) : medical.isError ? (
            <Alert tone="error">Medical details could not be loaded: {errorMessage(medical.error)}</Alert>
          ) : (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Detail label="Planned surgery">{m!.plannedSurgery}</Detail>
              <Detail label="Surgery date">{m!.plannedSurgeryDate && formatDate(m!.plannedSurgeryDate)}</Detail>
              <Detail label="Diagnosis" className="col-span-2">
                {m!.diagnosis}
              </Detail>
              <Detail label="Date of birth / sex">
                {[m!.dateOfBirth && formatDate(m!.dateOfBirth), m!.sex && labelize(m!.sex)].filter(Boolean).join(' · ')}
              </Detail>
              <Detail label="Height / blood group">{[m!.heightCm && `${m!.heightCm} cm`, m!.bloodGroup].filter(Boolean).join(' · ')}</Detail>
              <Detail label="Allergies">
                <span className="text-rose-800">{m!.allergies?.join(', ') || 'None documented'}</span>
              </Detail>
              <Detail label="Smoking">{m!.smokingStatus && labelize(m!.smokingStatus)}</Detail>
              <Detail label="Medications" className="col-span-2">
                {m!.medications?.join('; ') || 'None documented'}
              </Detail>
              <Detail label="Other conditions" className="col-span-2">
                {m!.comorbidities?.join(', ') || 'None documented'}
              </Detail>
              {m!.emergencyContact && (
                <Detail label="Emergency contact" className="col-span-2">
                  {m!.emergencyContact.name} ({m!.emergencyContact.relation}) · {m!.emergencyContact.phone}
                </Detail>
              )}
              {m!.updatedAt && <p className="col-span-2 text-xs text-slate-500">Last updated {formatDateTime(m!.updatedAt)}</p>}
            </dl>
          )}
        </Card>

        <Card>
          <SectionTitle title="Account" as="h3" />
          <dl className="space-y-3 text-sm">
            <Detail label="Email">{p.email}</Detail>
            <Detail label="Phone">{p.phone && <a href={`tel:${p.phone}`} className="text-teal-800 underline">{p.phone}</a>}</Detail>
            <Detail label="Care team">{p.doctors.map((d) => d.name).join(', ')}</Detail>
            <Detail label="Time zone">{p.timeZone}</Detail>
            <Detail label="Status">{!p.active ? 'Deactivated' : p.emailVerified ? 'Active' : 'Invited, hasn’t signed in yet'}</Detail>
          </dl>
          <Button size="sm" variant="secondary" className="mt-4 w-full" onClick={() => invite.mutate()} loading={invite.isPending}>
            <Mail className="h-4 w-4 text-teal-700" aria-hidden="true" />
            Send set-password email
          </Button>
        </Card>
      </div>
    ),
    vitals: (
      <div className="space-y-6">
        <Card>
          <SectionTitle title={`Today${today.data ? ` (${today.data.date})` : ''}`} as="h3" description={today.data && `${today.data.filledCount} of ${today.data.totalCount} filled`} />
          {today.isPending ? (
            <PageLoader label="Loading today’s readings…" />
          ) : today.isError ? (
            <Alert tone="error">{errorMessage(today.error)}</Alert>
          ) : (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(today.data.readings).map(([type, r]) => (
                <div key={type} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <dt className="text-xs font-bold uppercase text-slate-600">{vitalLabel(type)}</dt>
                  <dd className="mt-0.5 font-bold text-slate-900">
                    {formatReading(r.value)} {r.value && <span className="text-xs font-normal text-slate-600">{r.label ?? r.unit}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
        <VitalTrend queryKeyBase={qk.patientPart(patientId, 'vitals')} load={(type, period) => vitalsService.getPatientTrend(patientId, type, period)} />
        <Card>
          <SectionTitle title="Past 30 days" as="h3" />
          {logs.isError ? <Alert tone="error">{errorMessage(logs.error)}</Alert> : <LogsTable logs={logs.data?.data ?? []} emptyMessage={logs.isPending ? 'Loading…' : undefined} />}
        </Card>
      </div>
    ),
    exercises: (
      <div className="space-y-6">
        <Card>
          <SectionTitle
            title={plan.data?.version ? `Exercise plan (version ${plan.data.version})` : 'Exercise plan'}
            description={plan.data?.assignedBy ? `By ${plan.data.assignedBy.name}, ${formatDate(plan.data.updatedAt)}` : undefined}
            as="h3"
            actions={
              plan.data && (
                <Button size="sm" onClick={() => setModal('plan')}>
                  {plan.data.version ? 'Change plan' : 'Assign plan'}
                </Button>
              )
            }
          />
          {plan.isPending ? (
            <PageLoader label="Loading plan…" />
          ) : plan.isError ? (
            <Alert tone="error">{errorMessage(plan.error)}</Alert>
          ) : plan.data.items.length === 0 ? (
            <EmptyState>No exercises assigned yet.</EmptyState>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {plan.data.items.map((i) => (
                <li key={i.itemId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{i.exercise.name}</span>
                    {!i.exercise.active && <Badge tone="rose">Deactivated</Badge>}
                  </div>
                  <p className="mt-1.5 text-slate-700">
                    {[describeDays(i.schedule.daysOfWeek), i.schedule.timesPerDay > 1 ? `${i.schedule.timesPerDay}× a day` : null, describeTarget(i.target)].filter(Boolean).join(' · ')}
                  </p>
                  {i.notes && <p className="mt-2 rounded-lg border border-teal-200 bg-teal-50 p-2 text-teal-950">{i.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionTitle title="Today" as="h3" description={checklist.data && `${checklist.data.doneCount} of ${checklist.data.plannedCount} done`} />
            {checklist.isPending ? (
              <PageLoader label="Loading…" />
            ) : checklist.isError ? (
              <Alert tone="error">{errorMessage(checklist.error)}</Alert>
            ) : checklist.data.items.length === 0 ? (
              <EmptyState>Nothing planned today.</EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {checklist.data.items.map((i) => (
                  <li key={i.itemId} className="flex items-center justify-between py-2">
                    <span className="font-semibold text-slate-900">{i.exercise.name}</span>
                    <Badge tone={i.status === 'DONE' ? 'emerald' : i.status === 'PARTLY_DONE' ? 'amber' : 'slate'}>
                      {i.doneCount}/{i.timesPerDay}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionTitle title="Compliance, last 7 days" as="h3" description={compliance.data && `${compliance.data.done} of ${compliance.data.planned} planned exercises done`} />
            {compliance.isPending ? (
              <PageLoader label="Loading…" />
            ) : compliance.isError ? (
              <Alert tone="error">{errorMessage(compliance.error)}</Alert>
            ) : compliance.data.byExercise.length === 0 ? (
              <EmptyState>Nothing was planned in this period.</EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {compliance.data.byExercise.map((e) => (
                  <li key={e.itemId} className="flex items-center justify-between py-2">
                    <span className="font-semibold text-slate-900">{e.name}</span>
                    <span className="text-slate-700">
                      {e.done} / {e.planned}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <SectionTitle title="Recent completions" as="h3" />
          {history.isPending ? (
            <PageLoader label="Loading…" />
          ) : history.isError ? (
            <Alert tone="error">{errorMessage(history.error)}</Alert>
          ) : history.data.data.length === 0 ? (
            <EmptyState>No exercises ticked off in the last 30 days.</EmptyState>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {history.data.data.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="font-semibold text-slate-900">{c.exercise.name}</span>
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
      </div>
    ),
    alerts: (
      <Card>
        <SectionTitle title="Alerts" as="h3" description="Newest first" />
        {alerts.isPending ? (
          <PageLoader label="Loading alerts…" />
        ) : alerts.isError ? (
          <Alert tone="error">{errorMessage(alerts.error)}</Alert>
        ) : alerts.data.data.length === 0 ? (
          <EmptyState>No alerts for this patient.</EmptyState>
        ) : (
          <ul className="space-y-2.5 text-sm">
            {alerts.data.data.map((a) => (
              <li key={a.id} className="flex flex-col justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
                <div>
                  <Badge tone={a.severity === 'HIGH' ? 'rose' : a.severity === 'MEDIUM' ? 'amber' : 'slate'}>{a.severity}</Badge>{' '}
                  <AlertSummary alert={a} />
                  {a.status === 'ACKNOWLEDGED' && (
                    <p className="mt-1 text-xs text-slate-600">
                      Acknowledged {formatDateTime(a.acknowledgedAt)}
                      {a.note && ` · ${a.note}`}
                    </p>
                  )}
                </div>
                {a.status === 'OPEN' && (
                  <Button size="sm" variant="secondary" onClick={() => acknowledge.mutate(a.id)} loading={acknowledge.isPending && acknowledge.variables === a.id}>
                    Acknowledge
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    ),
  };

  return (
    <div className="space-y-4">
      {backLink}

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-lg font-extrabold text-teal-900">{initials(p.name)}</div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{p.name}</h1>
                <SurgeryCountdown surgeryDate={m?.plannedSurgeryDate} />
                {!p.active && <Badge tone="rose">Deactivated</Badge>}
              </div>
              <p className="text-sm text-slate-700">{[m?.plannedSurgery, m?.plannedSurgeryDate && formatDate(m.plannedSurgeryDate), p.email].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setModal('plan')} disabled={!plan.data}>
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            {plan.data?.version ? 'Change exercise plan' : 'Assign exercise plan'}
          </Button>
        </div>
      </div>

      <Tabs
        base={tabsBase}
        label="Patient chart sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'vitals', label: 'Vitals' },
          { id: 'exercises', label: 'Exercises', count: plan.data?.items.length },
          { id: 'alerts', label: 'Alerts', count: alerts.data ? openAlerts.length : undefined },
        ]}
      />

      <div role="tabpanel" id={panelId(tabsBase)} aria-labelledby={tabId(tabsBase, tab)} tabIndex={0} className="focus:outline-none">
        {panels[tab]}
      </div>

      {modal === 'plan' && plan.data && <PlanEditorModal patientId={patientId} plan={plan.data} onClose={() => setModal(null)} />}
      {modal === 'medical' && m && <EditMedicalModal patientId={patientId} medical={m} onClose={() => setModal(null)} />}
    </div>
  );
};
