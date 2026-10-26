import { useQuery } from '@tanstack/react-query';
import { vitalsService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { Alert, Card, PageHeader, SectionTitle } from '../../components/ui';
import { VitalsForm } from '../../components/health/VitalsForm';
import { VitalTrend } from '../../components/health/VitalTrend';
import { LogsTable } from '../../components/health/LogsTable';

export const PatientHealthTrackerPage = () => {
  // Last 30 days, newest first (the API's default range)
  const logs = useQuery({ queryKey: qk.myLogs, queryFn: () => vitalsService.getLogs({ limit: 30 }) });

  return (
    <div className="space-y-6">
      <PageHeader title="Health tracker" description="Log today’s readings once a day. Your care team reviews them." />

      <Card>
        <SectionTitle title="Today’s readings" description="Values are checked and stored in your health record." />
        <VitalsForm />
      </Card>

      <VitalTrend queryKeyBase={['my', 'vitals']} load={vitalsService.getTrend} />

      <Card>
        <SectionTitle title="Past 30 days" />
        {logs.isError ? (
          <Alert tone="error">Your history could not be loaded: {errorMessage(logs.error)}</Alert>
        ) : (
          <LogsTable logs={logs.data?.data ?? []} emptyMessage={logs.isPending ? 'Loading…' : 'Nothing logged in the last 30 days.'} />
        )}
      </Card>
    </div>
  );
};
