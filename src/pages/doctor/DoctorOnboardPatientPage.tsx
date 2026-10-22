import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { authService } from '../../services/authService';
import { useFormErrors } from '../../lib/forms';
import { MIN } from '../../lib/constants';
import { dateInputToIso, localDateKey } from '../../lib/format';
import { Alert, Button, Card, Field, Input, Select } from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import { TemporaryPasswordField } from '../../components/common/PasswordField';
import { UnsavedChangesGuard } from '../../components/UnsavedChangesGuard';

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  surgeryType: '',
  surgeryDate: '',
  hospitalNumber: '',
  medicalConditions: '',
  password: '',
  emergencyName: '',
  emergencyRelationship: '',
  emergencyPhone: '',
};
type FormState = typeof EMPTY_FORM;

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
  const [f, setF] = useState<FormState>(EMPTY_FORM);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const today = localDateKey();

  const set = (field: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [field]: e.target.value }));
  const dirty = Object.values(f).some((v) => v !== '');

  // Navigate only after the guard has re-rendered with the form marked as saved
  useEffect(() => {
    if (createdId) navigate(`/doctor/patient/${createdId}`);
  }, [createdId, navigate]);

  const enroll = useMutation({
    mutationFn: () =>
      authService.registerPatient({
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        email: f.email.trim(),
        password: f.password,
        phone: f.phone.trim(),
        dateOfBirth: dateInputToIso(f.dateOfBirth),
        gender: f.gender,
        surgeryType: f.surgeryType.trim(),
        surgeryDate: dateInputToIso(f.surgeryDate),
        hospitalNumber: f.hospitalNumber.trim(),
        medicalConditions: f.medicalConditions.split(',').map((s) => s.trim()).filter(Boolean),
        emergencyContact: { name: f.emergencyName.trim(), relationship: f.emergencyRelationship.trim(), phone: f.emergencyPhone.trim() },
      }),
    onSuccess: (res) => {
      toast.success(`${f.firstName} ${f.lastName} has been enrolled.`);
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
      setCreatedId(res.patient._id);
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
          <p className="text-sm text-slate-600">Adds the patient to your caseload with prehabilitation tracking</p>
        </div>
      </div>

      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="mt-6 space-y-6">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}

        <Section title="1. Patient details">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" error={form.errors.firstName}>
              <Input name="firstName" required minLength={MIN.name} maxLength={80} autoComplete="off" value={f.firstName} onChange={set('firstName')} />
            </Field>
            <Field label="Last name" error={form.errors.lastName}>
              <Input name="lastName" required minLength={MIN.name} maxLength={80} autoComplete="off" value={f.lastName} onChange={set('lastName')} />
            </Field>
            <Field label="Email address" error={form.errors.email} hint="Used to sign in">
              <Input name="email" type="email" required autoComplete="off" value={f.email} onChange={set('email')} />
            </Field>
            <Field label="Phone number (optional)" error={form.errors.phone}>
              <Input name="phone" type="tel" autoComplete="off" value={f.phone} onChange={set('phone')} />
            </Field>
            <Field label="Date of birth" error={form.errors.dateOfBirth}>
              <Input name="dateOfBirth" type="date" required max={today} min="1900-01-01" value={f.dateOfBirth} onChange={set('dateOfBirth')} />
            </Field>
            <Field label="Gender" error={form.errors.gender}>
              <Select name="gender" required value={f.gender} onChange={set('gender')}>
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </Field>
          </div>
        </Section>

        <Section title="2. Surgery">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Procedure" error={form.errors.surgeryType}>
              <Input name="surgeryType" required minLength={MIN.surgeryType} maxLength={200} value={f.surgeryType} onChange={set('surgeryType')} placeholder="e.g. Laparoscopic colorectal resection" />
            </Field>
            <Field label="Surgery date" error={form.errors.surgeryDate}>
              <Input name="surgeryDate" type="date" required min={today} value={f.surgeryDate} onChange={set('surgeryDate')} />
            </Field>
            <Field label="Hospital record number (optional)" error={form.errors.hospitalNumber}>
              <Input name="hospitalNumber" maxLength={50} value={f.hospitalNumber} onChange={set('hospitalNumber')} />
            </Field>
            <Field label="Medical conditions (optional)" hint="Separate with commas">
              <Input name="medicalConditions" value={f.medicalConditions} onChange={set('medicalConditions')} placeholder="e.g. Hypertension, Type 2 diabetes" />
            </Field>
            <div className="sm:col-span-2">
              <TemporaryPasswordField value={f.password} error={form.errors.password} onChange={(password) => setF((p) => ({ ...p, password }))} />
            </div>
          </div>
        </Section>

        <Section title="3. Emergency contact (optional)">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name">
              <Input name="emergencyContact.name" value={f.emergencyName} onChange={set('emergencyName')} />
            </Field>
            <Field label="Relationship">
              <Input name="emergencyContact.relationship" value={f.emergencyRelationship} onChange={set('emergencyRelationship')} placeholder="e.g. Spouse" />
            </Field>
            <Field label="Phone">
              <Input name="emergencyContact.phone" type="tel" value={f.emergencyPhone} onChange={set('emergencyPhone')} />
            </Field>
          </div>
        </Section>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={() => navigate('/doctor/patients')}>
            Cancel
          </Button>
          <Button type="submit" loading={enroll.isPending}>
            Enroll patient
          </Button>
        </div>
      </form>

      <UnsavedChangesGuard when={dirty && !createdId && !enroll.isPending} />
    </Card>
  );
};
