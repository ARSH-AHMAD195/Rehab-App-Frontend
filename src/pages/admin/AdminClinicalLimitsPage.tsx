import { useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { adminService, clinicalService } from '../../services/apiServices';
import { useVitalTypes } from '../../lib/vitals';
import { useFormErrors } from '../../lib/forms';
import { toLimit, validateLimits, type LimitErrors } from '../../lib/clinicalLimits';
import { GROUP_TITLES } from '../../lib/investigations';
import { formatDate, labelize } from '../../lib/format';
import { Alert, Button, Card, ConfirmDialog, ErrorState, Field, Input, Modal, ModalActions, PageHeader, PageLoader, ScrollX, SectionTitle, Select } from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import type { AlertThreshold, InvestigationField, InvestigationGroup, InvestigationTest, VitalType, VitalTypeDef } from '../../types/api';

type Severity = AlertThreshold['severity'];
type BpField = 'systolic' | 'diastolic' | null;
const thresholdsKey = ['admin', 'alertThresholds'] as const;
const TESTS_KEY = ['investigationTests'] as const;

/** Global limits only (patientId null), following the cursor so no page is dropped. */
const loadGlobalThresholds = async () => {
  const rows: AlertThreshold[] = [];
  let cursor: string | undefined;
  do {
    const page = await adminService.getThresholds({ limit: 100, cursor });
    rows.push(...page.data.filter((r) => r.patientId === null));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return rows;
};

interface Draft {
  title: string;
  unit: string | null;
  min?: number;
  max?: number;
  low: number | null;
  high: number | null;
  /** Present for vital limits only */
  severity?: Severity | null;
  save: (v: { low: number | null; high: number | null; severity: Severity }) => Promise<unknown>;
  /** Present only when a range exists to remove */
  remove?: () => Promise<unknown>;
}

const LimitModal = ({ draft, onClose }: { draft: Draft; onClose: () => void }) => {
  const toast = useToast();
  const form = useFormErrors();
  const [low, setLow] = useState(draft.low === null ? '' : String(draft.low));
  const [high, setHigh] = useState(draft.high === null ? '' : String(draft.high));
  const [severity, setSeverity] = useState<string>(draft.severity ?? '');
  const [local, setLocal] = useState<LimitErrors>({});
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isVital = draft.severity !== undefined;

  const run = useMutation({
    mutationFn: (job: () => Promise<unknown>) => job(),
    onSuccess: () => {
      toast.success('Saved.');
      onClose();
    },
    onError: (err) => {
      setConfirmRemove(false);
      form.fromApiError(err, 'Could not save.');
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errors = validateLimits(low, high, { min: draft.min, max: draft.max });
    // Removing a range is only through Remove range, never a save with both boxes empty
    if (isVital && !severity) errors.severity = 'Choose a severity.';
    setLocal(errors);
    if (Object.keys(errors).length) return;
    run.mutate(() => draft.save({ low: toLimit(low), high: toLimit(high), severity: severity as Severity }));
  };

  const err = (k: keyof LimitErrors) => local[k] ?? form.errors[k];

  return (
    <Modal title={draft.title} description={draft.unit ? `Unit: ${draft.unit}` : undefined} onClose={onClose}>
      <form onSubmit={submit} noValidate
        className="space-y-4"
        onChange={(e) => {
          form.onChange(e);
          // "At least one" sits on low, so typing in either box clears it
          setLocal({});
        }}
      >
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        {form.errors.field && <Alert tone="error">{form.errors.field}</Alert>}
        <Field label="Low" hint={draft.min !== undefined && draft.max !== undefined ? `Allowed ${draft.min}–${draft.max}` : undefined} error={err('low')}>
          <Input name="low" type="number" inputMode="decimal" step="any" min={draft.min} max={draft.max} value={low} onChange={(e) => setLow(e.target.value)} />
        </Field>
        <Field label="High" error={err('high')}>
          <Input name="high" type="number" inputMode="decimal" step="any" min={draft.min} max={draft.max} value={high} onChange={(e) => setHigh(e.target.value)} />
        </Field>
        {isVital && (
          <Field label="Severity" error={err('severity')}>
            <Select name="severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="">Choose…</option>
              {(['LOW', 'MEDIUM', 'HIGH'] as const).map((s) => (
                <option key={s} value={s}>
                  {labelize(s)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {draft.remove && (
          <Button variant="danger" size="sm" onClick={() => setConfirmRemove(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remove range
          </Button>
        )}
        <ModalActions onCancel={onClose} submitLabel="Save" loading={run.isPending} />
      </form>
      {confirmRemove && draft.remove && (
        <ConfirmDialog
          title="Remove this range?"
          message="Results for this field will no longer be flagged."
          confirmLabel="Remove"
          loading={run.isPending}
          onConfirm={() => run.mutate(draft.remove!)}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </Modal>
  );
};

const Th = ({ children }: { children: ReactNode }) => (
  <th scope="col" className="p-4">
    {children}
  </th>
);
const limitText = (v: number | null) => v ?? '—';
const hasRange = (f: InvestigationField) => f.range != null && (f.range.low !== null || f.range.high !== null);

const EditButton = ({ name, onClick }: { name: string; onClick: () => void }) => (
  <Button variant="ghost" size="sm" onClick={onClick} aria-label={`Edit ${name}`}>
    <Pencil className="h-4 w-4" aria-hidden="true" />
  </Button>
);

const TableShell = ({ caption, head, children }: { caption: string; head: ReactNode; children: ReactNode }) => (
  <ScrollX>
    <table className="w-full text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
        <tr>{head}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
  </ScrollX>
);

export const AdminClinicalLimitsPage = () => {
  const queryClient = useQueryClient();
  const vitalTypes = useVitalTypes();
  const thresholds = useQuery({ queryKey: thresholdsKey, queryFn: loadGlobalThresholds });
  const tests = useQuery({ queryKey: TESTS_KEY, queryFn: clinicalService.getTests, staleTime: Infinity });
  const [draft, setDraft] = useState<Draft | null>(null);

  // Only when there's nothing to show: a failed background refetch keeps the tables
  if ((vitalTypes.isError && !vitalTypes.data) || (thresholds.isError && !thresholds.data) || (tests.isError && !tests.data))
    return <ErrorState error={vitalTypes.error ?? thresholds.error ?? tests.error} onRetry={() => void Promise.all([vitalTypes.refetch(), thresholds.refetch(), tests.refetch()])} />;
  if (!vitalTypes.data || !thresholds.data || !tests.data) return <PageLoader label="Loading clinical limits…" />;

  const refreshVitals = () => queryClient.invalidateQueries({ queryKey: thresholdsKey });
  const refreshTests = () => queryClient.invalidateQueries({ queryKey: TESTS_KEY });

  // Text readings (nutrition) can't have limits; BP gets one row per field.
  const vitalRows = vitalTypes.data
    .filter((d: VitalTypeDef) => d.valueKind !== 'text')
    .flatMap((d) => (d.valueKind === 'pair' ? (['systolic', 'diastolic'] as const) : [null]).map((field: BpField) => ({ def: d, field })));

  const editVital = (def: VitalTypeDef, field: BpField, row?: AlertThreshold) => {
    const bounds = field ? def.fields?.[field] : def;
    setDraft({
      title: `${def.label}${field ? ` (${field})` : ''} alert limit`,
      unit: def.unit,
      min: bounds?.minValid,
      max: bounds?.maxValid,
      low: row?.low ?? null,
      high: row?.high ?? null,
      severity: row?.severity ?? null,
      save: async (v) => {
        await adminService.setThreshold(def.type as VitalType, { field, low: v.low, high: v.high, severity: v.severity, patientId: null });
        await refreshVitals();
      },
    });
  };

  const editRange = (test: InvestigationTest, f: InvestigationField & { kind: 'number' }) => {
    const send = async (low: number | null, high: number | null) => {
      await clinicalService.setRange({ test: test.code, field: f.key, low, high });
      await refreshTests();
    };
    setDraft({
      title: `${test.label}: ${f.label} normal range`,
      unit: f.unit,
      min: f.min,
      max: f.max,
      low: f.range?.low ?? null,
      high: f.range?.high ?? null,
      save: (v) => send(v.low, v.high),
      remove: hasRange(f) ? () => send(null, null) : undefined,
    });
  };

  // The panel's group order; groups with no number results have nothing to show
  const groups = (Object.keys(GROUP_TITLES) as InvestigationGroup[]).filter((g) => tests.data.some((t) => t.group === g && t.fields.some((f) => f.kind === 'number')));

  return (
    <div className="space-y-6">
      <PageHeader title="Clinical limits" description="Alert limits for vitals and normal ranges for investigation results" />
      <Alert tone="info">
        Enter only values approved by the clinical team. Until a limit is set, no vital alert fires for it and no result is flagged against it.
      </Alert>

      <Card className="p-0 sm:p-0">
        <div className="p-5 pb-0 sm:p-6 sm:pb-0">
          <SectionTitle title="Vital alert limits" description="Apply to every patient. A limit can be changed but not removed." />
        </div>
        <TableShell caption="Vital alert limits" head={<><Th>Vital</Th><Th>Unit</Th><Th>Low</Th><Th>High</Th><Th>Severity</Th><Th>Last changed</Th><Th><span className="sr-only">Actions</span></Th></>}>
          {vitalRows.map(({ def, field }) => {
            const row = thresholds.data.find((r) => r.type === def.type && r.field === field);
            const name = `${def.label}${field ? ` (${field})` : ''}`;
            return (
              <tr key={`${def.type}-${field}`}>
                <td className="p-4 font-semibold text-slate-900">{name}</td>
                <td className="p-4">{def.unit ?? '—'}</td>
                {row ? (
                  <>
                    <td className="p-4">{limitText(row.low)}</td>
                    <td className="p-4">{limitText(row.high)}</td>
                    <td className="p-4">{labelize(row.severity)}</td>
                    <td className="p-4">{formatDate(row.effectiveFrom)}</td>
                  </>
                ) : (
                  <td colSpan={4} className="p-4 text-slate-500">Not set</td>
                )}
                <td className="whitespace-nowrap p-4 text-right">
                  <EditButton name={name} onClick={() => editVital(def, field, row)} />
                </td>
              </tr>
            );
          })}
        </TableShell>
      </Card>

      <Card className="p-0 sm:p-0">
        <div className="p-5 pb-0 sm:p-6 sm:pb-0">
          <SectionTitle title="Investigation normal ranges" description="Only number results have a range. Removing a range stops flagging that result." />
        </div>
        <TableShell caption="Investigation normal ranges" head={<><Th>Test and result</Th><Th>Unit</Th><Th>Low</Th><Th>High</Th><Th><span className="sr-only">Actions</span></Th></>}>
          {groups.flatMap((g) => [
            <tr key={g} className="bg-slate-50">
              <th colSpan={5} scope="colgroup" className="p-3 text-xs font-bold uppercase tracking-wide text-slate-600">{GROUP_TITLES[g]}</th>
            </tr>,
            ...tests.data
              .filter((t) => t.group === g)
              .flatMap((t) =>
                t.fields.flatMap((f) => {
                  if (f.kind !== 'number') return [];
                  const set = hasRange(f);
                  const name = `${t.label}: ${f.label}`;
                  return [
                    <tr key={`${t.code}-${f.key}`}>
                      <td className="p-4 font-semibold text-slate-900">{name}</td>
                      <td className="p-4">{f.unit}</td>
                      {set ? (
                        <>
                          <td className="p-4">{limitText(f.range?.low ?? null)}</td>
                          <td className="p-4">{limitText(f.range?.high ?? null)}</td>
                        </>
                      ) : (
                        <td colSpan={2} className="p-4 text-slate-500">Not set</td>
                      )}
                      <td className="whitespace-nowrap p-4 text-right">
                        <EditButton name={name} onClick={() => editRange(t, f)} />
                      </td>
                    </tr>,
                  ];
                })
              ),
          ])}
        </TableShell>
      </Card>

      {draft && <LimitModal draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
};
