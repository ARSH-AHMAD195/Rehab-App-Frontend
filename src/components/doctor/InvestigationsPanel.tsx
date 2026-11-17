import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, X } from 'lucide-react';
import { clinicalService, patientService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { useFormErrors } from '../../lib/forms';
import { cn } from '../../lib/cn';
import { dateKeyIn, formatDate, labelize } from '../../lib/format';
import { formatResult, GROUP_TITLES, testUnits } from '../../lib/investigations';
import { qk } from '../../lib/queryClient';
import { Alert, Button, Card, ConfirmDialog, Field, Input, Modal, ModalActions, PageLoader, SectionTitle, Select, Textarea } from '../ui';
import { useToast } from '../ui/toast';
import type { InvestigationField, InvestigationGroup, InvestigationResult, InvestigationTest } from '../../types/api';

const useRefreshAfterChange = (patientId: string) => {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: qk.patientPart(patientId, 'investigations') });
    void queryClient.invalidateQueries({ queryKey: qk.patientPart(patientId, 'triage') });
    void queryClient.invalidateQueries({ queryKey: ['careAlerts'] });
    void queryClient.invalidateQueries({ queryKey: ['patients'] });
  };
};

const rangeHint = (field: InvestigationField) =>
  field.range && (field.range.low !== null || field.range.high !== null)
    ? `Normal ${field.range.low ?? '…'}–${field.range.high ?? '…'}`
    : undefined;

const FieldInput = ({ field, value, onChange, error }: { field: InvestigationField; value: string; onChange: (v: string) => void; error?: string }) => {
  const name = `values.${field.key}`;
  const required = field.required ?? false;
  if (field.kind === 'number') {
    return (
      <Field label={`${field.label} (${field.unit})`} hint={rangeHint(field)} error={error}>
        <Input name={name} type="number" inputMode="decimal" step={field.integer ? 1 : 'any'} min={field.min} max={field.max} required={required} value={value} onChange={(e) => onChange(e.target.value)} />
      </Field>
    );
  }
  if (field.kind === 'choice') {
    return (
      <Field label={field.label} error={error}>
        <Select name={name} required={required} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {labelize(o)}
            </option>
          ))}
        </Select>
      </Field>
    );
  }
  return (
    <Field label={field.label} error={error}>
      <Textarea name={name} rows={2} required={required} maxLength={field.maxLength} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
};

const AddResultModal = ({ patientId, test, onClose }: { patientId: string; test: InvestigationTest; onClose: () => void }) => {
  const toast = useToast();
  const refresh = useRefreshAfterChange(patientId);
  const form = useFormErrors();
  // Same query as the chart page, so it's already cached. The server rejects dates after the patient's today.
  const patient = useQuery({ queryKey: qk.patient(patientId), queryFn: () => patientService.get(patientId) });
  const today = dateKeyIn(patient.data?.timeZone);
  const [takenOn, setTakenOn] = useState(today);
  const [values, setValues] = useState<Record<string, string>>({});
  const [wnl, setWnl] = useState(false);
  const [comment, setComment] = useState('');
  // With WNL ticked only the fields still asked for (e.g. which imaging study) are shown and sent
  const fields = test.fields.filter((f) => !wnl || (f.kind === 'text' && f.alsoWithWnl));

  const add = useMutation({
    mutationFn: () =>
      clinicalService.addInvestigation(patientId, {
        test: test.code,
        takenOn,
        wnl: wnl || undefined,
        comment: comment.trim() || null,
        values: Object.fromEntries(
          fields.flatMap((f) => {
            const v = values[f.key]?.trim() ?? '';
            return v ? [[f.key, f.kind === 'number' ? Number(v) : v]] : [];
          })
        ),
      }),
    onSuccess: () => {
      toast.success(`${test.label} saved.`);
      refresh();
      onClose();
    },
    onError: (err) => form.fromApiError(err, 'Could not save the result.'),
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.validate(e.currentTarget)) add.mutate();
  };

  return (
    <Modal title={`Add ${test.label}`} description={test.note} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        {form.errors.values && <Alert tone="error">{form.errors.values}</Alert>}
        <Field label="Date of test" error={form.errors.takenOn}>
          <Input name="takenOn" type="date" required max={today} value={takenOn} onChange={(e) => setTakenOn(e.target.value)} />
        </Field>
        {test.allowWnl && (
          <label className="flex min-h-11 items-center gap-2.5 text-sm font-semibold text-slate-800">
            <input type="checkbox" name="wnl" className="h-4 w-4 accent-teal-700" checked={wnl} onChange={(e) => setWnl(e.target.checked)} />
            Within normal limits (WNL)
          </label>
        )}
        {fields.map((f) => (
          <FieldInput key={f.key} field={f} value={values[f.key] ?? ''} onChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))} error={form.errors[`values.${f.key}`]} />
        ))}
        <Field label="Comment (optional)" error={form.errors.comment}>
          <Textarea name="comment" rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        <ModalActions onCancel={onClose} submitLabel="Save result" loading={add.isPending} />
      </form>
    </Modal>
  );
};

