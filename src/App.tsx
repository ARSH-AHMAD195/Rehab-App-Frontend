import { useState } from 'react';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, ScrollRestoration, useNavigation, type RouteObject } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/toast';
import { PageLoader } from './components/ui';
import { RouteError } from './components/RouteError';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { OfflineBanner, PwaPrompts } from './components/pwa/PwaPrompts';
import { queryClient } from './lib/queryClient';
import { USE_MOCK } from './services/api';
import type { Role } from './types/api';

// Each page is its own chunk: patients never download admin screens or charting code they don't use.
// While a chunk loads the current page stays visible (with a progress bar) instead of a blank spinner.
const page = <M extends Record<string, unknown>>(load: () => Promise<M>, name: keyof M): Pick<RouteObject, 'lazy'> => ({
  lazy: () => load().then((m) => ({ Component: m[name] as React.ComponentType })),
});

const roleArea = (role: Role, children: RouteObject[]): RouteObject => ({
  path: `/${role}`,
  element: (
    <ProtectedRoute allowedRoles={[role]}>
      <DashboardLayout />
    </ProtectedRoute>
  ),
  children: [{ index: true, element: <Navigate to="dashboard" replace /> }, ...children],
});

const RootLayout = () => {
  const navigation = useNavigation();
  return (
    <>
      {USE_MOCK && (
        <p className="bg-amber-100 px-4 py-1 text-center text-xs font-semibold text-amber-950 print:hidden">
          Demo mode: mock API, data is stored in this browser only. Not for real patient data.
        </p>
      )}
      <OfflineBanner />
      {navigation.state === 'loading' && (
        <div className="fixed inset-x-0 top-0 z-[70] h-1 animate-pulse bg-teal-600" role="progressbar" aria-label="Loading page" />
      )}
      <Outlet />
      <PwaPrompts />
      <ScrollRestoration />
    </>
  );
};

const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageLoader />,
    children: [
      { path: '/', ...page(() => import('./pages/LandingPage'), 'LandingPage') },
      { path: '/login', ...page(() => import('./pages/LoginPage'), 'LoginPage') },
      { path: '/forgot-password', ...page(() => import('./pages/ForgotPasswordPage'), 'ForgotPasswordPage') },
      roleArea('patient', [
        { path: 'dashboard', ...page(() => import('./pages/patient/PatientDashboard'), 'PatientDashboard') },
        { path: 'exercises', ...page(() => import('./pages/patient/PatientExercisesPage'), 'PatientExercisesPage') },
        { path: 'health-tracker', ...page(() => import('./pages/patient/PatientHealthTrackerPage'), 'PatientHealthTrackerPage') },
        { path: 'report', ...page(() => import('./pages/patient/PatientReportPage'), 'PatientReportPage') },
        { path: 'profile', ...page(() => import('./pages/patient/PatientProfilePage'), 'PatientProfilePage') },
      ]),
      roleArea('doctor', [
        { path: 'dashboard', ...page(() => import('./pages/doctor/DoctorDashboard'), 'DoctorDashboard') },
        { path: 'patients', ...page(() => import('./pages/doctor/DoctorPatientsPage'), 'DoctorPatientsPage') },
        { path: 'patient/:id', ...page(() => import('./pages/doctor/DoctorPatientDetailPage'), 'DoctorPatientDetailPage') },
        { path: 'onboard-patient', ...page(() => import('./pages/doctor/DoctorOnboardPatientPage'), 'DoctorOnboardPatientPage') },
        { path: 'exercises', ...page(() => import('./pages/doctor/DoctorExercisesPage'), 'DoctorExercisesPage') },
      ]),
      roleArea('admin', [
        { path: 'dashboard', ...page(() => import('./pages/admin/AdminDashboard'), 'AdminDashboard') },
        { path: 'doctors', ...page(() => import('./pages/admin/AdminDoctorsPage'), 'AdminDoctorsPage') },
        { path: 'exercises', ...page(() => import('./pages/admin/AdminExercisesPage'), 'AdminExercisesPage') },
        { path: 'audit-logs', ...page(() => import('./pages/admin/AdminAuditLogsPage'), 'AdminAuditLogsPage') },
      ]),
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];

const ROUTER_FUTURE = {
  v7_relativeSplatPath: true,
  v7_fetcherPersist: true,
  v7_normalizeFormMethod: true,
  v7_partialHydration: true,
  v7_skipActionErrorRevalidation: true,
} as const;

export default function App() {
  // Created on mount (not at import) so it starts from the current URL, which tests rely on.
  const [router] = useState(() => createBrowserRouter(routes, { future: ROUTER_FUTURE }));

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} future={{ v7_startTransition: true }} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
