import { formatReading } from '../../lib/format';
import { useVitalLabel } from '../../lib/vitals';
import type { ReadingValue, VitalAlert } from '../../types/api';

/** "Pain score 7 is above the limit of 6 · 2026-10-09" */
export const AlertSummary = ({ alert }: { alert: VitalAlert }) => {
  const vitalLabel = useVitalLabel();
  return (
    <>
      {vitalLabel(alert.type)}
      {alert.field && ` ${alert.field}`} {formatReading(alert.value as ReadingValue)} is {alert.rule === 'ABOVE_HIGH' ? 'above' : 'below'} the limit of {alert.threshold}
      {alert.currentValue && JSON.stringify(alert.currentValue) !== JSON.stringify(alert.value) && ` (now ${formatReading(alert.currentValue as ReadingValue)})`}
      <span className="text-slate-600"> · {alert.date}</span>
    </>
  );
};
