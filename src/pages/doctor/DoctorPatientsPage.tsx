import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronLeft, ChevronRight, Search, UserPlus } from 'lucide-react';
import { clinicalService, patientService } from '../../services/apiServices';
import { ApiError } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { useDebouncedValue } from '../../lib/hooks';
import { formatDate } from '../../lib/format';
import { cn } from '../../lib/cn';
import { useSignedInUser } from '../../context/AuthContext';
import { Badge, Button, ErrorState, Input, PageHeader, ScrollX, buttonClass } from '../../components/ui';
import { TriageBadge } from '../../components/doctor/TriageCard';
import type { PatientScope } from '../../types/api';

const PAGE_SIZE = 20;

const SCOPES: [PatientScope, string][] = [
  ['all', 'All patients'],
  ['mine', 'My patients'],
];

export const DoctorPatientsPage = () => {
  const me = useSignedInUser();
  const [scope, setScope] = useState<PatientScope>('all');
  const [search, setSearch] = useState('');
  // Cursor paging: remember the cursors of earlier pages so Back works
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const debouncedSearch = useDebouncedValue(search.trim());
  // The API needs at least 2 characters to search
  const q = debouncedSearch.length >= 2 ? debouncedSearch : undefined;
  const params = { scope, q, limit: PAGE_SIZE, cursor: cursors.at(-1) };

  const result = useQuery({ queryKey: qk.patients(params), queryFn: () => patientService.list(params), placeholderData: keepPreviousData });
  const patients = result.data?.data ?? [];
  // The whole caseload in one call: reading each medical profile would audit a chart view per row.
  // Heavy, and each fetch writes an audit record: don't refetch on every tab focus.
  const caseload = useQuery({ queryKey: [...qk.caseload, scope], queryFn: () => clinicalService.getCaseload(scope), staleTime: 5 * 60_000, refetchOnWindowFocus: false });
  // A 404 means the API doesn't offer the caseload yet: show '—' as for no entry
  const caseloadFailed = caseload.isError && !(caseload.error instanceof ApiError && caseload.error.status === 404);
  const clinical = new Map(caseload.data?.map((entry) => [entry.patient.id, entry]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patients"
        description={scope === 'mine' ? 'Patients whose alerts you get' : 'Everyone in the programme'}
        actions={
          <>
            <div className="flex gap-1.5" role="group" aria-label="Which patients to show">
              {SCOPES.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={scope === value}
                  onClick={() => {
                    setScope(value);
                    setCursors([undefined]);
                  }}
                  className={cn('min-h-11 rounded-xl px-3 text-sm font-semibold transition-colors', scope === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200')}
                >
                  {label}
                </button>
              ))}
            </div>
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
            <Link to="/doctor/onboard-patient" className={buttonClass('primary', 'md')}>
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Onboard new
            </Link>
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
                  <th scope="col" className="p-4">Triage</th>
                  <th scope="col" className="p-4">Surgery</th>
                  <th scope="col" className="p-4">Phone</th>
                  <th scope="col" className="p-4">Enrolled</th>
                  <th scope="col" className="p-4">Status</th>
                  <th scope="col" className="p-4 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.isPending ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-600">
                      Loading patients…
                    </td>
                  </tr>
                ) : patients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-600">
                      {q ? `No patients match “${q}”.` : scope === 'mine' ? 'No patients linked to you yet. Open a patient’s chart and choose “Add to my patients”.' : 'No patients enrolled yet.'}
                    </td>
                  </tr>
                ) : (
                  patients.map((p) => {
                    const c = clinical.get(p.id);
                    return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-4">
                        <span className="flex items-center gap-2 font-semibold text-slate-900">
                          {p.name}
                          {p.doctors.some((d) => d.id === me.id) && (
                            <Badge tone="teal">
                              Mine<span className="sr-only">: linked to you</span>
                            </Badge>
                          )}
                        </span>
                        <span className="text-slate-600">{p.email}</span>
                      </td>
                      <td className="p-4">
                        {c ? <TriageBadge tag={c.triage.tag} /> : caseloadFailed ? <span className="text-rose-700">Unavailable</span> : '—'}
                      </td>
                      <td className="whitespace-nowrap p-4 text-slate-700">{formatDate(c?.plannedSurgeryDate)}</td>
                      <td className="p-4 text-slate-700">{p.phone || '—'}</td>
                      <td className="whitespace-nowrap p-4 text-slate-700">{formatDate(p.createdAt)}</td>
                      <td className="p-4">
                        {p.active ? <Badge tone="emerald">Active</Badge> : <Badge tone="rose">Deactivated</Badge>}
                      </td>
                      <td className="p-4 text-right">
                        <Link to={`/doctor/patient/${p.id}`} className="inline-flex items-center gap-1 font-semibold text-teal-800 hover:underline">
                          Chart<span className="sr-only"> for {p.name}</span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                    );
                  })
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
