import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Dumbbell, FileText, Shield, Stethoscope } from 'lucide-react';
import { adminService } from '../../services/apiServices';
import { qk } from '../../lib/queryClient';
import { ErrorState, PageLoader, StatCard, buttonClass } from '../../components/ui';

const ACTIONS = [
  { to: '/admin/doctors', icon: Stethoscope, title: 'Doctor accounts', text: 'Register clinicians, review license details and manage account access.', cta: 'Manage doctors' },
  { to: '/admin/exercises', icon: Dumbbell, title: 'Exercise library', text: 'Maintain the prehab exercise catalog, instructional videos and contraindications.', cta: 'Configure catalog' },
  { to: '/admin/audit-logs', icon: Shield, title: 'Compliance audit', text: 'Review sign-ins, patient record access, exports and administrative events.', cta: 'Review audit logs' },
];

export const AdminDashboard = () => {
  const stats = useQuery({ queryKey: qk.analytics, queryFn: () => adminService.getAnalytics().then((r) => r.analytics) });

  if (stats.isPending) return <PageLoader label="Loading platform overview…" />;
  if (stats.isError) return <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />;
  const s = stats.data;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-navy-950 via-navy-900 to-teal-950 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-teal-100">
              <Shield className="h-4 w-4" aria-hidden="true" />
              Platform administration
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">System overview</h1>
            <p className="max-w-xl text-base text-slate-200">Platform usage, the exercise catalog, clinical staff and the compliance audit trail.</p>
          </div>
          <Link to="/admin/audit-logs" className={buttonClass('secondary', 'md', 'shrink-0 border-0 font-bold text-slate-900')}>
            <FileText className="h-4 w-4 text-teal-800" aria-hidden="true" />
            Audit logs
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Patients" value={s.totalPatients} hint="Enrolled" />
        <StatCard label="Doctors" value={s.totalDoctors} hint="Registered" />
        <StatCard label="Active exercises" value={s.totalActiveExercises} hint="In library" />
        <StatCard label="Sessions logged" value={s.totalSessions} hint={`${s.sessionsLast7Days} in last 7 days`} tone="teal" />
        <StatCard label="Measurements" value={s.totalMeasurements} hint={`${s.measurementsLast7Days} in last 7 days`} />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {ACTIONS.map(({ to, icon: Icon, title, text, cta }) => (
          <Link key={to} to={to} className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-xs transition-colors hover:border-teal-400">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-800">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-700">{text}</p>
            <span className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-teal-800">
              {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};
