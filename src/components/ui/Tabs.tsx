import { useRef, type KeyboardEvent } from 'react';
import { cn } from '../../lib/cn';

export interface TabDef<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export const tabId = (base: string, id: string) => `${base}-tab-${id}`;
export const panelId = (base: string) => `${base}-panel`;

/**
 * WAI-ARIA tabs: arrow keys / Home / End move between tabs, only the selected tab is in the
 * tab order. Render one element with role="tabpanel" id={panelId(base)} for the content.
 */
export const Tabs = <T extends string>({
  base,
  label,
  tabs,
  value,
  onChange,
}: {
  base: string;
  label: string;
  tabs: TabDef<T>[];
  value: T;
  onChange: (id: T) => void;
}) => {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(tabs[next]!.id);
  };

  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t, i) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={tabId(base, t.id)}
            aria-selected={selected}
            aria-controls={panelId(base)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              '-mb-px flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600',
              selected ? 'border-teal-700 text-teal-900' : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn('rounded-full px-2 py-0.5 text-xs', selected ? 'bg-teal-100 text-teal-900' : 'bg-slate-100 text-slate-700')}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
};
