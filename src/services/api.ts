// HTTP client for the three Fit for Surgery APIs (Auth, Health Monitoring, Exercise).
//
// Every request carries the signed-in user's Firebase ID token as a Bearer token; the
// Firebase SDK keeps it fresh. The APIs work out who the user is from that token alone.
import type { ErrorBody } from '../types/api';
import { firebaseAuth } from '../lib/firebase';

const base = (url: string | undefined) => (url || '').replace(/\/$/, '');
const AUTH_API_URL = base(import.meta.env.VITE_AUTH_API_URL);
const HEALTH_API_URL = base(import.meta.env.VITE_HEALTH_API_URL);
const EXERCISE_API_URL = base(import.meta.env.VITE_EXERCISE_API_URL);

const HEALTH_PATHS = /^\/(vital-types|me\/vitals|doctor\/|admin\/(alert-thresholds|vital-types))/;
const EXERCISE_PATHS = /^\/(exercise-categories|exercises|exercise-completions|patients\/[^/]+\/exercise-)/;

/** Which API serves a path. Everything not vitals or exercises belongs to Auth. */
export const apiBaseFor = (path: string) =>
  HEALTH_PATHS.test(path) ? HEALTH_API_URL : EXERCISE_PATHS.test(path) ? EXERCISE_API_URL : AUTH_API_URL;

// The free hosting plan sleeps when idle and takes up to a minute to wake.
const TIMEOUT_MS = 70_000;

export class ApiError extends Error {
  readonly status: number;
  /** Stable machine code, e.g. VALIDATION_FAILED, NOT_FOUND, DAY_CHANGED. Branch on this, not the message. */
  readonly code: string;
  readonly data: Partial<ErrorBody> | null;

  constructor(status: number, message: string, data: Partial<ErrorBody> | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = data?.code ?? (status === 0 ? 'NETWORK' : 'UNKNOWN');
    this.data = data;
  }

  /** Per-field messages from a 400 VALIDATION_FAILED, keyed by field path. */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.data?.details ?? []).map((d) => [d.field, d.issue]));
  }
}

let unauthorizedHandler: () => void = () => {};
export const onUnauthorized = (handler: () => void) => {
  unauthorizedHandler = handler;
};

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  body?: unknown;
  params?: QueryParams;
  /** Makes a save safe to retry after a timeout: the API won't count it twice. */
  idempotencyKey?: string;
}

const toQuery = (params: QueryParams = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
};

const request = async <T>(method: string, path: string, { body, params, idempotencyKey }: RequestOptions = {}): Promise<T> => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  let res: Response;
  try {
    const token = await firebaseAuth.currentUser?.getIdToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    res = await fetch(`${apiBaseFor(path)}${path}${toQuery(params)}`, {
      method,
      headers,
      cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new ApiError(
      0,
      (err as Error).name === 'TimeoutError'
        ? 'The server took too long to respond. Please try again.'
        : 'Unable to reach the server. Check your connection and try again.'
    );
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as Partial<ErrorBody> | null;
    const error = new ApiError(res.status, data?.message || `Request failed (${res.status}).`, data);
    if (res.status === 401) unauthorizedHandler();
    throw error;
  }
  return (res.status === 204 ? null : res.json()) as Promise<T>;
};

export const api = {
  get: <T>(path: string, params?: QueryParams) => request<T>('GET', path, { params }),
  post: <T>(path: string, body?: unknown, idempotencyKey?: string) => request<T>('POST', path, { body, idempotencyKey }),
  put: <T>(path: string, body?: unknown, idempotencyKey?: string) => request<T>('PUT', path, { body, idempotencyKey }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

const FRIENDLY: Record<string, string> = {
  DAY_CHANGED: 'The day has changed since you opened this. Please reload and try again.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  FORBIDDEN_ROLE: 'Your account can’t do this.',
  EMAIL_NOT_VERIFIED: 'Your email address isn’t verified yet. Use the link in your invitation email.',
};

export const errorMessage = (err: unknown, fallback = 'Something went wrong. Please try again.') =>
  err instanceof ApiError ? (FRIENDLY[err.code] ?? err.message) : fallback;
