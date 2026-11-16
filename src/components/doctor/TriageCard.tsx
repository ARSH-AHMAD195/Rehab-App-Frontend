import { useQuery } from '@tanstack/react-query';
import { clinicalService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { ApiError } from '../../services/api';
import { Badge, Card, ErrorState, SectionTitle } from '../ui';
import type { TriageTag } from '../../types/api';

const TAGS: Record<TriageTag, { label: string; tone: 'rose' | 'amber' | 'emerald' | 'slate' }> = {
  HIGH: { label: 'High', tone: 'rose' },
  MEDIUM: { label: 'Medium', tone: 'amber' },
  LOW: { label: 'Low', tone: 'emerald' },
  INCOMPLETE: { label: 'Incomplete', tone: 'slate' },
};

export const TriageBadge = ({ tag }: { tag: TriageTag }) => <Badge tone={TAGS[tag].tone}>{TAGS[tag].label}</Badge>;

const Reasons = ({ title, items, className }: { title: string; items: string[]; className: string }) =>
  items.length > 0 && (
    <div>
      <p className={`text-xs font-bold uppercase ${className}`}>{title}</p>
      <ul className="mt-1 list-inside list-disc text-sm text-slate-800">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );

/** The tag and why. Stays hidden while loading and on a 404 (API doesn't offer triage yet); other errors show, so a failure never reads as "nothing flagged". */
export const TriageCard = ({ patientId }: { patientId: string }) => {
  const triage = useQuery({ queryKey: qk.patientPart(patientId, 'triage'), queryFn: () => clinicalService.getTriage(patientId) });
  if (triage.isError && !(triage.error instanceof ApiError && triage.error.status === 404)) {
    return (
      <div className="lg:col-span-3">
        <ErrorState error={triage.error} onRetry={() => void triage.refetch()} title="Triage couldn’t be loaded" />
      </div>
    );
  }
  if (!triage.data) return null;
  const { tag, high, medium, missing, flags } = triage.data;

  return (
    <Card className="lg:col-span-3">
      <SectionTitle title="Triage" as="h3" description="Draft rules, pending clinical sign-off" actions={<TriageBadge tag={tag} />} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Reasons title="Alerts" items={flags.map((f) => f.detail)} className="text-rose-800" />
        <Reasons title="High" items={high} className="text-rose-800" />
        <Reasons title="Medium" items={medium} className="text-amber-800" />
        <Reasons title="Not recorded yet" items={missing} className="text-slate-600" />
      </div>
    </Card>
  );
};
