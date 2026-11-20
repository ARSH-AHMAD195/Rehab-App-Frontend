import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { clinicalService, patientService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { useFormErrors } from '../../lib/forms';
import { DEFAULT_TIME_ZONE, PHONE_HINT, PHONE_PATTERN } from '../../lib/constants';
import { EMPTY_MEDICAL_FORM, formToMedical, type MedicalForm } from '../../lib/medical';
import { dateKeyIn, localDateKey } from '../../lib/format';
import { normalizePhone } from '../../lib/phoneLogin';
import { Alert, Button, Card, Field, Input } from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import { MedicalFieldsInputs } from '../../components/doctor/MedicalFieldsInputs';
import { UnsavedChangesGuard } from '../../components/UnsavedChangesGuard';

const EMPTY_ACCOUNT = { name: '', phone: '', email: '', timeZone: DEFAULT_TIME_ZONE };
/** Saved as the first dated investigation results, so each test has one history. */
const EMPTY_RESULTS = { HB: '', ALBUMIN: '', MUST: '', PG_SGA: '' };
const RESULT_LABELS: Record<keyof typeof EMPTY_RESULTS, string> = { HB: 'Haemoglobin', ALBUMIN: 'Albumin', MUST: 'MUST', PG_SGA: 'PG-SGA' };
/** The test's field each number goes in (GET /investigation-tests) */
const RESULT_FIELD: Record<keyof typeof EMPTY_RESULTS, string> = { HB: 'value', ALBUMIN: 'value', MUST: 'score', PG_SGA: 'score' };

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  // The divider lives on a wrapper: a border on <fieldset> itself is drawn through its <legend>
  <div className="border-t border-slate-200 pt-5 first:border-0 first:pt-0">
    <fieldset>
      <legend className="mb-3 text-base font-bold text-slate-900">{title}</legend>
      {children}
    </fieldset>
  </div>
);