const ResultChip = ({ test, result, onRetract }: { test: InvestigationTest | undefined; result: InvestigationResult; onRetract: () => void }) => (
  <span
    title={result.comment ?? undefined}
    className={cn('inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs', result.outOfRange ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-slate-200 bg-slate-50 text-slate-800')}
  >
    <span>
      <span className="block font-bold [overflow-wrap:anywhere]">
        {formatResult(test, result)}
        {result.outOfRange && <span className="sr-only"> (outside the normal range)</span>}
      </span>
      <span className="block text-slate-600">{formatDate(result.takenOn, { day: 'numeric', month: 'short', year: '2-digit' })}</span>
    </span>
    <button
      type="button"
      onClick={onRetract}
      aria-label={`Mark the ${test?.label ?? result.test} result from ${formatDate(result.takenOn)} as entered in error`}
      className="inline-flex min-h-6 min-w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-200 hover:text-slate-900"
    >
      <X className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  </span>
);

/** The PAC investigation grid: every test with its dated results, newest first. Red only against ranges the clinic approved. */
export const InvestigationsPanel = ({ patientId, medications, onEditMedications }: { patientId: string; medications: string[] | null | undefined; onEditMedications: () => void }) => {
  const toast = useToast();
  const refresh = useRefreshAfterChange(patientId);
  const [adding, setAdding] = useState<InvestigationTest | null>(null);
  const [retracting, setRetracting] = useState<InvestigationResult | null>(null);
  const [reason, setReason] = useState('');

  const tests = useQuery({ queryKey: ['investigationTests'], queryFn: clinicalService.getTests, staleTime: Infinity });
  const grid = useQuery({ queryKey: qk.patientPart(patientId, 'investigations'), queryFn: () => clinicalService.getInvestigations(patientId) });

  const retract = useMutation({
    mutationFn: (id: string) => clinicalService.retractInvestigation(patientId, id, reason.trim()),
    onSuccess: () => {
      toast.success('Result marked as entered in error.');
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not remove the result.')),
    onSettled: () => setRetracting(null),
  });

  if (tests.isPending || grid.isPending) return <PageLoader label="Loading investigations…" />;
  if (tests.isError || grid.isError) return <Alert tone="error">Investigations could not be loaded: {errorMessage(tests.error ?? grid.error)}</Alert>;

  const byCode = new Map(tests.data.map((t) => [t.code, t]));
  const groups = Object.keys(GROUP_TITLES) as InvestigationGroup[];

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <Card key={group}>
          <SectionTitle title={GROUP_TITLES[group]} as="h3" />
          <ul className="divide-y divide-slate-100">
            {grid.data
              .filter((row) => row.group === group)
              .map((row) => {
                const test = byCode.get(row.test);
                return (
                  <li key={row.test} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="sm:w-52 sm:shrink-0">
                      <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                      {test && testUnits(test) && <p className="text-xs text-slate-600">{testUnits(test)}</p>}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {row.results.map((r) => (
                        <ResultChip
                          key={r.id}
                          test={test}
                          result={r}
                          onRetract={() => {
                            setReason('');
                            setRetracting(r);
                          }}
                        />
                      ))}
                    </div>
                    {test && (
                      <Button size="sm" variant="secondary" className="self-start sm:self-center" aria-label={`Add ${row.label}`} onClick={() => setAdding(test)}>
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Add
                      </Button>
                    )}
                  </li>
                );
              })}
          </ul>
        </Card>
      ))}

      <Card>
        <SectionTitle
          title="Medication assigned"
          as="h3"
          actions={
            <Button size="sm" variant="subtle" onClick={onEditMedications}>
              <Pencil className="h-4 w-4 text-teal-800" aria-hidden="true" />
              Edit
            </Button>
          }
        />
        <p className="text-sm text-slate-800 [overflow-wrap:anywhere]">{medications?.join('; ') || 'None documented'}</p>
      </Card>

      {adding && <AddResultModal patientId={patientId} test={adding} onClose={() => setAdding(null)} />}
      {retracting && (
        <ConfirmDialog
          title="Entered in error?"
          message={
            <div className="space-y-3">
              <p>
                {formatResult(byCode.get(retracting.test), retracting)} from {formatDate(retracting.takenOn)} will leave the grid and stop counting towards triage. It is kept, with
                your reason, in the record. Enter the right value as a new result.
              </p>
              <Field label="Reason">
                <Textarea name="reason" rows={2} required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered for the wrong patient" />
              </Field>
            </div>
          }
          confirmLabel="Remove result"
          onConfirm={() => reason.trim() && retract.mutate(retracting.id)}
          onCancel={() => setRetracting(null)}
          loading={retract.isPending}
        />
      )}
    </div>
  );
};
