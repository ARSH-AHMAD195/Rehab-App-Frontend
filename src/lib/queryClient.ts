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
  vitalTypes: ['vitalTypes'] as const,
  categories: (includeInactive = false) => ['categories', includeInactive] as const,
  myProfile: ['my', 'profile'] as const,
  myMedical: ['my', 'medical'] as const,
  myPlan: ['my', 'plan'] as const,
  myChecklist: ['my', 'checklist'] as const,
  myCompletions: ['my', 'completions'] as const,
  myToday: ['my', 'vitals', 'today'] as const,
  myLogs: ['my', 'vitals', 'logs'] as const,
  myTrend: (type: string, period: string) => ['my', 'vitals', 'trend', type, period] as const,
  patients: (params: object) => ['patients', params] as const,
  alerts: (params: object) => ['alerts', params] as const,
  patient: (id: string) => ['patient', id] as const,
  patientPart: (id: string, ...part: string[]) => ['patient', id, ...part] as const,
  library: (params: object) => ['library', params] as const,
  doctors: ['admin', 'doctors'] as const,
};
