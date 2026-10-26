import { Link } from 'react-router-dom';
import { ArrowRight, Dumbbell, Shield, Stethoscope } from 'lucide-react';

const ACTIONS = [
  { to: '/admin/doctors', icon: Stethoscope, title: 'Doctor accounts', text: 'Register clinicians and switch accounts off or back on.', cta: 'Manage doctors' },
  { to: '/admin/exercises', icon: Dumbbell, title: 'Exercise library', text: 'Maintain the exercise catalog, step-by-step instructions and YouTube demonstration videos.', cta: 'Manage the library' },
];

export const AdminDashboard = () => (
  <div className="space-y-6">
    <div className="rounded-3xl bg-gradient-to-r from-navy-950 via-navy-900 to-teal-950 p-6 text-white shadow-xl sm:p-8">
      <div className="space-y-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-teal-100">
          <Shield className="h-4 w-4" aria-hidden="true" />
          Platform administration
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Administration</h1>
        <p className="max-w-xl text-base text-slate-200">Clinical staff accounts and the exercise library.</p>
      </div>
    </div>

    <div className="grid gap-6 md:grid-cols-2">
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
