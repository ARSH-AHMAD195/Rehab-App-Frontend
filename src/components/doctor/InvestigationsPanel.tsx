import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Printer, X } from 'lucide-react';
import { clinicalService, patientService } from '../../services/apiServices';
import { ApiError, errorMessage } from '../../services/api';
import { useFormErrors } from '../../lib/forms';
import { cn } from '../../lib/cn';
import { dateKeyIn, formatDate, labelize } from '../../lib/format';
import { formatResult, GROUP_TITLES, testUnits } from '../../lib/investigations';
import { qk } from '../../lib/queryClient';
import { Alert, Button, buttonClass, Card, ConfirmDialog, Field, Input, Modal, ModalActions, PageLoader, SectionTitle, Select, Textarea } from '../ui';
import { useToast } from '../ui/toast';
import type { InvestigationField, InvestigationGroup, InvestigationResult, InvestigationTest, MedicalProfile } from '../../types/api';

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

type NotesField = 'medications' | 'clinicalNotes';
const NOTES: Record<NotesField, { title: string; label: string; hint: string; placeholder: string; maxLength?: number; saved: string; failed: string }> = {
  medications: {
    title: 'Medications',
    label: 'Medications',
    hint: 'One per line, up to 200 characters each',
    placeholder: 'e.g. Metformin 500 mg twice daily',
    saved: 'Medications saved.',
    failed: 'Could not save the medications.',
  },
  clinicalNotes: {
    title: 'Doctors’ notes',
    label: 'Notes',
    hint: 'Only doctors see these, never the patient. Up to 2000 characters.',
    placeholder: 'e.g. Discussed stopping aspirin 5 days before surgery',
    maxLength: 2000,
    saved: 'Notes saved.',
    failed: 'Could not save the notes.',
  },
};
const notesText = (medical: MedicalProfile, field: NotesField) =>
  field === 'medications' ? (medical.medications?.join('\n') ?? '') : (medical.clinicalNotes ?? '');
/** Medications are one per line; notes are kept as typed, trimmed. */
const notesValue = (text: string, field: NotesField) => {
  if (field === 'clinicalNotes') return text.trim() || null;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length ? lines : null;
};
const notesKey = (text: string, field: NotesField) => [notesValue(text, field)].flat().join('\n');

/** Saves one field (the medications, or the doctors' notes) from its card, instead of the whole medical details form. */
const NotesCard = ({ patientId, medical, field }: { patientId: string; medical: MedicalProfile; field: NotesField }) => {
  const copy = NOTES[field];
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const saved = notesText(medical, field);
  const [text, setText] = useState(saved);
  const [base, setBase] = useState(saved);
  // When the saved text changes (this save, or someone else's), show it, unless the doctor has unsaved typing
  if (saved !== base) {
    if (text === base) setText(saved);
    setBase(saved);
  }

  const save = useMutation({
    mutationFn: () => patientService.updateMedical(patientId, { version: medical.version, [field]: notesValue(text, field) }),
    onSuccess: (m) => {
      toast.success(copy.saved);
      // Show what was stored (trimmed, blank lines dropped), so the box isn't left "changed"
      const stored = notesText(m, field);
      setText(stored);
      setBase(stored);
      queryClient.setQueryData(qk.patientPart(patientId, 'medical'), m);
      void queryClient.invalidateQueries({ queryKey: qk.patient(patientId) });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'CONCURRENT_UPDATE') {
        // Loads their version; the typed text stays, and saving again replaces theirs
        void queryClient.invalidateQueries({ queryKey: qk.patient(patientId) });
        return form.setFormError('Someone else saved changes to this patient while you were typing. Your text is still in the box: Save again to replace theirs, or reload to see it.');
      }
      form.fromApiError(err, copy.failed);
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.validate(e.currentTarget)) save.mutate();
  };

  return (
    <Card>
      <SectionTitle title={copy.title} as="h3" />
      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-3">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        <Field label={copy.label} hint={copy.hint} error={form.errors[field]}>
          <Textarea name={field} rows={4} maxLength={copy.maxLength} value={text} onChange={(e) => setText(e.target.value)} placeholder={copy.placeholder} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={save.isPending} disabled={notesKey(text, field) === notesKey(saved, field)}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
};

const ResultChip = ({ test, result, onRetract }: { test: InvestigationTest | undefined; result: InvestigationResult; onRetract: () => void }) => (
  <span
    className={cn('inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs', result.outOfRange ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-slate-200 bg-slate-50 text-slate-800')}
  >
    <span>
      <span className="block font-bold [overflow-wrap:anywhere]">
        {formatResult(test, result)}
        {result.outOfRange && <span className="sr-only"> (outside the normal range)</span>}
      </span>
      <span className="block text-slate-600">{formatDate(result.takenOn, { day: 'numeric', month: 'short', year: '2-digit' })}</span>
      {result.comment && <span className="block max-w-56 whitespace-pre-line text-slate-700 [overflow-wrap:anywhere]">{result.comment}</span>}
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
export const InvestigationsPanel = ({ patientId, medical }: { patientId: string; medical: MedicalProfile | undefined }) => {
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
      <div className="flex justify-end">
        <Link to={`/doctor/patient/${patientId}/reports/investigations`} target="_blank" rel="noopener" className={buttonClass('secondary', 'sm')}>
          <Printer className="h-4 w-4" aria-hidden="true" />
          Investigation report
          <span className="sr-only"> (opens in a new tab)</span>
        </Link>
      </div>
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

      {medical && <NotesCard patientId={patientId} medical={medical} field="medications" />}
      {medical && <NotesCard patientId={patientId} medical={medical} field="clinicalNotes" />}

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
