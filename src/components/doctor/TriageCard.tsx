import { useQuery } from '@tanstack/react-query';
import { clinicalService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { formatDate } from '../../lib/format';
import { Badge, Card, ErrorState, SectionTitle } from '../ui';
import type { Triage, TriageSummary, TriageTag } from '../../types/api';

const TAGS: Record<TriageTag, { label: string; tone: 'rose' | 'amber' | 'emerald' }> = {
  HIGH: { label: 'High', tone: 'rose' },
  MEDIUM: { label: 'Medium', tone: 'amber' },
  LOW: { label: 'Low', tone: 'emerald' },
};

/**
 * The API says LOW whenever nothing reached a cut-off, even with no values at all. LOW with values
 * missing is just "nothing known", so it isn't shown; HIGH and MEDIUM can only rise, so they always are.
 */
const hasTag = (triage: TriageSummary | null | undefined): triage is TriageSummary => Boolean(triage) && (triage!.complete || triage!.tag !== 'LOW');

/** The tag; worked out with missing values, it's marked incomplete (it could rise once they're in). */
export const TriageBadge = ({ triage }: { triage: TriageSummary | null | undefined }) =>
  !hasTag(triage) ? (
    <span className="text-slate-500">—</span>
  ) : (
  <span className="inline-flex flex-wrap items-center gap-1">
    <Badge tone={TAGS[triage.tag].tone}>{TAGS[triage.tag].label}</Badge>
    {!triage.complete && <Badge tone="slate">Incomplete</Badge>}
  </span>
  );

const Reasons = ({ title, items, className }: { title: string; items: Triage['reasons']; className: string }) =>
  items.length > 0 && (
    <div>
      <p className={`text-xs font-bold uppercase ${className}`}>{title}</p>
      <ul className="mt-1 list-inside list-disc text-sm text-slate-800">
        {items.map((r) => (
          <li key={r.parameter}>
            {r.explanation}
            {r.date && <span className="text-slate-600"> · {formatDate(r.date)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );

/** The tag and why. Errors show, so a failure never reads as "nothing flagged". */
export const TriageCard = ({ patientId }: { patientId: string }) => {
  const triage = useQuery({ queryKey: qk.patientPart(patientId, 'triage'), queryFn: () => clinicalService.getTriage(patientId) });
  if (triage.isError) {
    return (
      <div className="lg:col-span-3">
        <ErrorState error={triage.error} onRetry={() => void triage.refetch()} title="Triage couldn’t be loaded" />
      </div>
    );
  }
  if (!triage.data) return null;
  const { reasons, missing, provisional, evaluatedOn } = triage.data;

  return (
    <Card className="lg:col-span-3">
      <SectionTitle
        title="Triage"
        as="h3"
        description={`${provisional ? 'Draft rules, pending clinical sign-off. ' : ''}As of ${formatDate(evaluatedOn)}`}
        actions={hasTag(triage.data) ? <TriageBadge triage={triage.data} /> : <span className="text-sm text-slate-600">Not enough values yet</span>}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Reasons title="High" items={reasons.filter((r) => r.level === 'HIGH')} className="text-rose-800" />
        <Reasons title="Medium" items={reasons.filter((r) => r.level === 'MEDIUM')} className="text-amber-800" />
        {missing.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase text-slate-600">Not recorded yet</p>
            <ul className="mt-1 list-inside list-disc text-sm text-slate-800">
              {missing.map((m) => (
                <li key={m.parameter}>{m.needs.charAt(0).toUpperCase() + m.needs.slice(1)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
};
