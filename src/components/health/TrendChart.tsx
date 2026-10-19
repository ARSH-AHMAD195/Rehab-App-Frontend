import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Card } from '../ui';
import type { TrendKey, TrendRow } from '../../lib/trends';

const TOOLTIP_STYLE = { backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '13px' };
const AXIS_TICK = { fontSize: 12, fill: '#475569' };

export interface TrendSeries {
  key: TrendKey;
  name: string;
  color: string;
}

export const TrendChart = ({
  title,
  subtitle,
  badge,
  data,
  series,
  kind = 'line',
  domain,
  className,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  data: TrendRow[];
  series: TrendSeries[];
  kind?: 'line' | 'bar';
  domain?: [number, number];
  className?: string;
}) => {
  const hasData = data.some((row) => series.some((s) => row[s.key] !== undefined));
  const Chart = kind === 'bar' ? BarChart : LineChart;

  return (
    <Card className={className}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
        </div>
        {badge && <Badge tone="teal">{badge}</Badge>}
      </div>

      <div className="h-64 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <Chart data={data} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#94a3b8" tick={AXIS_TICK} />
              <YAxis domain={domain ?? ['auto', 'auto']} stroke="#94a3b8" tick={AXIS_TICK} width={40} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: '13px' }} />
              {series.map((s) =>
                kind === 'bar' ? (
                  <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} />
                ) : (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                )
              )}
            </Chart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-600">No readings in this period yet.</div>
        )}
      </div>
    </Card>
  );
};
