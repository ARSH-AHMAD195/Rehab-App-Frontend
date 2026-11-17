import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BellOff, CheckCircle2, ClipboardList } from 'lucide-react';
import { careAlertService } from '../../services/apiServices';
import { ApiError, errorMessage } from '../../services/api';
import { formatDateTime } from '../../lib/format';
import { Alert, Badge, Button, buttonClass, Card, PageLoader, SectionTitle } from '../ui';
import { useToast } from '../ui/toast';
import type { CareAlert, CareAlertKind } from '../../types/api';

const KINDS: Record<CareAlertKind, string> = {
  HIGH_VALUE: 'High value',
  WEIGHT_LOSS: 'Weight loss',
  MUST_RISE: 'MUST rise',
  NO_LOGGING: 'No logging',
  NUTRITION_LOW: 'Eating too little',
};

/**
 * Care-team alerts (investigations, weight, MUST, logging, nutrition), separate from vital alerts.
 * Without `patientId`: the inbox of open alerts for the doctor's own patients. With it: every alert for that patient.
 */
export const CareAlertsCard = ({ patientId }: { patientId?: string }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const params = { status: patientId ? ('ALL' as const) : ('OPEN' as const), patientId, limit: 50 };
  const alerts = useQuery({ queryKey: ['careAlerts', params], queryFn: () => careAlertService.list(params), refetchInterval: patientId ? undefined : 60_000 });

  const acknowledge = useMutation({
    mutationFn: (alert: CareAlert) => careAlertService.acknowledge(alert.id),
    onSuccess: (_res, alert) => toast.success(`Alert for ${alert.patient.name} acknowledged.`),
    onError: (err) =>
      err instanceof ApiError && err.code === 'ALERT_ALREADY_ACKNOWLEDGED'
        ? toast.success('Already handled by another doctor.')
        : toast.error(errorMessage(err, 'Could not acknowledge the alert.')),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['careAlerts'] }),
  });

  const list = alerts.data?.data ?? [];

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 text-amber-800">
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
        </div>
        <SectionTitle
          title={patientId ? 'Care-team alerts' : `Care-team alerts${alerts.data ? ` (${alerts.data.openCount})` : ''}`}
          as={patientId ? 'h3' : 'h2'}
          description="Investigation values, weight loss, MUST rise, no logging, low intake"
        />
      </div>

      {alerts.isPending ? (
        <PageLoader label="Checking care-team alerts…" />
      ) : alerts.isError ? (
        <Alert tone="error">Care-team alerts could not be loaded: {errorMessage(alerts.error)}</Alert>
      ) : list.length === 0 ? (
        <p className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
          <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          {patientId ? 'No care-team alerts for this patient.' : 'No open care-team alerts for your patients.'}
        </p>
      ) : (
        <ul className="max-h-[28rem] space-y-2.5 overflow-y-auto pr-1 text-sm">
          {list.map((a) => (
            <li key={a.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {!patientId && <span className="text-base font-bold text-slate-900">{a.patient.name}</span>}
                  <Badge tone={a.status === 'OPEN' ? 'amber' : 'slate'}>{KINDS[a.kind] ?? a.kind}</Badge>
                </div>
                <p className="mt-1 font-medium text-slate-800">{a.message}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {formatDateTime(a.createdAt)}
                  {a.status === 'ACKNOWLEDGED' && ` · Acknowledged ${formatDateTime(a.acknowledgedAt)}${a.note ? ` · ${a.note}` : ''}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2 self-end sm:self-auto">
                {a.status === 'OPEN' && (
                  <Button size="sm" variant="secondary" onClick={() => acknowledge.mutate(a)} loading={acknowledge.isPending && acknowledge.variables?.id === a.id}>
                    <BellOff className="h-4 w-4" aria-hidden="true" />
                    Acknowledge
                  </Button>
                )}
                {!patientId && (
                  <Link to={`/doctor/patient/${a.patient.id}?tab=alerts`} className={buttonClass('secondary', 'sm')}>
                    Chart<span className="sr-only"> for {a.patient.name}</span>
                    <ArrowRight className="h-4 w-4 text-teal-700" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
