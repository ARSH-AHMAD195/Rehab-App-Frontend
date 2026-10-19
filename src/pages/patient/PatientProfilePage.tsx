import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { patientService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { useFormErrors } from '../../lib/forms';
import { formatDate, fullName, labelize } from '../../lib/format';
import { Alert, Button, Card, ErrorState, Field, Input, PageHeader, PageLoader, SectionTitle } from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import { UnsavedChangesGuard } from '../../components/UnsavedChangesGuard';
import type { EmergencyContact } from '../../types/api';

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-sm font-semibold text-slate-600">{label}</dt>
    <dd className="text-base text-slate-900">{value || '—'}</dd>
  </div>
);

export const PatientProfilePage = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const form = useFormErrors();
  const profile = useQuery({ queryKey: qk.myProfile, queryFn: patientService.getMyProfile });

  const [phone, setPhone] = useState('');
  const [contact, setContact] = useState<EmergencyContact>({ name: '', relationship: '', phone: '' });
  const [initial, setInitial] = useState('');

  // Seed the form once the profile arrives
  useEffect(() => {
    if (!profile.data) return;
    const saved = profile.data.profile.emergencyContact;
    const ec: EmergencyContact = { name: saved?.name ?? '', relationship: saved?.relationship ?? '', phone: saved?.phone ?? '' };
    setPhone(profile.data.user.phone ?? '');
    setContact(ec);
    setInitial(JSON.stringify([profile.data.user.phone ?? '', ec]));
  }, [profile.data]);

  const dirty = initial !== '' && JSON.stringify([phone, contact]) !== initial;

  const save = useMutation({
    mutationFn: () => patientService.updateMyProfile({ phone: phone.trim(), emergencyContact: contact }),
    onSuccess: () => {
      toast.success('Your contact details have been updated.');
      setInitial(JSON.stringify([phone, contact]));
      void queryClient.invalidateQueries({ queryKey: qk.myProfile });
    },
    onError: (err) => form.fromApiError(err),
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.validate(e.currentTarget)) save.mutate();
  };

  if (profile.isPending) return <PageLoader label="Loading your profile…" />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;

  const { user, profile: p } = profile.data;
  const setContactField = (field: keyof EmergencyContact) => (e: { target: { value: string } }) => setContact((c) => ({ ...c, [field]: e.target.value }));

  return (
    <div className="space-y-6">
      <PageHeader title="My profile" description="Your details on record with your care team" />

      <Card>
        <SectionTitle title="Personal & surgical details" description="To correct any of these, contact your care team." />
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Name" value={fullName(user)} />
          <Detail label="Email" value={user.email} />
          <Detail label="Date of birth" value={formatDate(p.dateOfBirth)} />
          <Detail label="Hospital ID" value={p.hospitalNumber} />
          <Detail label="Procedure" value={p.surgeryType} />
          <Detail label="Surgery date" value={formatDate(p.surgeryDate)} />
          <Detail label="Clinician" value={p.assignedDoctor ? `Dr. ${fullName(p.assignedDoctor)}` : 'Not yet assigned'} />
          <Detail label="Mobility" value={labelize(p.baselineMobility)} />
        </dl>
      </Card>

      <Card>
        <SectionTitle title="Contact details" description="Keep these up to date so your team can reach you and your emergency contact." />
        <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-5">
          {form.formError && <Alert tone="error">{form.formError}</Alert>}
          <Field label="Your phone number" error={form.errors.phone}>
            <Input name="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>

          <fieldset className="space-y-4 rounded-2xl border border-slate-200 p-4">
            <legend className="px-1 text-base font-bold text-slate-900">Emergency contact</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Name" error={form.errors['emergencyContact.name']}>
                <Input name="emergencyContact.name" autoComplete="off" value={contact.name} onChange={setContactField('name')} />
              </Field>
              <Field label="Relationship">
                <Input name="emergencyContact.relationship" value={contact.relationship} onChange={setContactField('relationship')} placeholder="e.g. Spouse" />
              </Field>
              <Field label="Phone" error={form.errors['emergencyContact.phone']}>
                <Input name="emergencyContact.phone" type="tel" value={contact.phone} onChange={setContactField('phone')} />
              </Field>
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to="/forgot-password" className="text-sm font-semibold text-teal-800 hover:underline">
              Change my password
            </Link>
            <Button type="submit" loading={save.isPending} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-700">Using a shared device? Sign out when you’re done.</p>
        <Button
          variant="danger"
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </Button>
      </Card>

      <UnsavedChangesGuard when={dirty && !save.isPending} />
    </div>
  );
};
