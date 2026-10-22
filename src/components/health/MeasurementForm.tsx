import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { healthService, type NewMeasurement } from '../../services/apiServices';
import { useFormErrors } from '../../lib/forms';
import { BP_LIMITS, COMMON_VITAL_TYPES, MEASUREMENT_TYPES, measurementType } from '../../lib/constants';
import { cn } from '../../lib/cn';
import { Alert, Button, Field, Input, Select } from '../ui';
import { useToast } from '../ui/toast';
import type { MeasurementType } from '../../types/api';

const Chip = ({ checked, onChange, children }: { checked: boolean; onChange: () => void; children: string }) => (
  <label className="cursor-pointer">
    <input type="radio" name="measurementChoice" className="peer sr-only" checked={checked} onChange={onChange} />
    <span
      className={cn(
        'flex min-h-11 items-center justify-center rounded-xl border-2 px-3 text-center text-sm font-semibold transition-colors',
        'peer-focus-visible:ring-2 peer-focus-visible:ring-teal-600 peer-focus-visible:ring-offset-2',
        checked ? 'border-teal-700 bg-teal-50 text-teal-950' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
      )}
    >
      {children}
    </span>
  </label>
);

/**
 * Logs one health measurement. Common vitals are one-tap choices; the rest sit under "Other".
 * Shows the server's clinician safety notice when a value is out of range.
 */
export const MeasurementForm = ({
  types = MEASUREMENT_TYPES.map((t) => t.value),
  onSaved,
  onCancel,
}: {
  types?: readonly MeasurementType[];
  onSaved?: (guidanceNotice: string | null) => void;
  onCancel?: () => void;
}) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const common = types.filter((t) => COMMON_VITAL_TYPES.includes(t));
  const others = types.filter((t) => !COMMON_VITAL_TYPES.includes(t));
  const [type, setType] = useState<MeasurementType>(types[0] ?? 'blood_pressure');
  const [showOther, setShowOther] = useState(false);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [guidance, setGuidance] = useState('');

  const config = measurementType(type)!;
  const isBp = type === 'blood_pressure';

  const choose = (next: MeasurementType, other = false) => {
    setType(next);
    setShowOther(other);
    setGuidance('');
    form.clear('numericValue');
  };

  const save = useMutation({
    mutationFn: (payload: NewMeasurement) => healthService.logMeasurement(payload),
    onSuccess: (result) => {
      if (result.guidanceNotice) setGuidance(result.guidanceNotice);
      else toast.success(`${config.label} saved to your health record.`);
      setSystolic('');
      setDiastolic('');
      setValue('');
      setNotes('');
      void queryClient.invalidateQueries({ queryKey: ['my'] });
      onSaved?.(result.guidanceNotice);
    },
    onError: (err) => form.fromApiError(err, 'Could not save this measurement. Please try again.'),
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGuidance('');
    if (!form.validate(e.currentTarget)) return;
    save.mutate({
      type,
      unit: config.unit,
      notes: notes.trim(),
      ...(isBp ? { systolic: Number(systolic), diastolic: Number(diastolic) } : { numericValue: Number(value) }),
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
      {guidance && (
        <Alert tone="warning" title="Clinician safety notice">
          {guidance}
        </Alert>
      )}
      {form.formError && <Alert tone="error">{form.formError}</Alert>}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">What are you recording?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {common.map((t) => (
            <Chip key={t} checked={!showOther && type === t} onChange={() => choose(t)}>
              {measurementType(t)!.short ?? measurementType(t)!.label}
            </Chip>
          ))}
          {others.length > 0 && (
            <Chip checked={showOther} onChange={() => choose(others.includes(type) ? type : others[0]!, true)}>
              Other…
            </Chip>
          )}
        </div>
      </fieldset>

      {showOther && (
        <Field label="Other measurement">
          <Select name="otherType" value={type} onChange={(e) => choose(e.target.value as MeasurementType, true)}>
            {others.map((t) => (
              <option key={t} value={t}>
                {measurementType(t)!.label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {isBp ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Top number" hint="Systolic, mmHg" error={form.errors.systolic}>
            <Input name="systolic" type="number" inputMode="numeric" required {...BP_LIMITS.systolic} value={systolic} onChange={(e) => setSystolic(e.target.value)} />
          </Field>
          <Field label="Bottom number" hint="Diastolic, mmHg" error={form.errors.diastolic}>
            <Input name="diastolic" type="number" inputMode="numeric" required {...BP_LIMITS.diastolic} value={diastolic} onChange={(e) => setDiastolic(e.target.value)} />
          </Field>
        </div>
      ) : (
        <Field label={`${config.label} (${config.unit})`} error={form.errors.numericValue} hint={`Between ${config.min} and ${config.max}`}>
          <Input
            name="numericValue"
            type="number"
            inputMode={config.step ? 'decimal' : 'numeric'}
            required
            min={config.min}
            max={config.max}
            step={config.step ?? 1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
      )}

      <Field label="Anything to add? (optional)">
        <Input name="notes" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. After resting for 10 minutes" />
      </Field>

      <div className="flex justify-end gap-3 pt-1">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            Close
          </Button>
        )}
        <Button type="submit" size="lg" loading={save.isPending} className="flex-1 sm:flex-none">
          Save
        </Button>
      </div>
    </form>
  );
};
