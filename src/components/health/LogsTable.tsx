import { formatDate, formatReading } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useVitalTypes, vitalName } from '../../lib/vitals';
import { ScrollX } from '../ui';
import type { DailyLog } from '../../types/api';

/** One row per day, one column per reading. */
export const LogsTable = ({ logs, emptyMessage = 'Nothing logged in this period.' }: { logs: DailyLog[]; emptyMessage?: string }) => {
  const types = useVitalTypes();
  const columns = (types.data ?? []).filter((t) => t.valueKind !== 'text');

  // Outside the table: centred across 13 wide columns it would sit off-screen on a phone
  if (logs.length === 0) return <p className="py-8 text-center text-sm text-slate-600">{t(emptyMessage)}</p>;

  return (
    <ScrollX>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-600">
            <th scope="col" className="pb-3 pr-4">{t('Day')}</th>
            {columns.map((c) => (
              <th key={c.type} scope="col" className="whitespace-nowrap pb-3 pr-4">
                {vitalName(c.type, c.label)}
                {c.unit && <span className="block font-normal normal-case">{c.unit}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {logs.map((log) => (
              <tr key={log.date}>
                <td className="whitespace-nowrap py-3 pr-4 text-slate-900">
                  {formatDate(log.date, { weekday: 'short', month: 'short', day: 'numeric' })}
                </td>
                {columns.map((c) => (
                  <td key={c.type} className="py-3 pr-4 font-semibold text-teal-900">
                    {formatReading(log.readings[c.type]?.value)}
                  </td>
                ))}
              </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  );
};
