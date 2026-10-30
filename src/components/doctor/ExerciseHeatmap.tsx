import { useQuery } from '@tanstack/react-query';
import { completionService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { addDays, formatDate, fromDateKey, localDateKey } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Alert, PageLoader } from '../ui';

// The Exercise API's compliance range is at most 90 days
const DAYS = 90;

const cellTone = (d?: { planned: number; done: number }) =>
  !d || d.planned === 0 ? 'bg-slate-100' : d.done === 0 ? 'bg-rose-300' : d.done < d.planned ? 'bg-amber-300' : 'bg-emerald-600';

const LEGEND: [string, string][] = [
  ['bg-slate-100', 'Nothing planned'],
  ['bg-rose-300', 'None done'],
  ['bg-amber-300', 'Some done'],
  ['bg-emerald-600', 'All done'],
];

/** One square per day for the last 90 days, coloured by planned vs done. Weeks run left to right, Monday at the top. */
export const ExerciseHeatmap = ({ patientId }: { patientId: string }) => {
  const today = localDateKey();
  const from = addDays(today, -(DAYS - 1));
  const compliance = useQuery({
    queryKey: qk.patientPart(patientId, 'compliance', '90d'),
    queryFn: () => completionService.getCompliance(patientId, { from, to: today }),
  });

  if (compliance.isPending) return <PageLoader label="Loading activity…" />;
  if (compliance.isError) return <Alert tone="error">{errorMessage(compliance.error)}</Alert>;

  const byDate = new Map(compliance.data.byDay.map((d) => [d.date, d]));
  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));
  // Leading blanks so the first column starts on Monday
  const blanks = (fromDateKey(from).getDay() + 6) % 7;
  const { planned, done } = compliance.data;

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <div className="grid grid-rows-7 gap-1 pt-0 text-[10px] leading-3 text-slate-500" aria-hidden="true">
          {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => (
            <span key={i} className="h-3.5">
              {d}
            </span>
          ))}
        </div>
        <div
          role="img"
          aria-label={`Exercise activity, last ${DAYS} days: ${done} of ${planned} planned exercises done`}
          className="grid grid-flow-col grid-rows-7 gap-1"
        >
          {Array.from({ length: blanks }, (_, i) => (
            <span key={`blank-${i}`} className="h-3.5 w-3.5" />
          ))}
          {days.map((date) => {
            const d = byDate.get(date);
            return (
              <span
                key={date}
                title={`${formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}: ${d?.planned ? `${d.done} of ${d.planned} done` : 'nothing planned'}`}
                className={cn('h-3.5 w-3.5 rounded-sm', cellTone(d), date === today && 'ring-2 ring-teal-700 ring-offset-1')}
              />
            );
          })}
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {LEGEND.map(([tone, label]) => (
          <li key={label} className="flex items-center gap-1.5">
            <span className={cn('h-3 w-3 rounded-sm', tone)} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
};
