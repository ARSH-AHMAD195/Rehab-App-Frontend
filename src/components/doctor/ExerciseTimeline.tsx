import { useQuery } from '@tanstack/react-query';
import { completionService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { addDays, formatDate, localDateKey } from '../../lib/format';
import { Alert, Badge, PageLoader } from '../ui';
import { CompletionLine } from '../exercise/CompletionLine';
import type { Completion } from '../../types/api';

const DAYS = 14;

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** Day by day, newest first: planned vs done, and each exercise ticked off (or skipped, with the reason). */
export const ExerciseTimeline = ({ patientId }: { patientId: string }) => {
  const today = localDateKey();
  const range = { from: addDays(today, -(DAYS - 1)), to: today };
  const compliance = useQuery({ queryKey: qk.patientPart(patientId, 'compliance', '14d'), queryFn: () => completionService.getCompliance(patientId, range) });
  // ponytail: one page of 100 ticks covers 14 days of any realistic plan; page with nextCursor if plans get bigger
  const history = useQuery({ queryKey: qk.patientPart(patientId, 'history', '14d'), queryFn: () => completionService.getHistory(patientId, { ...range, limit: 100 }) });

  if (compliance.isPending || history.isPending) return <PageLoader label="Loading timeline…" />;
  if (compliance.isError || history.isError) return <Alert tone="error">{errorMessage(compliance.error ?? history.error)}</Alert>;

  const ticks = new Map<string, Completion[]>();
  for (const c of history.data.data) ticks.set(c.date, [...(ticks.get(c.date) ?? []), c]);
  const days = [...compliance.data.byDay].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5">
      {days.map((day) => {
        const done = (ticks.get(day.date) ?? []).sort((a, b) => a.completedAt.localeCompare(b.completedAt));
        const missed = day.date !== today && day.planned > day.done;
        return (
          <li key={day.date} className="relative">
            <span
              className={`absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full ring-4 ring-white ${day.planned === 0 ? 'bg-slate-300' : missed ? 'bg-rose-500' : day.done >= day.planned ? 'bg-emerald-600' : 'bg-amber-400'}`}
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-slate-900">
                {day.date === today ? 'Today' : formatDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              {day.planned > 0 ? (
                <>
                  <Badge tone={day.done >= day.planned ? 'emerald' : missed ? 'rose' : 'amber'}>
                    {day.done} of {day.planned} done
                  </Badge>
                  {day.skipped > 0 && <Badge tone="slate">{day.skipped} skipped</Badge>}
                </>
              ) : (
                <span className="text-xs text-slate-500">Nothing planned</span>
              )}
            </div>
            {done.length > 0 && (
              <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
                {done.map((c) => (
                  <li key={c.id}>
                    <CompletionLine completion={c} when={time(c.completedAt)} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
};
