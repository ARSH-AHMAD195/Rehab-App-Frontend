import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Undo2, XCircle } from 'lucide-react';
import { completionService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { Button } from '../ui';
import { useToast } from '../ui/toast';
import { CompleteExerciseModal } from './CompleteExerciseModal';
import { SkipExerciseModal } from './SkipExerciseModal';
import { DonePill, ExerciseCard } from './ExerciseCard';
import type { ChecklistItem } from '../../types/api';

/** An exercise planned for today, with its actions: mark done, undo, or "I couldn't do this today". */
export const TodayExerciseCard = ({
  item,
  date,
  skipped,
  onSkip,
  onUnskip,
  status,
}: {
  item: ChecklistItem;
  date: string;
  /** The reason, when the patient skipped it today */
  skipped?: string;
  onSkip: (reason: string) => void;
  onUnskip: () => void;
  /** Overrides the top-right label, e.g. the plan's days on My exercises */
  status?: React.ReactNode;
}) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<'complete' | 'skip' | null>(null);
  const done = item.status === 'DONE';
  const lastTick = item.completions.at(-1);

  const undo = useMutation({
    mutationFn: completionService.undo,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['my'] }),
    onError: (err) => toast.error(errorMessage(err, 'Could not undo. Please try again.')),
  });

  const undoButton = (label: string) =>
    lastTick && (
      <Button variant="ghost" size="sm" className="w-full" onClick={() => undo.mutate(lastTick.id)} loading={undo.isPending}>
        <Undo2 className="h-4 w-4" aria-hidden="true" />
        {label}
        <span className="sr-only"> for {item.exercise.name}</span>
      </Button>
    );

  const timesLabel =
    item.timesPerDay > 1 ? (
      <span className="shrink-0 text-sm font-semibold text-slate-600">
        {item.doneCount} of {item.timesPerDay} times
      </span>
    ) : undefined;

  return (
    <ExerciseCard exercise={item.exercise} target={item.target} notes={item.notes} status={done ? <DonePill /> : (status ?? timesLabel)}>
      {skipped && !done ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          <span className="flex items-center gap-1.5 font-semibold">
            <XCircle className="h-4 w-4 text-amber-700" aria-hidden="true" />
            Skipped today · {skipped}
          </span>
          <button type="button" onClick={onUnskip} className="font-semibold text-teal-800 underline">
            Undo<span className="sr-only"> skip for {item.exercise.name}</span>
          </button>
        </div>
      ) : done ? (
        undoButton('Undo')
      ) : (
        <div className="space-y-1">
          {status && timesLabel && <p className="text-center text-sm font-semibold text-slate-600">{timesLabel}</p>}
          <Button size="lg" className="w-full" onClick={() => setModal('complete')}>
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            Mark as done<span className="sr-only">: {item.exercise.name}</span>
          </Button>
          {undoButton('Undo last tick')}
          <button
            type="button"
            onClick={() => setModal('skip')}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 text-sm font-bold text-teal-900 hover:underline"
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
            I couldn’t do this today
          </button>
        </div>
      )}

      {modal === 'complete' && <CompleteExerciseModal item={item} date={date} onClose={() => setModal(null)} />}
      {modal === 'skip' && <SkipExerciseModal name={item.exercise.name} onSkip={onSkip} onClose={() => setModal(null)} />}
    </ExerciseCard>
  );
};
