import { CheckCircle2, XCircle } from 'lucide-react';
import { t } from '../../lib/i18n';
import type { Completion } from '../../types/api';

/** One tick or skip: a green tick with minutes and note, or an amber cross with the skip reason. */
export const CompletionLine = ({ completion: c, when }: { completion: Completion; when: string }) => {
  const skipped = c.status === 'SKIPPED';
  const Icon = skipped ? XCircle : CheckCircle2;
  const detail = skipped
    ? ` · ${t('Skipped')}${c.reason ? `: “${t(c.reason)}”` : ''}`
    : `${c.details?.durationMin ? ` · ${c.details.durationMin} ${t('min')}` : ''}${c.details?.note ? ` · “${c.details.note}”` : ''}`;
  return (
    <span className="flex items-start gap-1.5">
      <Icon className={skipped ? 'mt-0.5 h-4 w-4 shrink-0 text-amber-700' : 'mt-0.5 h-4 w-4 shrink-0 text-emerald-700'} aria-hidden="true" />
      <span>
        <span className="text-slate-500">{when}</span> <span className="font-semibold text-slate-900">{c.exercise.name}</span>
        <span className={skipped ? 'text-amber-900' : 'text-slate-600'}>{detail}</span>
      </span>
    </span>
  );
};
