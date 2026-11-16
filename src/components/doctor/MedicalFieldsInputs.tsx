import type { ChangeEvent } from 'react';
import { PHONE_HINT, PHONE_PATTERN } from '../../lib/constants';
import { labelize, localDateKey } from '../../lib/format';
import { Field, Input, Select, Textarea } from '../ui';
import { BLOOD_GROUPS, IHD_STATUSES, SEXES, SMOKING_STATUSES } from '../../types/api';
import { bmi, COMORBIDITIES, flipTriState, foldListedConditions, hasCondition, setCondition, type MedicalForm } from '../../lib/medical';

const YES_NO = (
  <>
    <option value="">Not recorded</option>
    <option value="true">Yes</option>
    <option value="false">No</option>
  </>
);

/** The medical profile fields. Input names match the API's error `field` paths. */
export const MedicalFieldsInputs = ({
  value: f,
  onChange,
  errors,
  examples = true,
}: {
  value: MedicalForm;
  onChange: (next: MedicalForm) => void;
  errors: Record<string, string>;
  /** Grey "e.g." text in empty fields. Off when editing saved details, where it reads like real data. */
  examples?: boolean;
}) => {
  const example = (text: string) => (examples ? text : undefined);
  const set = (field: keyof MedicalForm) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange({ ...f, [field]: e.target.value });
  const today = localDateKey();
  const contactRequired = Boolean(f.ecName || f.ecRelation || f.ecPhone);
  const bodyMassIndex = bmi(Number(f.heightCm) || null, Number(f.onboardingWeightKg) || null);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Planned surgery" error={errors.plannedSurgery}>
          <Input name="plannedSurgery" maxLength={200} value={f.plannedSurgery} onChange={set('plannedSurgery')} placeholder={example('e.g. Laparoscopic right hemicolectomy')} />
        </Field>
        <Field label="Surgery date" error={errors.plannedSurgeryDate}>
          <Input name="plannedSurgeryDate" type="date" value={f.plannedSurgeryDate} onChange={set('plannedSurgeryDate')} />
        </Field>
        <Field label="Programme start date" hint="Day 1 of the prehab programme" error={errors.programmeStartDate}>
          <Input name="programmeStartDate" type="date" value={f.programmeStartDate} onChange={set('programmeStartDate')} />
        </Field>
        <Field label="Programme length (days)" hint="Leave blank to run until surgery" error={errors.programmeLengthDays}>
          <Input name="programmeLengthDays" type="number" inputMode="numeric" min="1" max="365" value={f.programmeLengthDays} onChange={set('programmeLengthDays')} />
        </Field>
        <Field label="Diagnosis" error={errors.diagnosis} className="sm:col-span-2">
          <Input name="diagnosis" maxLength={500} value={f.diagnosis} onChange={set('diagnosis')} placeholder={example('e.g. Colorectal cancer, stage II')} />
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
        <Field label="Weight at onboarding (kg)" hint={bodyMassIndex ? `BMI ${bodyMassIndex}` : 'Later weight loss is measured against this'} error={errors.onboardingWeightKg}>
          <Input name="onboardingWeightKg" type="number" inputMode="decimal" min="20" max="250" step="any" value={f.onboardingWeightKg} onChange={set('onboardingWeightKg')} />
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
        {f.smokingStatus === 'FORMER' && (
          <Field label="Date they quit smoking" error={errors.smokingQuitDate}>
            <Input name="smokingQuitDate" type="date" max={today} value={f.smokingQuitDate} onChange={set('smokingQuitDate')} />
          </Field>
        )}
        <Field label="Can climb 2 flights of stairs?" hint="“No” means under 4 METs" error={errors.functionalCapacityUnder4Mets}>
          <Select
            name="functionalCapacityUnder4Mets"
            value={flipTriState(f.functionalCapacityUnder4Mets)}
            onChange={(e) => onChange({ ...f, functionalCapacityUnder4Mets: flipTriState(e.target.value) })}
          >
            {YES_NO}
          </Select>
        </Field>
        <Field label="Chemotherapy received" error={errors.chemotherapy}>
          <Select name="chemotherapy" value={f.chemotherapy} onChange={set('chemotherapy')}>
            {YES_NO}
          </Select>
        </Field>
        <Field label="Radiotherapy received" error={errors.radiotherapy}>
          <Select name="radiotherapy" value={f.radiotherapy} onChange={set('radiotherapy')}>
            {YES_NO}
          </Select>
        </Field>
        {f.chemotherapy === 'true' && (
          <>
            <Field label="Date of last chemo" error={errors.lastChemoDate}>
              <Input name="lastChemoDate" type="date" max={today} value={f.lastChemoDate} onChange={set('lastChemoDate')} />
            </Field>
            <Field label="Chemo schedule" error={errors.chemoSchedule}>
              <Input name="chemoSchedule" maxLength={200} value={f.chemoSchedule} onChange={set('chemoSchedule')} />
            </Field>
          </>
        )}
        <Field label="Anaemia" error={errors.anaemia}>
          <Select name="anaemia" value={f.anaemia} onChange={set('anaemia')}>
            {YES_NO}
          </Select>
        </Field>
        <Field label="Allergies" hint="Separate with commas" error={errors.allergies}>
          <Input name="allergies" value={f.allergies} onChange={set('allergies')} placeholder={example('e.g. Penicillin')} />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-semibold text-slate-800">Conditions</legend>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {COMORBIDITIES.map((c) => (
              <label key={c.value} className="flex min-h-11 items-center gap-2.5 text-sm text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-teal-700"
                  checked={hasCondition(f.comorbidities, c.value)}
                  onChange={(e) => onChange({ ...f, comorbidities: setCondition(f.comorbidities, c.value, e.target.checked) })}
                />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
        {hasCondition(f.comorbidities, 'Hypertension') && (
          <Field label="Hypertension controlled on medication?" error={errors.hypertensionControlled}>
            <Select name="hypertensionControlled" value={f.hypertensionControlled} onChange={set('hypertensionControlled')}>
              {YES_NO}
            </Select>
          </Field>
        )}
        {hasCondition(f.comorbidities, 'Ischaemic heart disease') && (
          <Field label="Ischaemic heart disease status" error={errors.ihdStatus}>
            <Select name="ihdStatus" value={f.ihdStatus} onChange={set('ihdStatus')}>
              <option value="">Not recorded</option>
              {IHD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === 'STABLE' ? 'Stable' : 'Symptomatic, or MI/stent in last 6 months'}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Other conditions" hint="Separate with commas" error={errors.otherConditions ?? errors.conditions} className="sm:col-span-2">
          <Input
            name="otherConditions"
            maxLength={200}
            value={f.otherComorbidities}
            onChange={set('otherComorbidities')}
            onBlur={() => {
              const folded = foldListedConditions(f);
              if (folded !== f) onChange(folded);
            }}
            placeholder={example('e.g. Asthma')}
          />
        </Field>
        <Field label="Medications" hint="One per line" error={errors.medications} className="sm:col-span-2">
          <Textarea name="medications" rows={2} value={f.medications} onChange={set('medications')} placeholder={example('e.g. Metformin 500 mg twice daily')} />
        </Field>
      </div>

      <fieldset className="rounded-2xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-bold text-slate-900">Emergency contact (optional)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Name" error={errors['emergencyContact.name']}>
            <Input name="emergencyContact.name" required={contactRequired} maxLength={100} value={f.ecName} onChange={set('ecName')} />
          </Field>
          <Field label="Relationship" error={errors['emergencyContact.relation']}>
            <Input name="emergencyContact.relation" required={contactRequired} maxLength={50} value={f.ecRelation} onChange={set('ecRelation')} placeholder={example('e.g. Spouse')} />
          </Field>
          <Field label="Phone" hint={PHONE_HINT} error={errors['emergencyContact.phone']}>
            <Input name="emergencyContact.phone" type="tel" required={contactRequired} pattern={PHONE_PATTERN} value={f.ecPhone} onChange={set('ecPhone')} />
          </Field>
        </div>
      </fieldset>
    </div>
  );
};
