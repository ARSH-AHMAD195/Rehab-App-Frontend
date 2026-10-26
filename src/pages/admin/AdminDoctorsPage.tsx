import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, UserPlus } from 'lucide-react';
import { doctorService, resendInvitation } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { useFormErrors } from '../../lib/forms';
import { PHONE_HINT, PHONE_PATTERN } from '../../lib/constants';
import { formatDate } from '../../lib/format';
import { Alert, Badge, Button, ConfirmDialog, ErrorState, Field, Input, Modal, ModalActions, PageHeader, PageLoader } from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import type { Doctor } from '../../types/api';

const EMPTY_FORM = { name: '', email: '', phone: '', specialization: '' };

const RegisterDoctorModal = ({ onClose }: { onClose: () => void }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const [f, setF] = useState(EMPTY_FORM);
  const set = (field: keyof typeof EMPTY_FORM) => (e: ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [field]: e.target.value }));

  const register = useMutation({
    mutationFn: () => doctorService.register({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() || null, specialization: f.specialization.trim() || null }),
    onSuccess: (doc) => {
      toast.success(doc.invitation === 'SENT' ? `${doc.name}’s account is created. We’ve emailed them a link to set their password.` : `${doc.name}’s account is created, but the email failed. Resend it from the list.`);
      void queryClient.invalidateQueries({ queryKey: qk.doctors });
      onClose();
    },
    onError: (err) => form.fromApiError(err, 'Could not register the doctor. Please try again.'),
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.validate(e.currentTarget)) register.mutate();
  };

  return (
    <Modal title="Register a doctor" description="They get an email to set their own password" onClose={onClose} size="lg">
      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={form.errors.name}>
            <Input name="name" required maxLength={100} value={f.name} onChange={set('name')} placeholder="e.g. Dr Meera Nair" />
          </Field>
          <Field label="Email address" error={form.errors.email}>
            <Input name="email" type="email" required autoComplete="off" value={f.email} onChange={set('email')} />
          </Field>
          <Field label="Phone (optional)" hint={PHONE_HINT} error={form.errors.phone}>
            <Input name="phone" type="tel" pattern={PHONE_PATTERN} value={f.phone} onChange={set('phone')} />
          </Field>
          <Field label="Specialization (optional)" error={form.errors.specialization}>
            <Input name="specialization" maxLength={100} value={f.specialization} onChange={set('specialization')} placeholder="e.g. Surgical oncology" />
          </Field>
        </div>
        <ModalActions onCancel={onClose} submitLabel="Register doctor" loading={register.isPending} />
      </form>
    </Modal>
  );
};

export const AdminDoctorsPage = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [showRegister, setShowRegister] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<Doctor | null>(null);

  // ponytail: first 100 doctors only; add cursor paging when the clinic has more
  const doctors = useQuery({ queryKey: qk.doctors, queryFn: () => doctorService.list({ active: 'all', limit: 100 }).then((r) => r.data) });

  const toggle = useMutation({
    mutationFn: (doc: Doctor) => doctorService.update(doc.id, { active: !doc.active }),
    onSuccess: (doc) => {
      toast.success(`${doc.name} is ${doc.active ? 'reactivated' : 'deactivated'}.`);
      setPendingToggle(null);
      void queryClient.invalidateQueries({ queryKey: qk.doctors });
    },
    // e.g. 409 DOCTOR_HAS_PATIENTS: they're some active patient's only doctor
    onError: (err) => toast.error(errorMessage(err, 'Could not update the account.')),
  });

  const invite = useMutation({
    mutationFn: (doc: Doctor) => resendInvitation(doc.id),
    onSuccess: (r, doc) => (r.invitation === 'SENT' ? toast.success(`Set-password email sent to ${doc.name}.`) : toast.error('The email could not be sent. Try again later.')),
    onError: (err) => toast.error(errorMessage(err, 'Could not send the email.')),
  });

  if (doctors.isPending) return <PageLoader label="Loading doctor accounts…" />;
  if (doctors.isError) return <ErrorState error={doctors.error} onRetry={() => void doctors.refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctor accounts"
        description="Surgeons and prehabilitation clinicians"
        actions={
          <Button onClick={() => setShowRegister(true)}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Register a doctor
          </Button>
        }
      />

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="p-4">Doctor</th>
                <th scope="col" className="p-4">Specialization</th>
                <th scope="col" className="p-4">Patients</th>
                <th scope="col" className="p-4">Status</th>
                <th scope="col" className="p-4">Joined</th>
                <th scope="col" className="p-4 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doctors.data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-600">
                    No doctor accounts yet.
                  </td>
                </tr>
              ) : (
                doctors.data.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <span className="block font-semibold text-slate-900">{doc.name}</span>
                      <span className="text-slate-600">{doc.email}</span>
                    </td>
                    <td className="p-4 text-slate-700">{doc.specialization || '—'}</td>
                    <td className="p-4 text-slate-700">{doc.patientCount}</td>
                    <td className="p-4">
                      {!doc.active ? <Badge tone="rose">Deactivated</Badge> : doc.emailVerified ? <Badge tone="emerald">Active</Badge> : <Badge tone="amber">Invited</Badge>}
                    </td>
                    <td className="whitespace-nowrap p-4 text-slate-700">{formatDate(doc.createdAt)}</td>
                    <td className="whitespace-nowrap p-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => invite.mutate(doc)} loading={invite.isPending && invite.variables?.id === doc.id} aria-label={`Send set-password email to ${doc.name}`}>
                        <Mail className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button variant={doc.active ? 'danger' : 'success'} size="sm" onClick={() => setPendingToggle(doc)}>
                        {doc.active ? 'Deactivate' : 'Activate'}
                        <span className="sr-only"> {doc.name}</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showRegister && <RegisterDoctorModal onClose={() => setShowRegister(false)} />}

      {pendingToggle && (
        <ConfirmDialog
          title={pendingToggle.active ? 'Deactivate this account?' : 'Reactivate this account?'}
          message={
            pendingToggle.active
              ? `${pendingToggle.name} will be signed out straight away and lose access until reactivated.`
              : `${pendingToggle.name} will regain access to the platform.`
          }
          confirmLabel={pendingToggle.active ? 'Deactivate' : 'Reactivate'}
          tone={pendingToggle.active ? 'danger' : 'primary'}
          loading={toggle.isPending}
          onConfirm={() => toggle.mutate(pendingToggle)}
          onCancel={() => setPendingToggle(null)}
        />
      )}
    </div>
  );
};
