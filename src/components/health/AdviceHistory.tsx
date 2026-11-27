import { Card, SectionTitle } from '../ui';
import { formatDateTime } from '../../lib/format';
import type { AdviceHistoryItem } from '../../types/api';

/** Past saves of the doctor's advice, in the order given (newest first). The caller picks the items and the copy. */
export const AdviceHistory = ({ items, title, cleared }: { items: AdviceHistoryItem[]; title: string; cleared: string }) => (
  <Card>
    <SectionTitle title={title} as="h3" />
    <ul className="divide-y divide-slate-100">
      {items.map((item, i) => {
        const text = item.advice?.trim() ?? '';
        return (
          <li key={`${item.at}-${i}`} className="py-3">
            <p className="text-xs text-slate-600">
              {formatDateTime(item.at)}
              {item.by && ` · ${item.by.name}`}
            </p>
            {text ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800 [overflow-wrap:anywhere]">{text}</p>
            ) : (
              <p className="text-sm italic text-slate-600">{cleared}</p>
            )}
          </li>
        );
      })}
    </ul>
  </Card>
);
