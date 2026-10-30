import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { patientService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { useFormErrors } from '../../lib/forms';
import { DEFAULT_TIME_ZONE, PHONE_HINT, PHONE_PATTERN } from '../../lib/constants';
import { EMPTY_MEDICAL_FORM, formToMedical, type MedicalForm } from '../../lib/medical';
import { Alert, Button, Card, Field, Input } from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import { MedicalFieldsInputs } from '../../components/doctor/MedicalFieldsInputs';
import { UnsavedChangesGuard } from '../../components/UnsavedChangesGuard';

const EMPTY_ACCOUNT = { name: '', email: '', phone: '', timeZone: DEFAULT_TIME_ZONE };

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
  const [medical, setMedical] = useState<MedicalForm>(EMPTY_MEDICAL_FORM);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const set = (field: keyof typeof EMPTY_ACCOUNT) => (e: ChangeEvent<HTMLInputElement>) => setAccount((p) => ({ ...p, [field]: e.target.value }));
  const dirty = JSON.stringify([account, medical]) !== JSON.stringify([EMPTY_ACCOUNT, EMPTY_MEDICAL_FORM]);

  // Navigate only after the guard has re-rendered with the form marked as saved
  useEffect(() => {
    if (createdId) navigate(`/doctor/patient/${createdId}`);
  }, [createdId, navigate]);

  const enroll = useMutation({
    mutationFn: async () => {
      // The patient is linked to the signed-in doctor automatically
      const patient = await patientService.register({
        name: account.name.trim(),
        email: account.email.trim(),
        phone: account.phone.trim() || null,
        timeZone: account.timeZone.trim() || DEFAULT_TIME_ZONE,
      });
      const fields = Object.fromEntries(Object.entries(formToMedical(medical)).filter(([, v]) => v !== null));
      let medicalError: unknown = null;
      if (Object.keys(fields).length) {
        await patientService.updateMedical(patient.id, { version: 0, ...fields }).catch((err: unknown) => (medicalError = err));
      }
      return { patient, medicalError };
    },
    onSuccess: ({ patient, medicalError }) => {
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success(
        patient.invitation === 'SENT'
          ? `${patient.name} is enrolled. We’ve emailed them a link to set their password.`
          : `${patient.name} is enrolled, but the invitation email failed. Resend it from their chart.`
      );
      if (medicalError) toast.error(`The medical details weren’t saved: ${errorMessage(medicalError)} Add them from the chart.`);
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
          <p className="text-sm text-slate-600">Adds the patient to your caseload. They get an email to set their own password.</p>
        </div>
      </div>

      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="mt-6 space-y-6">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}

        <Section title="1. Account">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={form.errors.name}>
              <Input name="name" required maxLength={100} autoComplete="off" value={account.name} onChange={set('name')} />
            </Field>
            <Field label="Email address" error={form.errors.email} hint="They sign in with this">
              <Input name="email" type="email" required autoComplete="off" value={account.email} onChange={set('email')} />
            </Field>
            <Field label="Phone number (optional)" hint={PHONE_HINT} error={form.errors.phone}>
              <Input name="phone" type="tel" pattern={PHONE_PATTERN} autoComplete="off" value={account.phone} onChange={set('phone')} />
            </Field>
            <Field label="Time zone" hint="Decides when the patient’s day starts" error={form.errors.timeZone}>
              <Input name="timeZone" required value={account.timeZone} onChange={set('timeZone')} />
            </Field>
          </div>
        </Section>

        <Section title="2. Medical details (optional, can be added later)">
          <MedicalFieldsInputs value={medical} onChange={setMedical} errors={form.errors} />
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
