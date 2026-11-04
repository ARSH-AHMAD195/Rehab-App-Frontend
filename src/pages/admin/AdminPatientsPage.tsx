import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { doctorService, patientService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { useDebouncedValue } from '../../lib/hooks';
import { formatDate } from '../../lib/format';
import { Badge, Button, ErrorState, Input, PageHeader, ScrollX, Select } from '../../components/ui';

const PAGE_SIZE = 20;

/** Every patient and the doctors they're assigned to. `?doctor=<id>` narrows it to one doctor's patients. */
export const AdminPatientsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const doctorId = searchParams.get('doctor') ?? undefined;
  const [search, setSearch] = useState('');
  // Cursor paging: remember the cursors of earlier pages so Back works
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const debouncedSearch = useDebouncedValue(search.trim());
  // The API needs at least 2 characters to search
  const q = debouncedSearch.length >= 2 ? debouncedSearch : undefined;
  const params = { q, doctorId, active: 'all' as const, limit: PAGE_SIZE, cursor: cursors.at(-1) };

  const result = useQuery({ queryKey: qk.patients(params), queryFn: () => patientService.list(params), placeholderData: keepPreviousData });
  // ponytail: first 100 doctors only, same as the Doctors page; add cursor paging when the clinic has more
  const doctors = useQuery({ queryKey: qk.doctors, queryFn: () => doctorService.list({ active: 'all', limit: 100 }).then((r) => r.data) });
  const patients = result.data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="All patients"
        description="Every patient on the platform and the doctors they’re assigned to"
        actions={
          <>
            <Select
              aria-label="Filter by doctor"
              className="sm:w-56"
              value={doctorId ?? ''}
              onChange={(e) => {
                setSearchParams(e.target.value ? { doctor: e.target.value } : {});
                setCursors([undefined]);
              }}
            >
              <option value="">All doctors</option>
              {doctors.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.active ? '' : ' (deactivated)'}
                </option>
              ))}
            </Select>
            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" aria-hidden="true" />
              <Input
                type="search"
                aria-label="Search patients by name or email"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCursors([undefined]);
                }}
                placeholder="Search patients…"
                className="pl-9"
              />
            </div>
          </>
        }
      />

      {result.isError && !result.data ? (
        <ErrorState error={result.error} onRetry={() => void result.refetch()} />
      ) : (
        <div className="overflow-clip rounded-3xl border border-slate-200 bg-white shadow-sm">
          <ScrollX aria-busy={result.isFetching}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="p-4">Patient</th>
                  <th scope="col" className="p-4">Assigned doctors</th>
                  <th scope="col" className="p-4">Phone</th>
                  <th scope="col" className="p-4">Enrolled</th>
                  <th scope="col" className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.isPending ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-600">
                      Loading patients…
                    </td>
                  </tr>
                ) : patients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-600">
                      {q ? `No patients match “${q}”.` : doctorId ? 'No patients assigned to this doctor.' : 'No patients yet.'}
                    </td>
                  </tr>
                ) : (
                  patients.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-4">
                        <span className="block font-semibold text-slate-900">{p.name}</span>
                        <span className="text-slate-600">{p.email}</span>
                      </td>
                      <td className="p-4 text-slate-700">{p.doctors.length ? p.doctors.map((d) => d.name).join(', ') : <Badge tone="amber">Unassigned</Badge>}</td>
                      <td className="p-4 text-slate-700">{p.phone || '—'}</td>
                      <td className="whitespace-nowrap p-4 text-slate-700">{formatDate(p.createdAt)}</td>
                      <td className="p-4">
                        {!p.active ? <Badge tone="rose">Deactivated</Badge> : p.emailVerified ? <Badge tone="emerald">Active</Badge> : <Badge tone="amber">Invited</Badge>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </ScrollX>

          {(cursors.length > 1 || result.data?.nextCursor) && (
            <div className="flex items-center justify-between border-t border-slate-200 p-4 text-sm text-slate-700">
              <span>
                Page <strong>{cursors.length}</strong>
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" aria-label="Previous page" disabled={cursors.length <= 1} onClick={() => setCursors((c) => c.slice(0, -1))}>
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </Button>
                <Button variant="secondary" size="sm" aria-label="Next page" disabled={!result.data?.nextCursor} onClick={() => setCursors((c) => [...c, result.data!.nextCursor!])}>
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
