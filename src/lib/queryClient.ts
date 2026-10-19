import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../services/api';

const isRetryable = (error: unknown) => !(error instanceof ApiError) || error.status === 0 || error.status >= 500;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Client errors (401/403/404/400) won't fix themselves; only retry network/server failures
      retry: (failureCount, error) => isRetryable(error) && failureCount < 2,
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Fail fast offline with a clear error instead of silently pausing a clinical write
      networkMode: 'always',
      retry: false,
    },
  },
});

/** Query keys. Prefix-invalidation (e.g. ['patient', id]) refreshes everything for that patient. */
export const qk = {
  me: ['me'] as const,
  myProfile: ['my', 'profile'] as const,
  myAssignments: ['my', 'assignments'] as const,
  mySessions: (days: number) => ['my', 'sessions', days] as const,
  myMeasurements: (params: object) => ['my', 'measurements', params] as const,
  myConsents: ['my', 'consents'] as const,
  myFollowUps: ['my', 'followUps'] as const,
  myTimeline: ['my', 'timeline'] as const,
  myReport: (period: string) => ['my', 'report', period] as const,
  notifications: ['notifications'] as const,
  patients: (params: object) => ['patients', params] as const,
  alerts: ['alerts'] as const,
  patient: (id: string) => ['patient', id] as const,
  patientPart: (id: string, part: string) => ['patient', id, part] as const,
  library: (params: object) => ['library', params] as const,
  analytics: ['admin', 'analytics'] as const,
  doctors: ['admin', 'doctors'] as const,
  auditLogs: (params: object) => ['admin', 'audit', params] as const,
};
