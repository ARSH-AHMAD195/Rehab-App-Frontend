import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { healthService, reportService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { MEASUREMENT_TYPES } from '../../lib/constants';
import { downloadBlob } from '../../lib/download';
import { localDateKey } from '../../lib/format';
import { buildTrends } from '../../lib/trends';
import { Alert, Button, Card, PageHeader, SectionTitle, Select } from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import { MeasurementForm } from '../../components/health/MeasurementForm';
import { MeasurementTable } from '../../components/health/MeasurementTable';
import { TrendChart, type TrendSeries } from '../../components/health/TrendChart';

const PERIODS = [
  ['7', 'Last 7 days'],
  ['14', 'Last 14 days'],
  ['30', 'Last 30 days'],
  ['90', 'Last 90 days'],
] as const;

const CHARTS: { title: string; subtitle: string; badge?: string; kind?: 'bar'; domain?: [number, number]; series: TrendSeries[] }[] = [
  {
    title: 'Blood pressure',
    subtitle: 'Systolic & diastolic (mmHg)',
    badge: 'Target < 130/80',
    domain: [40, 180],
    series: [
      { key: 'systolic', name: 'Systolic', color: '#0f766e' },
      { key: 'diastolic', name: 'Diastolic', color: '#0369a1' },
    ],
  },
  {
    title: 'Oxygen & pulse',
    subtitle: 'SpO2 (%) & resting heart rate (bpm)',
    series: [
      { key: 'spo2', name: 'SpO2 (%)', color: '#047857' },
      { key: 'pulse', name: 'Pulse (bpm)', color: '#be123c' },
    ],
  },
  {
    title: 'Activity',
    subtitle: 'Daily steps & walking minutes',
    kind: 'bar',
    series: [
      { key: 'steps', name: 'Steps', color: '#0f766e' },
      { key: 'walking_minutes', name: 'Walking (min)', color: '#4338ca' },
    ],
  },
  {
    title: 'Sleep & pain',
    subtitle: 'Sleep (hours) & pain score (0–10)',
    domain: [0, 12],
    series: [
      { key: 'sleep_hours', name: 'Sleep (hrs)', color: '#6d28d9' },
      { key: 'pain', name: 'Pain (0–10)', color: '#b91c1c' },
    ],
  },
];

export const PatientHealthTrackerPage = () => {
  const toast = useToast();
  const [filterType, setFilterType] = useState('all');
  const [period, setPeriod] = useState('14');
  const days = Number(period);

  // One request feeds both the charts and the table (filtered client-side)
  const measurements = useQuery({
    queryKey: qk.myMeasurements({ days }),
    queryFn: () => healthService.getMyMeasurements({ days }).then((r) => r.measurements),
    placeholderData: (previous) => previous,
  });

  const trends = useMemo(() => buildTrends(measurements.data ?? []), [measurements.data]);
  const tableRows = useMemo(() => (measurements.data ?? []).filter((m) => filterType === 'all' || m.type === filterType), [measurements.data, filterType]);

  const exportCsv = useMutation({
    mutationFn: reportService.exportMyCsv,
    onSuccess: (blob) => downloadBlob(blob, `fit_for_surgery_vitals_${localDateKey()}.csv`),
    onError: (err) => toast.error(errorMessage(err, 'Could not export your measurements. Please try again.')),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Health tracker"
        description="Regular readings help your clinical team prepare you for surgery"
        actions={
          <Button variant="subtle" onClick={() => exportCsv.mutate()} loading={exportCsv.isPending}>
            <Download className="h-4 w-4 text-teal-800" aria-hidden="true" />
            Export (CSV)
          </Button>
        }
      />

      <Card>
        <SectionTitle title="Record a measurement" description="Values are checked and stored in your health record." />
        <MeasurementForm />
      </Card>

      <div className="flex items-center justify-end gap-2">
        <label htmlFor="period" className="text-sm font-semibold text-slate-800">
          Show
        </label>
        <Select id="period" className="w-auto" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIODS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {measurements.isError ? (
        <Alert tone="error">Your measurements could not be loaded: {errorMessage(measurements.error)}</Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2" aria-busy={measurements.isFetching}>
          {CHARTS.map((chart) => (
            <TrendChart key={chart.title} {...chart} data={trends} />
          ))}
        </div>
      )}

      <Card>
        <SectionTitle
          title="Measurement history"
          actions={
            <Select aria-label="Filter by measurement type" className="w-auto" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="all">All types</option>
              {MEASUREMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          }
        />
        <MeasurementTable measurements={tableRows} emptyMessage={measurements.isPending ? 'Loading…' : 'No measurements match these filters.'} />
      </Card>
    </div>
  );
};
