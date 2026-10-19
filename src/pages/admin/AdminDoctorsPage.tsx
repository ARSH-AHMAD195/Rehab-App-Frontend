import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { adminService, authService } from '../../services/apiServices';
import { errorMessage } from '../../services/api';
import { qk } from '../../lib/queryClient';
import { useFormErrors } from '../../lib/forms';
import { MIN } from '../../lib/constants';
import { formatDate, fullName } from '../../lib/format';
import { Alert, Badge, Button, ConfirmDialog, ErrorState, Field, Input, Modal, ModalActions, PageHeader, PageLoader } from '../../components/ui';
import { useToast } from '../../components/ui/toast';
import { TemporaryPasswordField } from '../../components/common/PasswordField';
import type { User } from '../../types/api';

const EMPTY_FORM = { firstName: '', lastName: '', email: '', phone: '', password: '', specialization: '', department: '', licenseNumber: '', hospitalAffiliation: '' };
type FormState = typeof EMPTY_FORM;

const RegisterDoctorModal = ({ onClose }: { onClose: () => void }) => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const form = useFormErrors();
  const [f, setF] = useState<FormState>(EMPTY_FORM);
  const set = (field: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [field]: e.target.value }));

  const register = useMutation({
    mutationFn: () => {
      const trimmed = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, k === 'password' ? v : v.trim()])) as FormState;
      return authService.registerDoctor(trimmed);
    },
    onSuccess: () => {
      toast.success(`Dr. ${f.lastName.trim()}'s account has been created.`);
      void queryClient.invalidateQueries({ queryKey: qk.doctors });
      void queryClient.invalidateQueries({ queryKey: qk.analytics });
      onClose();
    },
    onError: (err) => form.fromApiError(err, 'Could not register the doctor. Please try again.'),
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.validate(e.currentTarget)) register.mutate();
  };

  return (
    <Modal title="Register a doctor" description="Grants access to manage prehab patients and prescribe exercises" onClose={onClose} size="xl">
      <form noValidate onSubmit={handleSubmit} onChange={form.onChange} className="space-y-4">
        {form.formError && <Alert tone="error">{form.formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" error={form.errors.firstName}>
            <Input name="firstName" required minLength={MIN.name} value={f.firstName} onChange={set('firstName')} />
          </Field>
          <Field label="Last name" error={form.errors.lastName}>
            <Input name="lastName" required minLength={MIN.name} value={f.lastName} onChange={set('lastName')} />
          </Field>
          <Field label="Email address" error={form.errors.email}>
            <Input name="email" type="email" required autoComplete="off" value={f.email} onChange={set('email')} />
          </Field>
          <Field label="Phone (optional)" error={form.errors.phone}>
            <Input name="phone" type="tel" value={f.phone} onChange={set('phone')} />
          </Field>
          <Field label="Specialization" error={form.errors.specialization}>
            <Input name="specialization" required minLength={MIN.name} value={f.specialization} onChange={set('specialization')} placeholder="e.g. Cardiothoracic surgery" />
          </Field>
          <Field label="Department" error={form.errors.department}>
            <Input name="department" required minLength={MIN.name} value={f.department} onChange={set('department')} placeholder="e.g. Surgical services" />
          </Field>
          <Field label="Medical license number" error={form.errors.licenseNumber}>
            <Input name="licenseNumber" required minLength={MIN.licenseNumber} value={f.licenseNumber} onChange={set('licenseNumber')} />
          </Field>
          <Field label="Hospital affiliation (optional)">
            <Input name="hospitalAffiliation" value={f.hospitalAffiliation} onChange={set('hospitalAffiliation')} />
          </Field>
        </div>
        <TemporaryPasswordField value={f.password} error={form.errors.password} onChange={(password) => setF((p) => ({ ...p, password }))} />
        <ModalActions onCancel={onClose} submitLabel="Register doctor" loading={register.isPending} />
      </form>
    </Modal>
  );
};

export const AdminDoctorsPage = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [showRegister, setShowRegister] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<User | null>(null);

  const doctors = useQuery({ queryKey: qk.doctors, queryFn: () => adminService.getUsers({ role: 'doctor' }).then((r) => r.users) });

  const toggle = useMutation({
    mutationFn: (doc: User) => adminService.toggleUserStatus(doc._id),
    onSuccess: (res) => {
      toast.success(res.message ?? 'Account updated.');
      setPendingToggle(null);
      void queryClient.invalidateQueries({ queryKey: qk.doctors });
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not update the account status.')),
  });

  if (doctors.isPending) return <PageLoader label="Loading doctor accounts…" />;
  if (doctors.isError) return <ErrorState error={doctors.error} onRetry={() => void doctors.refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctor accounts"
        description="Authorized surgeons and prehabilitation clinicians"
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
                <th scope="col" className="p-4">Email</th>
                <th scope="col" className="p-4">Status</th>
                <th scope="col" className="p-4">Last sign-in</th>
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
                  <tr key={doc._id} className="hover:bg-slate-50">
                    <td className="p-4 font-semibold text-slate-900">Dr. {fullName(doc)}</td>
                    <td className="p-4 text-slate-700">{doc.email}</td>
                    <td className="p-4">
                      <Badge tone={doc.isActive ? 'emerald' : 'rose'}>{doc.isActive ? 'Active' : 'Deactivated'}</Badge>
                    </td>
                    <td className="whitespace-nowrap p-4 text-slate-700">{doc.lastLogin ? formatDate(doc.lastLogin) : 'Never'}</td>
                    <td className="whitespace-nowrap p-4 text-slate-700">{formatDate(doc.createdAt)}</td>
                    <td className="p-4 text-right">
                      <Button variant={doc.isActive ? 'danger' : 'success'} size="sm" onClick={() => setPendingToggle(doc)}>
                        {doc.isActive ? 'Deactivate' : 'Activate'}
                        <span className="sr-only"> Dr. {fullName(doc)}</span>
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
          title={pendingToggle.isActive ? 'Deactivate this account?' : 'Reactivate this account?'}
          message={
            pendingToggle.isActive
              ? `Dr. ${fullName(pendingToggle)} will be signed out and lose access to their patients until reactivated.`
              : `Dr. ${fullName(pendingToggle)} will regain access to the platform.`
          }
          confirmLabel={pendingToggle.isActive ? 'Deactivate' : 'Reactivate'}
          tone={pendingToggle.isActive ? 'danger' : 'primary'}
          loading={toggle.isPending}
          onConfirm={() => toggle.mutate(pendingToggle)}
          onCancel={() => setPendingToggle(null)}
        />
      )}
    </div>
  );
};
