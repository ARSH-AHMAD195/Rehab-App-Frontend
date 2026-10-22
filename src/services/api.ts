// HTTP client for the Fit for Surgery REST API.
//
// Auth rides on the backend's httpOnly `token` cookie (credentials: 'include'), so no
// credential is ever readable from JavaScript. With VITE_USE_MOCK=true, requests are served
// by the in-browser mock in src/mocks instead (dev/demo only; excluded from production builds).
import type { ValidationErrorBody } from '../types/api';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
const TIMEOUT_MS = 30_000;
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export class ApiError extends Error {
  readonly status: number;
  readonly data: Partial<ValidationErrorBody> | null;

  constructor(status: number, message: string, data: Partial<ValidationErrorBody> | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }

  /** Per-field messages from the backend's 400 validation response, keyed by field path. */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries((this.data?.errors ?? []).map((e) => [e.field, e.message]));
  }
}

// Endpoints whose 401 means "wrong credentials", not "session ended"
const CREDENTIAL_PATHS = new Set(['/auth/login', '/auth/forgot-password', '/auth/reset-password']);

let unauthorizedHandler: () => void = () => {};
export const onUnauthorized = (handler: () => void) => {
  unauthorizedHandler = handler;
};

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  body?: unknown;
  params?: QueryParams;
  responseType?: 'json' | 'blob';
}

const toQuery = (params: QueryParams = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
};

const httpRequest = async (method: string, path: string, { body, params, responseType }: RequestOptions): Promise<unknown> => {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}${toQuery(params)}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
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
    const data = (await res.json().catch(() => null)) as Partial<ValidationErrorBody> | null;
    throw new ApiError(res.status, data?.message || `Request failed (${res.status}).`, data);
  }
  if (responseType === 'blob') return res.blob();
  return res.status === 204 ? null : res.json();
};

// Written inline (not via USE_MOCK) so the bundler can statically drop the mock chunk entirely.
const loadMock = import.meta.env.VITE_USE_MOCK === 'true' ? () => import('../mocks/handlers.js') : null;

type MockHandle = (method: string, path: string, opts: { body?: unknown; params?: QueryParams }) => Promise<unknown>;
let mockHandle: MockHandle | undefined;

const mockRequest = async (method: string, path: string, { body, params, responseType }: RequestOptions): Promise<unknown> => {
  mockHandle ??= (await loadMock!()).handle as MockHandle;
  const data = await mockHandle(method, path, { body, params });
  return responseType === 'blob' ? new Blob([data as string], { type: 'text/csv' }) : data;
};

const request = async <T>(method: string, path: string, options: RequestOptions = {}): Promise<T> => {
  try {
    return (await (USE_MOCK ? mockRequest : httpRequest)(method, path, options)) as T;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && !CREDENTIAL_PATHS.has(path)) {
      unauthorizedHandler();
    }
    throw err;
  }
};

export const api = {
  get: <T>(path: string, params?: QueryParams) => request<T>('GET', path, { params }),
  getBlob: (path: string) => request<Blob>('GET', path, { responseType: 'blob' }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export const errorMessage = (err: unknown, fallback = 'Something went wrong. Please try again.') =>
  err instanceof ApiError ? err.message : fallback;
