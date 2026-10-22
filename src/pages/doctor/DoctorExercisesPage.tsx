import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Play, Search } from 'lucide-react';
import { exerciseService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { useDebouncedValue } from '../../lib/hooks';
import { EXERCISE_CATEGORIES } from '../../lib/constants';
import { labelize } from '../../lib/format';
import { Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, PageLoader, Select } from '../../components/ui';
import { ExerciseDetailModal } from '../../components/exercise/ExerciseDetailModal';
import type { Exercise } from '../../types/api';

export const DoctorExercisesPage = () => {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Exercise | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());
  const params = { category, search: debouncedSearch };

  const library = useQuery({
    queryKey: qk.library(params),
    queryFn: () => exerciseService.getLibrary(params).then((r) => r.exercises),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exercise catalog"
        description="Approved physical, aerobic and breathing prehabilitation exercises"
        actions={
          <>
            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" aria-hidden="true" />
              <Input type="search" aria-label="Search exercises" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exercises…" className="pl-9" />
            </div>
            <Select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto">
              <option value="all">All categories</option>
              {EXERCISE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {labelize(c)}
                </option>
              ))}
            </Select>
          </>
        }
      />

      {library.isError && !library.data ? (
        <ErrorState error={library.error} onRetry={() => void library.refetch()} />
      ) : library.isPending ? (
        <PageLoader label="Loading exercise catalog…" />
      ) : library.data.length === 0 ? (
        <Card>
          <EmptyState>No exercises match these filters.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-busy={library.isFetching}>
          {library.data.map((ex) => (
            <article key={ex._id} className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Badge tone="teal">{labelize(ex.category)}</Badge>
                  <span className="text-sm text-slate-600">{ex.defaultDurationMinutes} min</span>
                </div>
                <h2 className="text-lg font-bold leading-snug text-slate-900">{ex.title}</h2>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-700">{ex.description}</p>
                <dl className="mt-4 flex justify-between rounded-2xl bg-slate-50 p-3 text-center">
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-600">Sets</dt>
                    <dd className="font-bold text-slate-900">{ex.defaultSets}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-600">Reps</dt>
                    <dd className="font-bold text-slate-900">{ex.defaultReps}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-600">Frequency</dt>
                    <dd className="text-sm font-bold text-slate-900">{ex.defaultFrequency}</dd>
                  </div>
                </dl>
              </div>
              <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => setSelected(ex)}>
                <Play className="h-4 w-4 text-teal-700" aria-hidden="true" />
                View steps & video
              </Button>
            </article>
          ))}
        </div>
      )}

      {selected && <ExerciseDetailModal exercise={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};
