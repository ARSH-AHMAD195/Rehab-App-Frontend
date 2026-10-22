import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { adminService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { AUDIT_ACTIONS } from '../../lib/constants';
import { formatDateTime, labelize } from '../../lib/format';
import { Badge, Button, ErrorState, PageHeader, Select } from '../../components/ui';

const PAGE_SIZE = 20;

const formatDetails = (details: Record<string, unknown> = {}) =>
  Object.entries(details)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ') || '—';

export const AdminAuditLogsPage = () => {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const params = { page, limit: PAGE_SIZE, action };

  const result = useQuery({ queryKey: qk.auditLogs(params), queryFn: () => adminService.getAuditLogs(params), placeholderData: keepPreviousData });
  const logs = result.data?.logs ?? [];
  const totalPages = result.data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit trail"
        description="Sign-ins, patient record access and clinical actions"
        actions={
          <Select
            aria-label="Filter by action"
            className="w-auto"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        }
      />

      {result.isError && !result.data ? (
        <ErrorState error={result.error} onRetry={() => void result.refetch()} />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto" aria-busy={result.isFetching}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="p-4">Time</th>
                  <th scope="col" className="p-4">Action</th>
                  <th scope="col" className="p-4">Actor</th>
                  <th scope="col" className="p-4">Role</th>
                  <th scope="col" className="p-4">Resource</th>
                  <th scope="col" className="p-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.isPending ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-600">
                      Loading audit records…
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-600">
                      No audit records match this filter.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log._id} className="align-top hover:bg-slate-50">
                      <td className="whitespace-nowrap p-4 text-slate-700">
                        <time dateTime={log.timestamp}>{formatDateTime(log.timestamp)}</time>
                      </td>
                      <td className="p-4 font-semibold text-teal-900">{labelize(log.action.toLowerCase())}</td>
                      <td className="p-4 text-slate-800">{log.userEmail}</td>
                      <td className="p-4">
                        <Badge className="uppercase">{log.role}</Badge>
                      </td>
                      <td className="p-4 text-slate-700">{log.targetResource}</td>
                      <td className="max-w-xs break-words p-4 font-mono text-xs text-slate-700">{formatDetails(log.details)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 p-4 text-sm text-slate-700">
            <span>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({result.data?.total ?? 0} events)
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </Button>
              <Button variant="secondary" size="sm" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
