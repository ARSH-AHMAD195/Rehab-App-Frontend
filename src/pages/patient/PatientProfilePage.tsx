import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { profileService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { useFormErrors } from '../../lib/forms';
import { PHONE_HINT, PHONE_PATTERN } from '../../lib/constants';
import { formatDate, labelize } from '../../lib/format';
import { Alert, Button, Card, ErrorState, Field, Input, PageHeader, PageLoader, SectionTitle } from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import { UnsavedChangesGuard } from '../../components/UnsavedChangesGuard';
import type { EmergencyContact, MedicalProfile, Profile } from '../../types/api';

const Detail = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div>
    <dt className="text-sm font-semibold text-slate-600">{label}</dt>
    <dd className="text-base text-slate-900">{value || '—'}</dd>
  </div>
);

const EMPTY_CONTACT: EmergencyContact = { name: '', relation: '', phone: '' };
type ProfileForm = { name: string; phone: string; contact: EmergencyContact };
const formOf = (p: Profile, m: MedicalProfile): ProfileForm => ({ name: p.name, phone: p.phone ?? '', contact: m.emergencyContact ?? EMPTY_CONTACT });

export const PatientProfilePage = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const form = useFormErrors();
  const profile = useQuery({ queryKey: qk.myProfile, queryFn: profileService.getMine });
  const medical = useQuery({ queryKey: qk.myMedical, queryFn: profileService.getMyMedical });

  // The form is the server's data until the patient edits it, so a background refetch never wipes their typing
  const server = profile.data && medical.data ? formOf(profile.data, medical.data) : null;
  const [draft, setDraft] = useState<ProfileForm | null>(null);
  const f = draft ?? server ?? { name: '', phone: '', contact: EMPTY_CONTACT };
  const setF = (update: (current: ProfileForm) => ProfileForm) => setDraft(update(f));
  const dirty = draft !== null && server !== null && JSON.stringify(draft) !== JSON.stringify(server);

  const save = useMutation({
    mutationFn: async () => {
      const before = server!;
      if (f.name !== before.name || f.phone !== before.phone) {
        await profileService.updateMine({ name: f.name.trim(), phone: f.phone.trim() || null });
      }
      if (JSON.stringify(f.contact) !== JSON.stringify(before.contact)) {
        const c = { name: f.contact.name.trim(), relation: f.contact.relation.trim(), phone: f.contact.phone.trim() };
        await profileService.updateMyMedical({ version: medical.data!.version, emergencyContact: c.name || c.phone ? c : null });
      }
    },
    onSuccess: async () => {
      toast.success('Your details have been updated.');
      await queryClient.invalidateQueries({ queryKey: ['my'] });
      setDraft(null);
    },
    onError: (err) => form.fromApiError(err),
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.validate(e.currentTarget)) save.mutate();
  };

  if (profile.isPending || medical.isPending) return <PageLoader label="Loading your profile…" />;
  if (profile.isError || medical.isError) return <ErrorState error={profile.error ?? medical.error} onRetry={() => void Promise.all([profile.refetch(), medical.refetch()])} />;

  const p = profile.data;
  const m = medical.data;
  const setContact = (field: keyof EmergencyContact) => (e: { target: { value: string } }) => setF((s) => ({ ...s, contact: { ...s.contact, [field]: e.target.value } }));
  const contactRequired = Boolean(f.contact.name || f.contact.relation || f.contact.phone);

  return (
    <div className="space-y-6">
      <PageHeader title="My profile" description="Your details on record with your care team" />

      <Card>
        <SectionTitle title="Medical & surgical details" description="Recorded by your care team. To correct any of these, contact them." />
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="Email" value={p.email} />
          <Detail label="Care team" value={p.doctors?.map((d) => d.name).join(', ') || 'Not yet assigned'} />
          <Detail label="Date of birth" value={m.dateOfBirth && formatDate(m.dateOfBirth)} />
          <Detail label="Sex" value={m.sex && labelize(m.sex)} />
          <Detail label="Planned surgery" value={m.plannedSurgery} />
          <Detail label="Surgery date" value={m.plannedSurgeryDate && formatDate(m.plannedSurgeryDate)} />
          <Detail label="Diagnosis" value={m.diagnosis} />
          <Detail label="Allergies" value={m.allergies?.join(', ')} />
          <Detail label="Medications" value={m.medications?.join('; ')} />
          <Detail label="Other conditions" value={m.comorbidities?.join(', ')} />
          <Detail label="Time zone" value={p.timeZone} />
        </dl>
      </Card>

      <Card>
        <SectionTitle title="Contact details" description="Keep these up to date so your team can reach you and your emergency contact." />
        <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-5">
          {form.formError && <Alert tone="error">{form.formError}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name" error={form.errors.name}>
              <Input name="name" required maxLength={100} autoComplete="name" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} />
            </Field>
            <Field label="Your phone number" hint={PHONE_HINT} error={form.errors.phone}>
              <Input name="phone" type="tel" pattern={PHONE_PATTERN} autoComplete="tel" value={f.phone} onChange={(e) => setF((s) => ({ ...s, phone: e.target.value }))} />
            </Field>
          </div>

          <fieldset className="space-y-4 rounded-2xl border border-slate-200 p-4">
            <legend className="px-1 text-base font-bold text-slate-900">Emergency contact</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Name" error={form.errors['emergencyContact.name']}>
                <Input name="emergencyContact.name" required={contactRequired} maxLength={100} autoComplete="off" value={f.contact.name} onChange={setContact('name')} />
              </Field>
              <Field label="Relationship" error={form.errors['emergencyContact.relation']}>
                <Input name="emergencyContact.relation" required={contactRequired} maxLength={50} value={f.contact.relation} onChange={setContact('relation')} placeholder="e.g. Spouse" />
              </Field>
              <Field label="Phone" hint={PHONE_HINT} error={form.errors['emergencyContact.phone']}>
                <Input name="emergencyContact.phone" type="tel" required={contactRequired} pattern={PHONE_PATTERN} value={f.contact.phone} onChange={setContact('phone')} />
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
