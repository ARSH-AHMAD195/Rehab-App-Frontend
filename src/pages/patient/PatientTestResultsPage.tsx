import { useQuery } from '@tanstack/react-query';
import { clinicalService } from '../../services/apiServices';
import { formatDate } from '../../lib/format';
import { formatResult, GROUP_TITLES, testUnits } from '../../lib/investigations';
import { t, useLang } from '../../lib/i18n';
import { Card, ErrorState, PageHeader, PageLoader, SectionTitle } from '../../components/ui';
import type { InvestigationGroup } from '../../types/api';

/**
 * The patient's test results, read-only. Deliberately no out-of-range flags, red colouring or doctor comments:
 * the client hasn't decided whether patients see those (clinical decision).
 */
export const PatientTestResultsPage = () => {
  useLang();
  const tests = useQuery({ queryKey: ['investigationTests'], queryFn: clinicalService.getTests, staleTime: Infinity });
  const grid = useQuery({ queryKey: ['myInvestigations'], queryFn: clinicalService.getMyInvestigations });

  if (tests.isPending || grid.isPending) return <PageLoader label={t('Loading your test results…')} />;
  if (tests.isError || grid.isError) {
    return <ErrorState error={tests.error ?? grid.error} onRetry={() => void (tests.isError ? tests : grid).refetch()} />;
  }

  const byCode = new Map(tests.data.map((x) => [x.code, x]));
  const rows = grid.data.filter((row) => row.results.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t('Test results')} description={t('Your test results, newest first. Ask your care team what they mean.')} />
      {rows.length === 0 && <p className="text-sm text-slate-600">{t('No test results yet. Your doctor adds them after your tests.')}</p>}
      {(Object.keys(GROUP_TITLES) as InvestigationGroup[]).map((group) => {
        const inGroup = rows.filter((row) => row.group === group);
        if (inGroup.length === 0) return null;
        return (
          <Card key={group}>
            <SectionTitle title={GROUP_TITLES[group]} as="h3" />
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
