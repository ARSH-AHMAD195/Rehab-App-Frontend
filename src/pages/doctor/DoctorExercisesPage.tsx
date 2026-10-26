import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Play, Search } from 'lucide-react';
import { exerciseService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { useDebouncedValue } from '../../lib/hooks';
import { labelize } from '../../lib/format';
import { Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, PageLoader, Select } from '../../components/ui';
import { ExerciseDetailModal } from '../../components/exercise/ExerciseDetailModal';
import type { Exercise } from '../../types/api';

export const DoctorExercisesPage = () => {
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Exercise | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim());
  const params = { category: category || undefined, q: debouncedSearch || undefined, limit: 100 };

  const categories = useQuery({ queryKey: qk.categories(), queryFn: () => exerciseService.getCategories() });
  const library = useQuery({ queryKey: qk.library(params), queryFn: () => exerciseService.list(params).then((r) => r.data), placeholderData: keepPreviousData });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exercise catalog"
        description="The clinic’s exercise library, to choose from when assigning a plan"
        actions={
          <>
            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" aria-hidden="true" />
              <Input type="search" aria-label="Search exercises" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search exercises…" className="pl-9" />
            </div>
            <Select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto">
              <option value="">All categories</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.code}>
                  {c.name}
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
          <EmptyState>{params.q || params.category ? 'No exercises match these filters.' : 'The library is empty. An admin needs to add exercises.'}</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-busy={library.isFetching}>
          {library.data.map((ex) => (
            <article key={ex.id} className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Badge tone="teal">{labelize(ex.category)}</Badge>
                  {!ex.video && <span className="text-xs text-slate-600">No video yet</span>}
                </div>
                <h2 className="text-lg font-bold leading-snug text-slate-900">{ex.name}</h2>
                {ex.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-700">{ex.description}</p>}
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