export const DoctorOnboardPatientPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const [account, setAccount] = useState(EMPTY_ACCOUNT);
  // The programme starts on the day they're enrolled unless the doctor picks another day
  const [initialMedical] = useState<MedicalForm>(() => ({ ...EMPTY_MEDICAL_FORM, programmeStartDate: localDateKey() }));
  const [medical, setMedical] = useState<MedicalForm>(initialMedical);
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const set = (field: keyof typeof EMPTY_ACCOUNT) => (e: ChangeEvent<HTMLInputElement>) => setAccount((p) => ({ ...p, [field]: e.target.value }));
  const setResult = (type: keyof typeof EMPTY_RESULTS) => (e: ChangeEvent<HTMLInputElement>) => setResults((r) => ({ ...r, [type]: e.target.value }));
  const dirty = JSON.stringify([account, medical, results]) !== JSON.stringify([EMPTY_ACCOUNT, initialMedical, EMPTY_RESULTS]);

  // Navigate only after the guard has re-rendered with the form marked as saved
  useEffect(() => {
    if (createdId) navigate(`/doctor/patient/${createdId}`);
  }, [createdId, navigate]);

  const enroll = useMutation({
    mutationFn: async () => {
      // The patient is linked to the signed-in doctor automatically
      const patient = await patientService.register({
        name: account.name.trim(),
        phone: normalizePhone(account.phone),
        email: account.email.trim() || null,
        timeZone: account.timeZone.trim() || DEFAULT_TIME_ZONE,
      });
      const fields = Object.fromEntries(Object.entries(formToMedical(medical)).filter(([, v]) => v !== null));
      let medicalError: unknown = null;
      if (Object.keys(fields).length) {
        await patientService.updateMedical(patient.id, { version: 0, ...fields }).catch((err: unknown) => (medicalError = err));
      }
      const filled = (Object.entries(results) as [keyof typeof EMPTY_RESULTS, string][]).filter(([, value]) => value.trim());
      // The server checks result dates against the patient's own today
      const takenOn = dateKeyIn(patient.timeZone);
      const saved = await Promise.allSettled(
        filled.map(([test, value]) => clinicalService.addInvestigation(patient.id, { test, takenOn, values: { [RESULT_FIELD[test]]: Number(value) } }))
      );
      const resultsFailed = filled.filter((_, i) => saved[i]?.status === 'rejected').map(([type]) => RESULT_LABELS[type]);
      return { patient, medicalError, resultsFailed };
    },
    onSuccess: ({ patient, medicalError, resultsFailed }) => {
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      void queryClient.invalidateQueries({ queryKey: ['caseload'] });
      // Patients sign in with their phone and a code from their doctor, so any email sent is a courtesy
      toast.success(`${patient.name} is enrolled. Give them a sign-in code from their page.`);
      if (medicalError) toast.error(`The medical details weren’t saved: ${errorMessage(medicalError)} Add them from the chart.`);
      if (resultsFailed.length) toast.error(`These first results weren’t saved: ${resultsFailed.join(', ')}. Add them under Investigations in the chart.`);
      setCreatedId(patient.id);
    },
    onError: (err) => {
      form.fromApiError(err, 'Could not enroll the patient. Please try again.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.validate(e.currentTarget)) enroll.mutate();
  };

  return (
    <Card className="mx-auto max-w-3xl sm:p-8">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-800">
          <UserPlus className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Onboard a new patient</h1>
          <p className="text-sm text-slate-600">Adds the patient to your caseload. They’ll sign in with this mobile number.</p>
        </div>
      </div>

      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="mt-6 space-y-6">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}

        <Section title="1. Account">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={form.errors.name}>
              <Input name="name" required maxLength={100} autoComplete="off" value={account.name} onChange={set('name')} />
            </Field>
            <Field label="Mobile number" hint={`They sign in with this. ${PHONE_HINT}`} error={form.errors.phone}>
              <Input name="phone" type="tel" required pattern={PHONE_PATTERN} autoComplete="off" value={account.phone} onChange={(e) => setAccount((p) => ({ ...p, phone: normalizePhone(e.target.value) }))} />
            </Field>
            <Field label="Email address (optional)" error={form.errors.email}>
              <Input name="email" type="email" autoComplete="off" value={account.email} onChange={set('email')} />
            </Field>
            <Field label="Time zone" hint="Decides when the patient’s day starts" error={form.errors.timeZone}>
              <Input name="timeZone" required value={account.timeZone} onChange={set('timeZone')} />
            </Field>
          </div>
        </Section>

        <Section title="2. Medical details (optional, can be added later)">
          <MedicalFieldsInputs value={medical} onChange={setMedical} errors={form.errors} />
        </Section>

        <Section title="3. First results (optional, more can be added later)">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Haemoglobin (g/dL)" error={form.errors.HB}>
              <Input name="HB" type="number" inputMode="decimal" min="1" max="25" step="any" value={results.HB} onChange={setResult('HB')} />
            </Field>
            <Field label="Albumin (g/dL)" error={form.errors.ALBUMIN}>
              <Input name="ALBUMIN" type="number" inputMode="decimal" min="0.5" max="7" step="any" value={results.ALBUMIN} onChange={setResult('ALBUMIN')} />
            </Field>
            <Field label="Nutrition score: MUST" error={form.errors.MUST}>
              <Input name="MUST" type="number" inputMode="numeric" min="0" max="6" step="1" value={results.MUST} onChange={setResult('MUST')} />
            </Field>
            <Field label="Nutrition score: PG-SGA" error={form.errors.PG_SGA}>
              <Input name="PG_SGA" type="number" inputMode="numeric" min="0" max="50" step="1" value={results.PG_SGA} onChange={setResult('PG_SGA')} />
            </Field>
          </div>
        </Section>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={() => navigate('/doctor/patients')}>
            Cancel
          </Button>
          <Button type="submit" loading={enroll.isPending}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Enroll patient
          </Button>
        </div>
      </form>

      <UnsavedChangesGuard when={dirty && !createdId && !enroll.isPending} />
    </Card>
  );
};
