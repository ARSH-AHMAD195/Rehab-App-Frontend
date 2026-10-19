import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronLeft, ChevronRight, Search, UserPlus } from 'lucide-react';
import { patientService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { useDebouncedValue } from '../../lib/hooks';
import { formatDate, fullName } from '../../lib/format';
import { Button, ErrorState, Input, PageHeader, buttonClass } from '../../components/ui';
import { SurgeryCountdown } from '../../components/doctor/SurgeryCountdown';

const PAGE_SIZE = 20;

export const DoctorPatientsPage = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());
  const params = { search: debouncedSearch, page, limit: PAGE_SIZE };

  const result = useQuery({ queryKey: qk.patients(params), queryFn: () => patientService.getPatients(params), placeholderData: keepPreviousData });

  const patients = result.data?.patients ?? [];
  const totalPages = result.data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your patients"
        description="Prehabilitation patients under your clinical supervision"
        actions={
          <>
            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" aria-hidden="true" />
              <Input
                type="search"
                aria-label="Search patients by name or email"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
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
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto" aria-busy={result.isFetching}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="p-4">Patient</th>
                  <th scope="col" className="p-4">Hospital ID</th>
                  <th scope="col" className="p-4">Procedure</th>
                  <th scope="col" className="p-4">Surgery date</th>
                  <th scope="col" className="p-4">Status</th>
                  <th scope="col" className="p-4 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.isPending ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-600">
                      Loading patients…
                    </td>
                  </tr>
                ) : patients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-600">
                      {debouncedSearch ? `No patients match “${debouncedSearch}”.` : 'No patients assigned yet.'}
                    </td>
                  </tr>
                ) : (
                  patients.map(({ user: p, profile }) => (
                    <tr key={p._id} className="hover:bg-slate-50">
                      <td className="p-4">
                        <span className="block font-semibold text-slate-900">{fullName(p)}</span>
                        <span className="text-slate-600">{p.email}</span>
                      </td>
                      <td className="p-4 text-slate-700">{profile?.hospitalNumber || '—'}</td>
                      <td className="p-4 font-medium text-teal-900">{profile?.surgeryType || '—'}</td>
                      <td className="whitespace-nowrap p-4 text-slate-700">{formatDate(profile?.surgeryDate)}</td>
                      <td className="p-4">
                        <SurgeryCountdown surgeryDate={profile?.surgeryDate} />
                      </td>
                      <td className="p-4 text-right">
                        <Link to={`/doctor/patient/${p._id}`} className="inline-flex items-center gap-1 font-semibold text-teal-800 hover:underline">
                          Chart<span className="sr-only"> for {fullName(p)}</span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 p-4 text-sm text-slate-700">
              <span>
                Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({result.data?.total} patients)
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
          )}
        </div>
      )}
    </div>
  );
};
