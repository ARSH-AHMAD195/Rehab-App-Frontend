import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { errorMessage } from '../../services/api';
import { TREND_PERIODS } from '../../lib/constants';
import { useVitalTypes } from '../../lib/vitals';
import { formatDate } from '../../lib/format';
import { Alert, Select } from '../ui';
import { TrendChart, type TrendRow } from './TrendChart';
import type { ThresholdPair, Trend, TrendPeriod, VitalType } from '../../types/api';

const COLORS = ['#0f766e', '#0369a1'];

/** The API's `{ labels, values }` (or BP's systolic/diastolic) as chart rows, plus its alert limits. */
const trendToChart = (trend: Trend) => {
  const keys = trend.type === 'BP' ? (['systolic', 'diastolic'] as const) : (['values'] as const);
  const rows: TrendRow[] = trend.labels.map((date, i) => ({
    label: formatDate(date, { month: 'short', day: 'numeric' }),
    ...Object.fromEntries(keys.map((k) => [k, trend[k]?.[i] ?? null])),
  }));
  const pairs: [string, ThresholdPair | null | undefined][] =
    trend.type === 'BP' ? Object.entries((trend.thresholds ?? {}) as Record<string, ThresholdPair | null>) : [['', trend.thresholds as ThresholdPair | null]];
  const limits = pairs.flatMap(([field, t]) => [
    ...(t?.high != null ? [{ value: t.high, label: `${field} high`.trim() }] : []),
    ...(t?.low != null ? [{ value: t.low, label: `${field} low`.trim() }] : []),
  ]);
  return { rows, keys, limits };
};

/** One vital over time, with pickers for which vital and how far back. */
export const VitalTrend = ({ queryKeyBase, load }: { queryKeyBase: readonly string[]; load: (type: VitalType, period: TrendPeriod) => Promise<Trend> }) => {
  const [type, setType] = useState<VitalType>('BP');
  const [period, setPeriod] = useState<TrendPeriod>('30d');

  const types = useVitalTypes();
  const trend = useQuery({ queryKey: [...queryKeyBase, 'trend', type, period], queryFn: () => load(type, period), placeholderData: keepPreviousData });

  const def = types.data?.find((t) => t.type === type);
  const chart = trend.data ? trendToChart(trend.data) : null;

  const pickers = (
    <div className="flex flex-wrap gap-2">
      <Select aria-label="Reading" className="w-auto" value={type} onChange={(e) => setType(e.target.value as VitalType)}>
        {(types.data ?? []).filter((t) => t.valueKind !== 'text').map((t) => (
          <option key={t.type} value={t.type}>
            {t.label}
          </option>
        ))}
      </Select>
      <Select aria-label="Period" className="w-auto" value={period} onChange={(e) => setPeriod(e.target.value as TrendPeriod)}>
        {TREND_PERIODS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
    </div>
  );

  if (trend.isError) return <Alert tone="error">The chart could not be loaded: {errorMessage(trend.error)}</Alert>;

  return (
    <TrendChart
      title={def?.label ?? 'Trend'}
      subtitle={trend.data?.unit ? `One value per day (${trend.data.unit})` : 'One value per day'}
      actions={pickers}
      data={chart?.rows ?? []}
      series={(chart?.keys ?? []).map((k, i) => ({ key: k, name: k === 'values' ? (def?.label ?? type) : k[0]!.toUpperCase() + k.slice(1), color: COLORS[i]! }))}
      limits={chart?.limits}
    />
  );
};
