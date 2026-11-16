import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LoginCodeDialog } from '../../components/doctor/LoginCodeDialog';
import { loginCodeService } from '../../services/apiServices';
import { formatDateTime } from '../../lib/format';
import { qk } from '../../lib/queryClient';
import { Card, EmptyState, ErrorState, PageHeader, PageLoader } from '../../components/ui';

const requestedAgo = (iso: string) => {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ago`;
  return formatDateTime(iso);
};

export const DoctorLoginRequestsPage = () => {
  const requests = useQuery({ queryKey: qk.loginRequests, queryFn: loginCodeService.listRequests, refetchInterval: 30_000 });

  if (requests.isPending) return <PageLoader label="Loading sign-in requests…" />;
  if (requests.isError) return <ErrorState error={requests.error} onRetry={() => void requests.refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Login codes" description="Patients who asked for a sign-in code. Give each one a code and pass it on." />
      <Card>
        {requests.data.length === 0 ? (
          <EmptyState>No one is waiting for a code.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {requests.data.map((r) => (
              <li key={r.patient.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link to={`/doctor/patient/${r.patient.id}`} className="font-semibold text-teal-800 underline">
                    {r.patient.name}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {r.patient.phone} · requested <time dateTime={r.requestedAt}>{requestedAgo(r.requestedAt)}</time>
                  </p>
                </div>
                <LoginCodeDialog patientId={r.patient.id} patientName={r.patient.name} phone={r.patient.phone} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
