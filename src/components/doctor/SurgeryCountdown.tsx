import { daysUntil } from '../../lib/format';
import { Badge } from '../ui';

/** "18 days to surgery", amber inside two weeks, "Surgery date passed" afterwards. */
export const SurgeryCountdown = ({ surgeryDate }: { surgeryDate: string | null | undefined }) => {
  const days = daysUntil(surgeryDate);
  if (days === null) return <Badge>No surgery date</Badge>;
  if (days < 0) return <Badge>Surgery date passed</Badge>;
  if (days === 0) return <Badge tone="rose">Surgery today</Badge>;
  return (
    <Badge tone={days <= 14 ? 'amber' : 'teal'}>
      {days} {days === 1 ? 'day' : 'days'} to surgery
    </Badge>
  );
};
