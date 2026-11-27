import { useQuery } from '@tanstack/react-query';
import { clinicalService, profileService } from '../../services/apiServices';
import { formatDate } from '../../lib/format';
import { ADVICE_HISTORY } from '../../lib/features';
import { qk } from '../../lib/queryClient';
import { formatResult, GROUP_TITLES, testUnits } from '../../lib/investigations';
import { t, useLang } from '../../lib/i18n';
import { Card, ErrorState, PageHeader, PageLoader, SectionTitle } from '../../components/ui';
import { AdviceHistory } from '../../components/health/AdviceHistory';
import type { InvestigationGroup } from '../../types/api';

/**
 * The patient's test results, read-only. Deliberately no out-of-range flags, red colouring or per-result doctor comments:
 * the client hasn't decided whether patients see those (clinical decision). The doctor's general advice
 * (medical profile `patientAdvice`) is shown at the top.
 */
export const PatientTestResultsPage = () => {
  useLang();
  const tests = useQuery({ queryKey: qk.investigationTests, queryFn: clinicalService.getTests, staleTime: Infinity });
  const grid = useQuery({ queryKey: qk.myInvestigations, queryFn: clinicalService.getMyInvestigations });

  // Optional: a failed query just means no advice card
  const medical = useQuery({ queryKey: qk.myMedical, queryFn: profileService.getMyMedical });
  const advice = medical.data?.patientAdvice?.trim();
  const history = useQuery({ queryKey: qk.myAdviceHistory, queryFn: profileService.getMyAdviceHistory, enabled: ADVICE_HISTORY });
  // The newest past save is the current advice when it hasn't changed since: don't show it twice
  const pastItems = history.data?.items ?? [];
  const earlier = advice && pastItems[0]?.advice?.trim() === advice ? pastItems.slice(1) : pastItems;

  if (tests.isPending || grid.isPending) return <PageLoader label={t('Loading your test results…')} />;
  if (tests.isError || grid.isError) {
    return <ErrorState error={tests.error ?? grid.error} onRetry={() => void (tests.isError ? tests : grid).refetch()} />;
  }

  const byCode = new Map(tests.data.map((x) => [x.code, x]));
  const rows = grid.data.filter((row) => row.results.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t('Test results')} description={t('Your test results, newest first. Ask your care team what they mean.')} />
      {advice && (
        <Card>
          <SectionTitle title={t('Advice from your doctor')} as="h3" />
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800 [overflow-wrap:anywhere]">{advice}</p>
        </Card>
      )}
      {earlier.length > 0 && <AdviceHistory items={earlier} title={t('Earlier advice')} cleared={t('Cleared')} />}
      {rows.length === 0 && <p className="text-sm text-slate-600">{t('No test results yet. Your doctor adds them after your tests.')}</p>}
      {(Object.keys(GROUP_TITLES) as InvestigationGroup[]).map((group) => {
        const inGroup = rows.filter((row) => row.group === group);
        if (inGroup.length === 0) return null;
        return (
          <Card key={group}>
            <SectionTitle title={t(GROUP_TITLES[group])} as="h3" />
            <ul className="divide-y divide-slate-100">
              {inGroup.map((row) => {
                const test = byCode.get(row.test);
                const units = test && testUnits(test);
                return (
                  <li key={row.test} className="py-3">
                    <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                    <ul className="mt-1 space-y-0.5">
                      {[...row.results]
                        .sort((a, b) => b.takenOn.localeCompare(a.takenOn))
                        .map((r) => (
                          <li key={r.id} className="text-sm text-slate-800">
                            <span className="font-bold [overflow-wrap:anywhere]">{formatResult(test, r)}</span>
                            {units && <span className="text-slate-600"> {units}</span>}
                            <span className="text-slate-600"> · {formatDate(r.takenOn)}</span>
                          </li>
                        ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
};
