import { useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Play } from 'lucide-react';
import { labelize } from '../../lib/format';
import { Badge, Button } from '../ui';
import { ExerciseDetailModal } from './ExerciseDetailModal';
import type { PlanExercise, Target } from '../../types/api';

const DEFAULT_SAFETY = 'Stop and rest if you feel dizzy, breathless or have chest pain.';

const Tile = ({ value, label }: { value: number; label: string }) => (
  <div className="flex-1 rounded-xl border border-teal-700/40 bg-teal-50 px-2 py-2.5 text-center">
    <p className="text-2xl font-extrabold leading-none text-teal-950">{value}</p>
    <p className="mt-1 text-xs font-bold uppercase tracking-wide text-teal-900">{label}</p>
  </div>
);

/** One planned exercise: what to do, how much, the safety note, and (on the Today tab) the actions. */
export const ExerciseCard = ({
  exercise,
  target,
  notes,
  status,
  children,
}: {
  exercise: PlanExercise;
  target: Target | null;
  notes: string | null;
  /** Shown beside the title, e.g. "1 of 2 times" or a Done pill */
  status?: ReactNode;
  /** The actions, Today tab only */
  children?: ReactNode;
}) => {
  const [showDetail, setShowDetail] = useState(false);
  const tiles: [number, string][] = [];
  if (target?.sets) tiles.push([target.sets, 'Sets']);
  if (target?.reps) tiles.push([target.reps, 'Reps']);
  if (target?.durationMin) tiles.push([target.durationMin, 'Mins']);

  return (
    <article className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Badge tone="teal">{labelize(exercise.category)}</Badge>
          <h3 className="mt-2 text-lg font-bold leading-snug text-slate-900">{exercise.name}</h3>
        </div>
        {status}
      </div>

      <Button variant="secondary" className="w-full" onClick={() => setShowDetail(true)}>
        <Play className="h-4 w-4 text-teal-700" aria-hidden="true" />
        Instructions & Video
      </Button>

      {tiles.length > 0 && (
        <div className="flex gap-2">
          {tiles.map(([value, label]) => (
            <Tile key={label} value={value} label={label} />
          ))}
        </div>
      )}

      <p className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm font-medium text-rose-950">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />
        <span>{notes || DEFAULT_SAFETY}</span>
      </p>

      {children}

      {showDetail && <ExerciseDetailModal exercise={exercise} notes={notes} onClose={() => setShowDetail(false)} />}
    </article>
  );
};

export const DonePill = () => (
  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-900">
    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
    Done
  </span>
);
