import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, X } from 'lucide-react';
import { clinicalService, patientService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { useFormErrors } from '../../lib/forms';
import { cn } from '../../lib/cn';
import { dateKeyIn, formatDate } from '../../lib/format';
import { formatInvestigation, INVESTIGATION_SECTIONS, type InvestigationDef } from '../../lib/investigations';
import { qk } from '../../lib/queryClient';
import { Alert, Button, Card, ConfirmDialog, Field, Input, Modal, ModalActions, PageLoader, SectionTitle, Select, Textarea } from '../ui';
import { useToast } from '../ui/toast';
import type { Investigation, InvestigationValue } from '../../types/api';

const useRefreshAfterChange = (patientId: string) => {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: qk.patientPart(patientId, 'investigations') });
    void queryClient.invalidateQueries({ queryKey: qk.patientPart(patientId, 'triage') });
    void queryClient.invalidateQueries({ queryKey: qk.caseload });
  };
};

const AddResultModal = ({ patientId, def, onClose }: { patientId: string; def: InvestigationDef; onClose: () => void }) => {
  const toast = useToast();
  const refresh = useRefreshAfterChange(patientId);
  const form = useFormErrors();
  // Same query as the chart page, so it's already cached. The server rejects dates after the patient's today.
  const patient = useQuery({ queryKey: qk.patient(patientId), queryFn: () => patientService.get(patientId) });
  const today = dateKeyIn(patient.data?.timeZone);
  const [date, setDate] = useState(today);
  const [num, setNum] = useState('');
  const [text, setText] = useState('');
  const [wnl, setWnl] = useState(false);
  const [normal, setNormal] = useState('true');

  const value = (): InvestigationValue => {
    const comment = text.trim() ? { text: text.trim() } : {};
    switch (def.kind) {
      case 'num':
        return { num: Number(num) };
      case 'wnlOrText':
        return wnl ? { wnl: true } : { text: text.trim() };
      case 'ecg':
        return { normal: normal === 'true', ...comment };
      case 'echo':
        return { efPercent: Number(num), ...comment };
      default:
        return { text: text.trim() };
    }
  };

  const add = useMutation({
    mutationFn: () => clinicalService.addInvestigation(patientId, { type: def.type, date, value: value() }),
    onSuccess: () => {
      toast.success(`${def.label} saved.`);
      refresh();
      onClose();
    },
    onError: (err) => form.fromApiError(err, 'Could not save the result.'),
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.validate(e.currentTarget)) add.mutate();
  };

  const needsNumber = def.kind === 'num' || def.kind === 'echo';
  const needsText = def.kind === 'text' || (def.kind === 'wnlOrText' && !wnl);

  return (
    <Modal title={`Add ${def.label}`} onClose={onClose}>
      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        <Field label="Date of test" error={form.errors.date}>
          <Input name="date" type="date" required max={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {needsNumber && (
          <Field label={def.kind === 'echo' ? 'Ejection fraction (%)' : `Result${def.unit ? ` (${def.unit})` : ''}`} error={form.errors.value}>
            <Input name="value" type="number" inputMode="decimal" step="any" required value={num} onChange={(e) => setNum(e.target.value)} />
          </Field>
        )}
        {def.kind === 'wnlOrText' && (
          <label className="flex min-h-11 items-center gap-2.5 text-sm font-semibold text-slate-800">
            <input type="checkbox" className="h-4 w-4 accent-teal-700" checked={wnl} onChange={(e) => setWnl(e.target.checked)} />
            Within normal limits (WNL)
          </label>
        )}
        {def.kind === 'ecg' && (
          <Field label="Result">
            <Select name="normal" value={normal} onChange={(e) => setNormal(e.target.value)}>
              <option value="true">Normal</option>
              <option value="false">Abnormal</option>
            </Select>
          </Field>
        )}
        {(needsText || def.kind === 'ecg' || def.kind === 'echo') && (
          <Field label={needsText ? 'Result' : 'Comment (optional)'} error={def.kind === 'echo' ? form.errors.text : form.errors.value}>
            {/* Named `value` when it is the result, so client "required" errors land on the key rendered here. Echo's `value` error belongs to the EF field. */}
            <Textarea name={needsText ? 'value' : 'text'} rows={2} required={needsText} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
        )}
        <ModalActions onCancel={onClose} submitLabel="Save result" loading={add.isPending} />
      </form>
    </Modal>
  );
};

const ResultChip = ({ label, result, onRemove }: { label: string; result: Investigation; onRemove: () => void }) => (
  <span className={cn('inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs', result.outOfRange ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-slate-200 bg-slate-50 text-slate-800')}>
    <span>
      <span className="block font-bold [overflow-wrap:anywhere]">{formatInvestigation(result.value)}</span>
      <span className="block text-slate-600">{formatDate(result.date, { day: 'numeric', month: 'short', year: '2-digit' })}</span>
    </span>
    <button type="button" onClick={onRemove} aria-label={`Remove ${label} result from ${formatDate(result.date)}`} className="inline-flex min-h-6 min-w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-200 hover:text-slate-900">
      <X className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  </span>
);

/** The PAC investigation grid: every test with its dated results side by side, oldest first. */
export const InvestigationsPanel = ({ patientId, medications, onEditMedications }: { patientId: string; medications: string[] | null | undefined; onEditMedications: () => void }) => {
  const toast = useToast();
  const refresh = useRefreshAfterChange(patientId);
  const [adding, setAdding] = useState<InvestigationDef | null>(null);
  const [removing, setRemoving] = useState<Investigation | null>(null);

  const results = useQuery({ queryKey: qk.patientPart(patientId, 'investigations'), queryFn: () => clinicalService.getInvestigations(patientId) });

  const remove = useMutation({
    mutationFn: (id: string) => clinicalService.removeInvestigation(patientId, id),
    onSuccess: () => {
      toast.success('Result removed.');
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not remove the result.')),
    onSettled: () => setRemoving(null),
  });

  if (results.isPending) return <PageLoader label="Loading investigations…" />;
  if (results.isError) return <Alert tone="error">Investigations could not be loaded: {errorMessage(results.error)}</Alert>;

  const ofType = (type: string) => results.data.filter((r) => r.type === type).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="space-y-6">
      {INVESTIGATION_SECTIONS.map((section) => (
        <Card key={section.title}>
          <SectionTitle title={section.title} as="h3" />
          <ul className="divide-y divide-slate-100">
            {section.items.map((def) => (
              <li key={def.type} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="sm:w-52 sm:shrink-0">
                  <p className="text-sm font-semibold text-slate-900">{def.label}</p>
                  {def.unit && <p className="text-xs text-slate-600">{def.unit}</p>}
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {ofType(def.type).map((r) => (
                    <ResultChip key={r.id} label={def.label} result={r} onRemove={() => setRemoving(r)} />
                  ))}
                </div>
                <Button size="sm" variant="secondary" className="self-start sm:self-center" aria-label={`Add ${def.label}`} onClick={() => setAdding(def)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add
                </Button>
              </li>
            ))}
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

      {adding && <AddResultModal patientId={patientId} def={adding} onClose={() => setAdding(null)} />}
      {removing && (
        <ConfirmDialog
          title="Remove this result?"
          message={`${formatInvestigation(removing.value)} from ${formatDate(removing.date)} will no longer count towards triage. The change is recorded in the audit log.`}
          confirmLabel="Remove result"
          onConfirm={() => remove.mutate(removing.id)}
          onCancel={() => setRemoving(null)}
          loading={remove.isPending}
        />
      )}
    </div>
  );
};
