import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';

/** Centered card layout shared by the sign-in and password-reset screens. */
export const AuthShell = ({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) => (
  <main className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-teal-50 via-slate-50 to-slate-100 px-4 py-12 sm:px-6 lg:px-8">
    <div className="sm:mx-auto sm:w-full sm:max-w-md">
      <Link to="/" className="mb-6 flex items-center justify-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-teal-800 to-teal-600 text-white shadow-lg">
          <Heart className="h-6 w-6 fill-white/20" aria-hidden="true" />
        </span>
        <span className="text-left">
          <span className="block text-xl font-extrabold leading-none tracking-tight text-slate-900">Fit for Surgery</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-800">Clinical Prehab Portal</span>
        </span>
      </Link>
      <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-center text-sm text-slate-600">{subtitle}</p>}
    </div>
    <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-xl shadow-slate-200/60">{children}</div>
    </div>
  </main>
);
