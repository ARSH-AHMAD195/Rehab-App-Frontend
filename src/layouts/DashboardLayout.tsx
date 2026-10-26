import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Dumbbell, Heart, LogOut, Stethoscope, UserCircle, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { useSignedInUser, useAuth } from '../context/AuthContext';
import { MedicalDisclaimer } from '../components/common/MedicalDisclaimer';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { IdleLogout } from '../components/IdleLogout';
import { InstallButton } from '../components/pwa/PwaPrompts';
import { cn } from '../lib/cn';
import { initials } from '../lib/format';
import type { Role } from '../types/api';

type NavItem = { label: string; short?: string; to: string; icon: LucideIcon };

const NAV: Record<Role, NavItem[]> = {
  patient: [
    { label: 'Today', to: '/patient/dashboard', icon: Activity },
    { label: 'My Exercises', short: 'Exercises', to: '/patient/exercises', icon: Dumbbell },
    { label: 'Health Tracker', short: 'Vitals', to: '/patient/health-tracker', icon: Heart },
    { label: 'My Profile', short: 'Me', to: '/patient/profile', icon: UserCircle },
  ],
  doctor: [
    { label: 'Clinical Dashboard', short: 'Dashboard', to: '/doctor/dashboard', icon: Activity },
    { label: 'Assigned Patients', short: 'Patients', to: '/doctor/patients', icon: Users },
    { label: 'Onboard Patient', short: 'Onboard', to: '/doctor/onboard-patient', icon: UserPlus },
    { label: 'Exercise Catalog', short: 'Exercises', to: '/doctor/exercises', icon: Dumbbell },
  ],
  admin: [
    { label: 'System Overview', short: 'Overview', to: '/admin/dashboard', icon: Activity },
    { label: 'Exercise Library', short: 'Exercises', to: '/admin/exercises', icon: Dumbbell },
    { label: 'Doctor Accounts', short: 'Doctors', to: '/admin/doctors', icon: Stethoscope },
  ],
};

const ROLE_BADGE: Record<Role, string> = {
  patient: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  doctor: 'bg-teal-50 text-teal-900 border-teal-200',
  admin: 'bg-indigo-50 text-indigo-800 border-indigo-200',
};

/** Phones and tablets: app-style bottom tabs instead of a hidden menu (lg+ uses the sidebar). */
const BottomTabs = ({ items }: { items: NavItem[] }) => (
  <nav
    aria-label="Main"
    className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-md lg:hidden print:hidden"
  >
    <ul className="flex">
      {items.map(({ label, short, to, icon: Icon }) => (
        <li key={to} className="flex-1">
          <NavLink
            to={to}
            className={({ isActive }) =>
              cn(
                'flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors',
                isActive ? 'text-teal-800' : 'text-slate-600 hover:text-slate-900'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('flex h-8 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-teal-100')}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                {short ?? label}
              </>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  </nav>
);

const NavItems = ({ items }: { items: NavItem[] }) =>
  items.map(({ label, to, icon: Icon }) => (
    <NavLink
      key={to}
      to={to}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-base font-medium transition-colors',
          isActive ? 'bg-teal-50 font-semibold text-teal-900' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
        )
      }
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  ));

export const DashboardLayout = () => {
  const user = useSignedInUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // Move focus to the new page on navigation so screen readers announce it
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [pathname]);

  const role = user.role;
  const navItems = NAV[role];

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const logoutButton = (className: string) => (
    <button
      type="button"
      onClick={handleLogout}
      className={cn('flex min-h-10 items-center gap-2 rounded-xl text-sm font-medium text-slate-700 transition-colors hover:bg-rose-50 hover:text-rose-700', className)}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      <span>Sign out</span>
    </button>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg">
        Skip to main content
      </a>

      <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex print:hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-800 to-teal-600 text-white shadow-md">
            <Heart className="h-5 w-5 fill-white/20" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-bold leading-none tracking-tight text-slate-900">Fit for Surgery</p>
            <span className="text-xs font-semibold uppercase tracking-wide text-teal-800">Prehabilitation</span>
          </div>
        </div>

        <div className="mx-3 my-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 font-bold text-white">{initials(user.name)}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-slate-900">{user.name}</p>
              <span
                className={cn(
                  'inline-block rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wide',
                  ROLE_BADGE[role]
                )}
              >
                {role}
              </span>
            </div>
          </div>
        </div>

        <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto px-3">
          <NavItems items={navItems} />
        </nav>

        <div className="space-y-2 border-t border-slate-100 p-4">
          <InstallButton className="w-full" />
          {logoutButton('w-full justify-center px-3 py-2')}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-6 print:hidden">
          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-slate-900 lg:hidden">Fit for Surgery</span>
            <p className="hidden text-base font-semibold text-slate-800 lg:block">Welcome back, {user.name.split(' ')[0]}</p>
          </div>

          <div className="flex items-center gap-2">
            <InstallButton className="lg:hidden" />
            {logoutButton('px-3')}
          </div>
        </header>

        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          // Bottom padding leaves room for the floating navbar (and the floating action button above it)
          className="mx-auto w-full max-w-7xl flex-1 p-4 pb-[calc(10rem+env(safe-area-inset-bottom))] focus:outline-none sm:p-6 sm:pb-[calc(10rem+env(safe-area-inset-bottom))] lg:p-8 print:p-0"
        >
          <div className="print:hidden">
            <MedicalDisclaimer />
          </div>
          {/* Keyed by path so navigating away from a crashed page recovers */}
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <BottomTabs items={navItems} />
      <IdleLogout />
    </div>
  );
};
