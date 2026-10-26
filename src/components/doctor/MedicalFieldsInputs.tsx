import type { ChangeEvent } from 'react';
import { PHONE_HINT, PHONE_PATTERN } from '../../lib/constants';
import { labelize, localDateKey } from '../../lib/format';
import { Field, Input, Select, Textarea } from '../ui';
import { BLOOD_GROUPS, SEXES, SMOKING_STATUSES } from '../../types/api';
import type { MedicalForm } from '../../lib/medical';

/** The medical profile fields. Input names match the API's error `field` paths. */
export const MedicalFieldsInputs = ({ value: f, onChange, errors }: { value: MedicalForm; onChange: (next: MedicalForm) => void; errors: Record<string, string> }) => {
  const set = (field: keyof MedicalForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange({ ...f, [field]: e.target.value });
  const today = localDateKey();
  const contactRequired = Boolean(f.ecName || f.ecRelation || f.ecPhone);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Planned surgery" error={errors.plannedSurgery}>
          <Input name="plannedSurgery" maxLength={200} value={f.plannedSurgery} onChange={set('plannedSurgery')} placeholder="e.g. Laparoscopic right hemicolectomy" />
        </Field>
        <Field label="Surgery date" error={errors.plannedSurgeryDate}>
          <Input name="plannedSurgeryDate" type="date" value={f.plannedSurgeryDate} onChange={set('plannedSurgeryDate')} />
        </Field>
        <Field label="Diagnosis" error={errors.diagnosis} className="sm:col-span-2">
          <Input name="diagnosis" maxLength={500} value={f.diagnosis} onChange={set('diagnosis')} placeholder="e.g. Colorectal cancer, stage II" />
        </Field>
        <Field label="Date of birth" error={errors.dateOfBirth}>
          <Input name="dateOfBirth" type="date" max={today} min="1900-01-01" value={f.dateOfBirth} onChange={set('dateOfBirth')} />
        </Field>
        <Field label="Sex" error={errors.sex}>
          <Select name="sex" value={f.sex} onChange={set('sex')}>
            <option value="">Not recorded</option>
            {SEXES.map((s) => (
              <option key={s} value={s}>
                {labelize(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Height (cm)" error={errors.heightCm}>
          <Input name="heightCm" type="number" inputMode="decimal" min="50" max="250" step="any" value={f.heightCm} onChange={set('heightCm')} />
        </Field>
        <Field label="Blood group" error={errors.bloodGroup}>
          <Select name="bloodGroup" value={f.bloodGroup} onChange={set('bloodGroup')}>
            <option value="">Not recorded</option>
            {BLOOD_GROUPS.map((b) => (
              <option key={b} value={b}>
                {b === 'UNKNOWN' ? 'Unknown' : b}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Smoking" error={errors.smokingStatus}>
          <Select name="smokingStatus" value={f.smokingStatus} onChange={set('smokingStatus')}>
            <option value="">Not recorded</option>
            {SMOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {labelize(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Allergies" hint="Separate with commas" error={errors.allergies}>
          <Input name="allergies" value={f.allergies} onChange={set('allergies')} placeholder="e.g. Penicillin" />
        </Field>
        <Field label="Other conditions" hint="Separate with commas" error={errors.comorbidities}>
          <Input name="comorbidities" value={f.comorbidities} onChange={set('comorbidities')} placeholder="e.g. Hypertension, Type 2 diabetes" />
        </Field>
        <Field label="Medications" hint="One per line" error={errors.medications} className="sm:col-span-2">
          <Textarea name="medications" rows={2} value={f.medications} onChange={set('medications')} placeholder="e.g. Metformin 500 mg twice daily" />
        </Field>
      </div>

      <fieldset className="rounded-2xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-bold text-slate-900">Emergency contact (optional)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" error={errors['emergencyContact.name']}>
            <Input name="emergencyContact.name" required={contactRequired} maxLength={100} value={f.ecName} onChange={set('ecName')} />
          </Field>
          <Field label="Relationship" error={errors['emergencyContact.relation']}>
            <Input name="emergencyContact.relation" required={contactRequired} maxLength={50} value={f.ecRelation} onChange={set('ecRelation')} placeholder="e.g. Spouse" />
          </Field>
          <Field label="Phone" hint={PHONE_HINT} error={errors['emergencyContact.phone']}>
            <Input name="emergencyContact.phone" type="tel" required={contactRequired} pattern={PHONE_PATTERN} value={f.ecPhone} onChange={set('ecPhone')} />
          </Field>
        </div>
      </fieldset>
    </div>
  );
};
