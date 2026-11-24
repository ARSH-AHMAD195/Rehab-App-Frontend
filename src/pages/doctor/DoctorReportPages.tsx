import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { clinicalService, nutritionService, patientService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { formatResult } from '../../lib/investigations';
import { formatDate, formatDateTime } from '../../lib/format';
import { qk } from '../../lib/queryClient';
import { investigationReport, percentText, resultFlag, round1, weeklyNutrition } from '../../lib/reports';
import { Alert, Button, Card, EmptyState, ErrorState, PageLoader } from '../../components/ui';

const th = 'py-2 pr-3 font-bold';
const td = 'py-2 pr-3 align-top';

/** Patient, title and dates above a printable report. App chrome and the print button are hidden in print. */
const ReportShell = ({ patientId, title, period, children }: { patientId: string; title: string; period?: string; children: ReactNode }) => {
  // Same keys as the patient chart
  const patient = useQuery({ queryKey: qk.patient(patientId), queryFn: () => patientService.get(patientId) });
  const medical = useQuery({ queryKey: qk.patientPart(patientId, 'medical'), queryFn: () => patientService.getMedical(patientId) });
  const [generatedAt] = useState(() => new Date());
  const name = patient.data?.name;

  // The browser names a saved PDF after the page title
  useEffect(() => {
    if (!name) return;
    const before = document.title;
    document.title = `${title} - ${name}`;
    return () => {
      document.title = before;
    };
  }, [title, name]);

  if (patient.isPending) return <PageLoader label="Loading the report…" />;
  if (patient.isError) return <ErrorState error={patient.error} title="This report is unavailable" />;
  const m = medical.data;
  const surgery = [m?.plannedSurgery, m?.plannedSurgeryDate && `Surgery ${formatDate(m.plannedSurgeryDate)}`].filter(Boolean).join(' · ');

  return (
    <Card className="print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <header className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-teal-800">Fit for Surgery · {title}</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{patient.data.name}</h1>
          {surgery && <p className="text-sm text-slate-700">{surgery}</p>}
          <p className="mt-1 text-sm text-slate-600">{[period, `Generated ${formatDateTime(generatedAt)}`].filter(Boolean).join(' · ')}</p>
        </div>
        <Button onClick={() => window.print()} className="self-start print:hidden">
          <Printer className="h-4 w-4" aria-hidden="true" />
          Print / Save as PDF
        </Button>
      </header>
      {children}
    </Card>
  );
};

export const DoctorNutritionReportPage = () => {
  const { id: patientId = '' } = useParams();
  const history = useQuery({ queryKey: qk.patientPart(patientId, 'nutrition', 'history'), queryFn: () => nutritionService.getPatientHistory(patientId) });
  const report = history.data && weeklyNutrition(history.data);
  const newest = report?.rows[0];
  const oldest = report?.rows.at(-1);

  return (
    <ReportShell patientId={patientId} title="Weekly calorie report" period={newest && oldest && `${formatDate(oldest.date)} to ${formatDate(newest.date)}`}>
      {history.isPending ? (
        <PageLoader label="Loading the last 7 days…" />
      ) : history.isError ? (
        <Alert tone="error">The diet history could not be loaded: {errorMessage(history.error)}</Alert>
      ) : !report?.rows.length ? (
        <EmptyState>No days to show.</EmptyState>
      ) : (
        <>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-300 text-xs uppercase text-slate-600">
                <tr>
                  <th scope="col" className={th}>Date</th>
                  <th scope="col" className={th}>Calories eaten</th>
                  <th scope="col" className={th}>Target kcal</th>
                  <th scope="col" className={th}>% of target</th>
                  <th scope="col" className={th}>Protein eaten (g)</th>
                  <th scope="col" className={th}>Target protein (g)</th>
                  <th scope="col" className={th}>% of target</th>
                  <th scope="col" className={th}>Meals ticked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-900">
                {report.rows.map((d) => (
                  <tr key={d.date}>
                    <th scope="row" className={`${td} whitespace-nowrap font-semibold`}>
                      {formatDate(d.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </th>
                    {d.logged && d.totals ? (
                      <>
                        <td className={td}>{Math.round(d.totals.kcal)}</td>
                        <td className={td}>{d.targets?.kcal ?? '—'}</td>
                        <td className={td}>{percentText(d.percent?.kcal)}</td>
                        <td className={td}>{round1(d.totals.proteinG)}</td>
                        <td className={td}>{d.targets?.proteinG ?? '—'}</td>
                        <td className={td}>{percentText(d.percent?.protein)}</td>
                        <td className={td}>{d.totals.slotsEaten}</td>
                      </>
                    ) : (
                      <td colSpan={7} className={`${td} text-slate-500`}>
                        Not logged
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300 font-semibold text-slate-900">
                <tr>
                  <th scope="row" className={td}>
                    Average ({report.daysLogged} of {report.totalDays} days logged)
                  </th>
                  <td className={td}>{report.avgKcal ?? '—'}</td>
                  <td className={td} />
                  <td className={td} />
                  <td className={td}>{report.avgProteinG ?? '—'}</td>
                  <td className={td} colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Averages are over the days with something ticked only ({report.daysLogged} of {report.totalDays}); days not logged are left out, not counted as zero.
          </p>
        </>
      )}
    </ReportShell>
  );
};

export const DoctorInvestigationReportPage = () => {
  const { id: patientId = '' } = useParams();
  // Same keys as the investigations panel
  const tests = useQuery({ queryKey: ['investigationTests'], queryFn: clinicalService.getTests, staleTime: Infinity });
  const grid = useQuery({ queryKey: qk.patientPart(patientId, 'investigations'), queryFn: () => clinicalService.getInvestigations(patientId) });
  const groups = tests.data && grid.data && investigationReport(grid.data, tests.data);

  return (
    <ReportShell patientId={patientId} title="Investigation report">
      {tests.isError || grid.isError ? (
        <Alert tone="error">Investigations could not be loaded: {errorMessage(tests.error ?? grid.error)}</Alert>
      ) : !groups ? (
        <PageLoader label="Loading investigations…" />
      ) : groups.length === 0 ? (
        <EmptyState>No investigation results recorded.</EmptyState>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.group}>
              <h2 className="mb-2 text-lg font-bold text-slate-900">{g.title}</h2>
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-300 text-xs uppercase text-slate-600">
                    <tr>
                      <th scope="col" className={th}>Date taken</th>
                      <th scope="col" className={th}>Result</th>
                      <th scope="col" className={th}>Flag</th>
                      <th scope="col" className={th}>Comment</th>
                    </tr>
                  </thead>
                  {g.tests.map((t) => (
                    <tbody key={t.code} className="divide-y divide-slate-100 text-slate-900 print:break-inside-avoid">
                      <tr className="bg-slate-50">
                        <th scope="rowgroup" colSpan={4} className={`${td} pl-2 font-bold`}>
                          {t.label}
                          {t.units && <span className="font-normal text-slate-600"> ({t.units})</span>}
                        </th>
                      </tr>
                      {t.results.map((r) => (
                        <tr key={r.id}>
                          <td className={`${td} whitespace-nowrap`}>{formatDate(r.takenOn)}</td>
                          <td className={`${td} [overflow-wrap:anywhere]`}>{formatResult(t.test, r)}</td>
                          <td className={`${td} font-semibold`}>{resultFlag(t.test, r)}</td>
                          <td className={`${td} whitespace-pre-line [overflow-wrap:anywhere]`}>{r.comment}</td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </ReportShell>
  );
};
