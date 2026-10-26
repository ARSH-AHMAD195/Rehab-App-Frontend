import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vitalsService, type ReadingChanges } from '../../services/apiServices';
import { ApiError } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { useFormErrors } from '../../lib/forms';
import { useVitalLabel, useVitalTypes } from '../../lib/vitals';
import { Alert, Button, ErrorState, Field, Input, PageLoader, Textarea } from '../ui';
import { useToast } from '../ui/toast';
import type { DailyLog, ReadingValue, SavedAlert, VitalTypeDef } from '../../types/api';

/** Input names match the API's error `field` paths, so server messages land on the right box. */
const inputsFor = (def: VitalTypeDef): string[] =>
  def.valueKind === 'pair' ? [`readings.${def.type}.systolic`, `readings.${def.type}.diastolic`] : [`readings.${def.type}.${def.valueKind === 'text' ? 'text' : 'num'}`];

const toInputs = (log: DailyLog | undefined, defs: VitalTypeDef[]) => {
  const values: Record<string, string> = {};
  for (const def of defs) {
    const v = log?.readings[def.type]?.value as Record<string, unknown> | null | undefined;
    for (const name of inputsFor(def)) values[name] = v?.[name.split('.').pop()!] != null ? String(v[name.split('.').pop()!]) : '';
  }
  return values;
};

/** Only the readings that changed: the API keeps the rest as they are, and null clears one. */
const changesBetween = (defs: VitalTypeDef[], before: Record<string, string>, after: Record<string, string>): ReadingChanges => {
  const changes: ReadingChanges = {};
  for (const def of defs) {
    const names = inputsFor(def);
    if (names.every((n) => before[n] === after[n])) continue;
    if (names.every((n) => after[n]!.trim() === '')) {
      changes[def.type] = null;
      continue;
    }
    const [a, b] = names.map((n) => after[n]!.trim());
    changes[def.type] = (def.valueKind === 'pair' ? { systolic: Number(a), diastolic: Number(b) } : def.valueKind === 'text' ? { text: a } : { num: Number(a) }) as ReadingValue;
  }
  return changes;
};

const rangeHint = (def: VitalTypeDef) =>
  def.valueKind === 'text' ? undefined : def.minValid !== undefined ? `${def.minValid}–${def.maxValid}${def.unit ? ` ${def.unit}` : ''}` : (def.unit ?? undefined);

/** Today's daily log: every reading the clinic asks for, pre-filled with what's already saved. */
export const VitalsForm = ({ onSaved }: { onSaved?: () => void }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const [alerts, setAlerts] = useState<SavedAlert[]>([]);

  const types = useVitalTypes();
  const vitalLabel = useVitalLabel();
  const today = useQuery({ queryKey: qk.myToday, queryFn: vitalsService.getToday });
  const defs = useMemo(() => (types.data ?? []).filter((d) => d.onForm), [types.data]);
  const saved = useMemo(() => toInputs(today.data, defs), [today.data, defs]);
  // Only what the patient has typed, over what's saved: never out of step with the server data
  const [edits, setEdits] = useState<Record<string, string>>({});
  const values = { ...saved, ...edits };
  const setValue = (name: string, value: string) => setEdits((e) => ({ ...e, [name]: value }));

  const save = useMutation({
    mutationFn: (changes: ReadingChanges) => vitalsService.saveToday(today.data!.date, changes),
    onSuccess: (log) => {
      setAlerts(log.alerts);
      setEdits({});
      queryClient.setQueryData(qk.myToday, log);
      void queryClient.invalidateQueries({ queryKey: ['my', 'vitals'] });
      if (!log.alerts.length) toast.success('Today’s readings are saved.');
      onSaved?.();
    },
    onError: (err) => {
      // Midnight passed while the form was open: load the new day instead of saving to the wrong one
      if (err instanceof ApiError && err.code === 'DAY_CHANGED') void today.refetch();
      form.fromApiError(err, 'Could not save your readings. Please try again.');
    },
  });

  if (types.isPending || today.isPending) return <PageLoader label="Loading today’s readings…" />;
  if (types.isError || today.isError) return <ErrorState error={types.error ?? today.error} onRetry={() => void Promise.all([types.refetch(), today.refetch()])} />;

  const changes = changesBetween(defs, saved, values);
  const changedCount = Object.keys(changes).length;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAlerts([]);
    if (form.validate(e.currentTarget) && changedCount) save.mutate(changes);
  };

  const input = (def: VitalTypeDef, name: string, label: string) => {
    const range = def.fields?.[name.split('.').pop() as 'systolic' | 'diastolic'] ?? def;
    return (
      <Field key={name} label={label} hint={def.valueKind === 'pair' ? `${range.minValid}–${range.maxValid}` : rangeHint(def)} error={form.errors[name]}>
        {def.valueKind === 'text' ? (
          <Textarea name={name} rows={2} minLength={def.minValid} maxLength={def.maxValid} value={values[name] ?? ''} onChange={(e) => setValue(name, e.target.value)} />
        ) : (
          <Input
            name={name}
            type="number"
            inputMode={def.integerOnly ? 'numeric' : 'decimal'}
            min={range.minValid}
            max={range.maxValid}
            step={def.step ?? (def.integerOnly ? 1 : 'any')}
            required={def.valueKind === 'pair' && values[inputsFor(def).find((n) => n !== name)!]?.trim() !== ''}
            value={values[name] ?? ''}
            onChange={(e) => setValue(name, e.target.value)}
          />
        )}
      </Field>
    );
  };

  return (
    <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-5">
      {alerts.length > 0 && (
        <Alert tone="warning" title="Your care team has been alerted">
          {alerts.map((a) => `${vitalLabel(a.type)}${a.field ? ` (${a.field})` : ''} is ${a.rule === 'ABOVE_HIGH' ? 'above' : 'below'} ${a.threshold}`).join('; ')}. If you feel unwell, contact your care team or emergency services.
        </Alert>
      )}
      {form.formError && <Alert tone="error">{form.formError}</Alert>}
      <p className="text-sm text-slate-700">
        {today.data.filledCount} of {today.data.totalCount} filled for {today.data.date}. Fill in what you have; you can come back later today.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {defs.map((def) =>
          def.valueKind === 'pair' ? (
            <fieldset key={def.type} className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
              <legend className="mb-1 text-sm font-semibold text-slate-800">
                {def.label} ({def.unit})
              </legend>
              {input(def, `readings.${def.type}.systolic`, 'Top number')}
              {input(def, `readings.${def.type}.diastolic`, 'Bottom number')}
            </fieldset>
          ) : (
            <div key={def.type} className={def.valueKind === 'text' ? 'sm:col-span-2 lg:col-span-3' : undefined}>
              {input(def, inputsFor(def)[0]!, `${def.label}${def.isOptional ? ' (optional)' : ''}`)}
            </div>
          )
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={save.isPending} disabled={!changedCount}>
          Save {changedCount ? `${changedCount} ${changedCount === 1 ? 'change' : 'changes'}` : ''}
        </Button>
      </div>
    </form>
  );
};
