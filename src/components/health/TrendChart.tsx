import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Card } from '../ui';

const TOOLTIP_STYLE = { backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '13px' };
const AXIS_TICK = { fontSize: 12, fill: '#475569' };

export type TrendRow = { label: string } & Record<string, number | null | string>;

export interface TrendSeries {
  key: string;
  name: string;
  color: string;
}

export const TrendChart = ({
  title,
  subtitle,
  badge,
  actions,
  data,
  series,
  kind = 'line',
  limits = [],
  className,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
  data: TrendRow[];
  series: TrendSeries[];
  kind?: 'line' | 'bar';
  /** Alert thresholds, drawn as dashed lines. */
  limits?: { value: number; label: string }[];
  className?: string;
}) => {
  const hasData = data.some((row) => series.some((s) => typeof row[s.key] === 'number'));
  const Chart = kind === 'bar' ? BarChart : LineChart;

  return (
    <Card className={className}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
        </div>
        {badge && <Badge tone="teal">{badge}</Badge>}
        {actions}
      </div>

      <div className="h-64 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <Chart data={data} accessibilityLayer>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#94a3b8" tick={AXIS_TICK} />
              <YAxis domain={['auto', 'auto']} stroke="#94a3b8" tick={AXIS_TICK} width={44} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: '13px' }} />
              {limits.map((l) => (
                <ReferenceLine key={l.label} y={l.value} stroke="#b91c1c" strokeDasharray="4 4" label={{ value: l.label, fontSize: 11, fill: '#b91c1c', position: 'insideTopRight' }} />
              ))}
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
