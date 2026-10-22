import { useState } from 'react';
import { formatDateTime } from '../../lib/format';
import { cn } from '../../lib/cn';
import { Button, EmptyState } from '../ui';
import type { TimelineItem } from '../../types/api';

const DOT_COLORS: Record<TimelineItem['type'], string> = {
  exercise: 'bg-teal-700',
  measurement: 'bg-indigo-700',
  clinical_note: 'bg-amber-700',
  follow_up: 'bg-emerald-700',
  prescription: 'bg-purple-700',
};

const PAGE = 15;

/** Newest first; shows PAGE events at a time so long histories don't swamp the page. */
export const ActivityTimeline = ({ items }: { items: TimelineItem[] }) => {
  const [visible, setVisible] = useState(PAGE);

  if (items.length === 0) return <EmptyState>No activity recorded yet.</EmptyState>;

  return (
    <>
      <ol className="relative space-y-4 pl-6 before:absolute before:bottom-3 before:left-2.5 before:top-3 before:w-0.5 before:bg-slate-200">
        {items.slice(0, visible).map((item) => (
          <li key={item.id} className="relative">
            <span aria-hidden="true" className={cn('absolute -left-6 top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white', DOT_COLORS[item.type] ?? 'bg-slate-600')}>
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="mb-1 flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{item.title}</span>
                  {item.badge && <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-800">{item.badge}</span>}
                </div>
                <time dateTime={item.timestamp} className="text-xs text-slate-600">
                  {formatDateTime(item.timestamp)}
                </time>
              </div>
              <p className="text-sm leading-relaxed text-slate-700">{item.description}</p>
            </div>
          </li>
        ))}
      </ol>
      {visible < items.length && (
        <div className="mt-4 text-center">
          <Button variant="secondary" size="sm" onClick={() => setVisible((v) => v + PAGE)}>
            Show more ({items.length - visible} older)
          </Button>
        </div>
      )}
    </>
  );
};
