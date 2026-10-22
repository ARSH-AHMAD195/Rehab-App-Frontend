import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Download, FileText, Plus } from 'lucide-react';
import { clinicalNoteService, followUpService, healthService, patientService, reportService } from '../../services/apiServices';
import { ApiError, errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { downloadBlob } from '../../lib/download';
import { buildTrends } from '../../lib/trends';
import { formatDate, formatDateTime, formatMedication, fullName, initials, labelize } from '../../lib/format';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, PageLoader, SectionTitle } from '../../components/ui';
import { panelId, tabId, Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/toast';
import { TrendChart, type TrendSeries } from '../../components/health/TrendChart';
import { MeasurementTable } from '../../components/health/MeasurementTable';
import { ActivityTimeline } from '../../components/doctor/ActivityTimeline';
import { ClinicalNoteModal, FollowUpModal, PrescribeExerciseModal } from '../../components/doctor/ClinicalModals';
import { SurgeryCountdown } from '../../components/doctor/SurgeryCountdown';
import type { ClinicalNote, FollowUp, FollowUpStatus } from '../../types/api';

const VITALS_SERIES: TrendSeries[] = [
  { key: 'systolic', name: 'Systolic (mmHg)', color: '#0f766e' },
  { key: 'diastolic', name: 'Diastolic (mmHg)', color: '#0369a1' },
  { key: 'spo2', name: 'SpO2 (%)', color: '#047857' },
  { key: 'pulse', name: 'Pulse (bpm)', color: '#be123c' },
];

const TAB_IDS = ['overview', 'vitals', 'exercises', 'notes', 'followups', 'activity'] as const;
type TabKey = (typeof TAB_IDS)[number];

const Detail = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => (
  <div>
    <dt className="text-xs font-bold uppercase text-slate-600">{label}</dt>
    <dd className={className ?? 'mt-0.5 font-semibold text-slate-900'}>{children}</dd>
  </div>
);

const NoteCard = ({ note }: { note: ClinicalNote }) => (
  <li className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="font-bold text-slate-900">{labelize(note.noteType)}</span>
      <span className="text-xs text-slate-600">
        {formatDate(note.createdAt)}
        {note.doctor && ` · Dr. ${fullName(note.doctor)}`}
      </span>
    </div>
    {note.isConfidential && (
      <Badge tone="amber" className="mt-1">
        Confidential
      </Badge>
    )}
    <p className="mt-1.5 whitespace-pre-line leading-relaxed text-slate-800">{note.content}</p>
    {note.followUpInstructions && (
      <p className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-slate-700">
        <strong>Patient instructions:</strong> {note.followUpInstructions}
      </p>
    )}
  </li>
);

export const DoctorPatientDetailPage = () => {
  const { id: patientId = '' } = useParams();
  const tabsBase = useId();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal] = useState<'prescribe' | 'note' | 'followup' | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{ followUp: FollowUp; status: FollowUpStatus } | null>(null);

  // The active tab lives in the URL so it survives reloads and works with Back
  const requested = searchParams.get('tab') as TabKey | null;
  const tab: TabKey = requested && TAB_IDS.includes(requested) ? requested : 'overview';
  const setTab = (next: TabKey) => setSearchParams(next === 'overview' ? {} : { tab: next }, { replace: true });

  const chart = useQuery({ queryKey: qk.patient(patientId), queryFn: () => patientService.getPatientById(patientId) });
  const measurements = useQuery({
    queryKey: qk.patientPart(patientId, 'measurements'),
    queryFn: () => healthService.getPatientMeasurements(patientId, { days: 14 }).then((r) => r.measurements),
  });
  const notes = useQuery({ queryKey: qk.patientPart(patientId, 'notes'), queryFn: () => clinicalNoteService.getPatientNotes(patientId).then((r) => r.notes) });
  const followUps = useQuery({
    queryKey: qk.patientPart(patientId, 'followUps'),
    queryFn: () => followUpService.getPatientFollowUps(patientId).then((r) => r.followUps),
  });
  const timeline = useQuery({ queryKey: qk.patientPart(patientId, 'timeline'), queryFn: () => patientService.getPatientTimeline(patientId).then((r) => r.timeline) });

  const trends = useMemo(() => buildTrends(measurements.data ?? []), [measurements.data]);

  const exportCsv = useMutation({
    mutationFn: () => reportService.exportPatientCsv(patientId),
    onSuccess: (blob) => downloadBlob(blob, `${fullName(chart.data?.patient).replace(/\s+/g, '_') || 'patient'}_vitals.csv`),
    onError: (err) => toast.error(errorMessage(err, 'Could not export vitals. Please try again.')),
  });

  const updateStatus = useMutation({
    mutationFn: ({ followUp, status }: { followUp: FollowUp; status: FollowUpStatus }) => followUpService.updateStatus(followUp._id, status),
    onSuccess: (_res, { status }) => {
      toast.success(status === 'completed' ? 'Follow-up marked as completed.' : 'Follow-up cancelled.');
      setPendingStatus(null);
      void queryClient.invalidateQueries({ queryKey: qk.patient(patientId) });
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not update the follow-up.')),
  });

  const backLink = (
    <Link to="/doctor/patients" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-teal-800">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to patients
    </Link>
  );

  if (chart.isPending) return <PageLoader label="Loading patient chart…" />;
  if (chart.isError) {
    const retryable = !(chart.error instanceof ApiError) || chart.error.status === 0 || chart.error.status >= 500;
    return (
      <div className="space-y-4">
        {backLink}
        <ErrorState error={chart.error} onRetry={retryable ? () => void chart.refetch() : undefined} title="This patient chart is unavailable" />
      </div>
    );
  }

  const { patient, profile, activeAssignments, adherence } = chart.data;
  const noteList = notes.data ?? [];
  const allFollowUps = followUps.data ?? [];
  const scheduled = allFollowUps.filter((f) => f.status === 'scheduled').sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const past = allFollowUps.filter((f) => f.status !== 'scheduled').reverse();
  const nextFollowUp = scheduled[0];
  const latestNote = noteList[0];

  const followUpCard = (f: FollowUp) => {
    const overdue = new Date(f.scheduledDate) < new Date();
    const completing = updateStatus.isPending && updateStatus.variables?.followUp._id === f._id && updateStatus.variables.status === 'completed';
    return (
      <li key={f._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <div className="flex items-start justify-between gap-2">
          <time dateTime={f.scheduledDate} className="font-bold text-slate-900">
            {formatDateTime(f.scheduledDate)}
          </time>
          {overdue && <Badge tone="amber">Overdue</Badge>}
        </div>
        <p className="mt-1 text-slate-800">{f.reason}</p>
        {f.notes && <p className="mt-1 text-slate-600">{f.notes}</p>}
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="success" onClick={() => updateStatus.mutate({ followUp: f, status: 'completed' })} loading={completing}>
            Mark completed
          </Button>
          <Button size="sm" variant="danger" onClick={() => setPendingStatus({ followUp: f, status: 'cancelled' })}>
            Cancel
          </Button>
        </div>
      </li>
    );
  };

  const panels: Record<TabKey, ReactNode> = {
    overview: (
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Clinical summary" as="h3" />
          <dl className="grid gap-4 sm:grid-cols-3">
            <Detail label="Active protocols" className="mt-0.5 text-lg font-bold text-slate-900">
              {adherence.totalActiveExercises} exercises
            </Detail>
            <Detail label="Last 7 days" className="mt-0.5 text-lg font-bold text-teal-900">
              {adherence.completedSessionsLast7Days} sessions
            </Detail>
            <Detail label="Weekly target" className="mt-0.5 text-lg font-bold text-slate-900">
              {profile?.targetWeeklyExerciseMinutes ?? 150} mins
            </Detail>
          </dl>
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 text-sm">
            <Detail label="Height / weight">
              {profile?.heightCm ? `${profile.heightCm} cm` : '—'} / {profile?.weightKg ? `${profile.weightKg} kg` : '—'}
            </Detail>
            <Detail label="BMI / mobility">
              {profile?.bmi ? `${profile.bmi} kg/m²` : '—'} · {labelize(profile?.baselineMobility || 'not recorded')}
            </Detail>
            <Detail label="Allergies" className="mt-0.5 font-semibold text-rose-800">
              {profile?.allergies.length ? profile.allergies.join(', ') : 'None documented'}
            </Detail>
            <Detail label="Medications">{profile?.currentMedications.length ? profile.currentMedications.map(formatMedication).join('; ') : 'None documented'}</Detail>
            <Detail label="Medical conditions" className="col-span-2 mt-0.5 font-semibold text-slate-900">
              {profile?.medicalConditions.length ? profile.medicalConditions.join(', ') : 'None documented'}
            </Detail>
            {profile?.emergencyContact?.name && (
              <Detail label="Emergency contact" className="col-span-2 mt-0.5 font-semibold text-slate-900">
                {profile.emergencyContact.name}
                {profile.emergencyContact.relationship && ` (${profile.emergencyContact.relationship})`}
                {profile.emergencyContact.phone && ` · ${profile.emergencyContact.phone}`}
              </Detail>
            )}
          </dl>
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionTitle title="Next follow-up" as="h3" actions={<button type="button" onClick={() => setTab('followups')} className="text-sm font-semibold text-teal-800 hover:underline">All</button>} />
            {nextFollowUp ? (
              <p className="text-sm text-slate-800">
                <strong className="block text-base text-slate-900">{formatDateTime(nextFollowUp.scheduledDate)}</strong>
                {nextFollowUp.reason}
              </p>
            ) : (
              <EmptyState className="py-2 text-left">None scheduled.</EmptyState>
            )}
          </Card>
          <Card>
            <SectionTitle title="Latest note" as="h3" actions={<button type="button" onClick={() => setTab('notes')} className="text-sm font-semibold text-teal-800 hover:underline">All</button>} />
            {latestNote ? (
              <p className="line-clamp-4 text-sm text-slate-800">
                <strong className="block text-slate-900">
                  {labelize(latestNote.noteType)} · {formatDate(latestNote.createdAt)}
                </strong>
                {latestNote.content}
              </p>
            ) : (
              <EmptyState className="py-2 text-left">No notes yet.</EmptyState>
            )}
          </Card>
        </div>
      </div>
    ),
    vitals: (
      <div className="space-y-6">
        <TrendChart title="Pre-operative vitals" subtitle="Blood pressure, oxygen and pulse, last 14 days" data={trends} series={VITALS_SERIES} />
        <Card>
          <SectionTitle title="Readings, last 14 days" as="h3" />
          {measurements.isPending ? <PageLoader label="Loading readings…" /> : <MeasurementTable measurements={measurements.data ?? []} />}
        </Card>
      </div>
    ),
    exercises: (
      <Card>
        <SectionTitle title="Prescribed exercises" as="h3" actions={<Button size="sm" onClick={() => setModal('prescribe')}>Prescribe</Button>} />
        {activeAssignments.length === 0 ? (
          <EmptyState>No active exercises prescribed.</EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {activeAssignments.map((a) => (
              <li key={a._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">{a.exercise?.title}</span>
                  <Badge tone="teal">{a.frequency}</Badge>
                </div>
                <p className="mt-1.5 text-slate-700">
                  {a.customizedSets} × {a.customizedReps} reps · {a.customizedDurationMinutes} mins
                </p>
                {a.customizedInstructions && <p className="mt-2 rounded-lg border border-teal-200 bg-teal-50 p-2 text-teal-950">{a.customizedInstructions}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    ),
    notes: (
      <Card>
        <SectionTitle title="Clinical notes" as="h3" actions={<Button size="sm" onClick={() => setModal('note')}>Add note</Button>} />
        {notes.isPending ? <PageLoader label="Loading notes…" /> : noteList.length === 0 ? <EmptyState>No clinical notes recorded yet.</EmptyState> : <ul className="space-y-3">{noteList.map((n) => <NoteCard key={n._id} note={n} />)}</ul>}
      </Card>
    ),
    followups: (
      <Card>
        <SectionTitle title="Follow-ups" as="h3" actions={<Button size="sm" onClick={() => setModal('followup')}>Schedule</Button>} />
        {followUps.isPending ? (
          <PageLoader label="Loading follow-ups…" />
        ) : scheduled.length === 0 && past.length === 0 ? (
          <EmptyState>No follow-ups scheduled.</EmptyState>
        ) : (
          <div className="space-y-6">
            {scheduled.length > 0 && <ul className="grid gap-3 md:grid-cols-2">{scheduled.map(followUpCard)}</ul>}
            {past.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">Past</h4>
                <ul className="divide-y divide-slate-100 text-sm">
                  {past.map((f) => (
                    <li key={f._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-slate-700">
                      <span>
                        {formatDateTime(f.scheduledDate)} · {f.reason}
                      </span>
                      <Badge tone={f.status === 'completed' ? 'emerald' : 'slate'}>{labelize(f.status)}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>
    ),
    activity: (
      <Card>
        <SectionTitle title="Activity timeline" description="Exercises, vitals, notes and consultations, newest first" as="h3" />
        {timeline.isPending ? <PageLoader label="Loading activity…" /> : <ActivityTimeline items={timeline.data ?? []} />}
      </Card>
    ),
  };

  return (
    <div className="space-y-4">
      {backLink}

      {/* Stays visible while scrolling long tabs on larger screens. The page-coloured strip sits
          flush under the 61px app header so content never shows through above the card. */}
      <div className="z-20 bg-slate-50 lg:sticky lg:top-[61px] lg:-mt-3 lg:pt-3">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-100 text-lg font-extrabold text-teal-900">{initials(patient)}</div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{fullName(patient)}</h1>
                <SurgeryCountdown surgeryDate={profile?.surgeryDate} />
              </div>
              <p className="text-sm text-slate-700">
                {profile?.surgeryType || '—'} · {formatDate(profile?.surgeryDate)} · ID {profile?.hospitalNumber || '—'}
                {patient.phone && (
                  <>
                    {' · '}
                    <a href={`tel:${patient.phone}`} className="text-teal-800 underline">
                      {patient.phone}
                    </a>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setModal('prescribe')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Prescribe exercise
            </Button>
            <Button size="sm" variant="subtle" onClick={() => setModal('note')}>
              <FileText className="h-4 w-4 text-teal-800" aria-hidden="true" />
              Add clinical note
            </Button>
            <Button size="sm" variant="subtle" onClick={() => setModal('followup')}>
              <Calendar className="h-4 w-4 text-teal-800" aria-hidden="true" />
              Schedule follow-up
            </Button>
            <Button size="sm" variant="secondary" onClick={() => exportCsv.mutate()} loading={exportCsv.isPending} aria-label="Export vitals as CSV">
              <Download className="h-4 w-4 text-teal-700" aria-hidden="true" />
              CSV
            </Button>
          </div>
        </div>
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
          { id: 'exercises', label: 'Exercises', count: activeAssignments.length },
          { id: 'notes', label: 'Notes', count: notes.data?.length },
          { id: 'followups', label: 'Follow-ups', count: followUps.data ? scheduled.length : undefined },
          { id: 'activity', label: 'Activity' },
        ]}
      />

      <div role="tabpanel" id={panelId(tabsBase)} aria-labelledby={tabId(tabsBase, tab)} tabIndex={0} className="focus:outline-none">
        {panels[tab]}
      </div>

      {modal === 'prescribe' && <PrescribeExerciseModal patientId={patientId} onClose={() => setModal(null)} />}
      {modal === 'note' && <ClinicalNoteModal patientId={patientId} onClose={() => setModal(null)} />}
      {modal === 'followup' && <FollowUpModal patientId={patientId} onClose={() => setModal(null)} />}

      {pendingStatus && (
        <ConfirmDialog
          title="Cancel this follow-up?"
          message={`"${pendingStatus.followUp.reason}" on ${formatDateTime(pendingStatus.followUp.scheduledDate)} will be marked as cancelled.`}
          confirmLabel="Cancel follow-up"
          cancelLabel="Keep it"
          loading={updateStatus.isPending}
          onConfirm={() => updateStatus.mutate(pendingStatus)}
          onCancel={() => setPendingStatus(null)}
        />
      )}
    </div>
  );
};
