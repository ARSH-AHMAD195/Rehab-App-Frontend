// HTTP client for the Fit for Surgery REST API.
//
// Auth rides on the backend's httpOnly `token` cookie (credentials: 'include'), so no
// credential is ever readable from JavaScript. With VITE_USE_MOCK=true, requests are served
// by the in-browser mock in src/mocks instead (dev/demo only; excluded from production builds).
import type { ValidationErrorBody } from '../types/api';
import { firebaseAuth } from '../lib/firebase';


const AUTH_API_URL = (
  import.meta.env.VITE_AUTH_API_URL || '/api/v1'
).replace(/\/$/, '');

const HEALTH_API_URL = (
  import.meta.env.VITE_HEALTH_API_URL || AUTH_API_URL
).replace(/\/$/, '');

const EXERCISE_API_URL = (
  import.meta.env.VITE_EXERCISE_API_URL || AUTH_API_URL
).replace(/\/$/, '');

const getApiBaseUrl = (path: string): string => {
  if (
    path.startsWith('/vital-types') ||
    path.startsWith('/me/vitals') ||
    path.startsWith('/doctor/alerts')
  ) {
    return HEALTH_API_URL;
  }

  if (
    path.startsWith('/exercise-categories') ||
    path.startsWith('/exercises') ||
    path.startsWith('/exercise-completions') ||
    path.startsWith('/patients/me/exercise-plan') ||
    path.startsWith('/patients/me/exercise-checklist')
  ) {
    return EXERCISE_API_URL;
  }

  return AUTH_API_URL;
};

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



const httpRequest = async (
  method: string,
  path: string,
  { body, params, responseType }: RequestOptions
): Promise<unknown> => {
  let res: Response;

  try {
    // Get the current Firebase user's ID token.
    const firebaseUser = firebaseAuth.currentUser;
    const token = firebaseUser
      ? await firebaseUser.getIdToken()
      : null;

    // Prepare request headers.
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Select the appropriate backend API.
    const baseUrl = getApiBaseUrl(path);

    res = await fetch(
      `${baseUrl}${path}${toQuery(params)}`,
      {
        method,
        headers,
        cache: 'no-store',
        body:
          body === undefined
            ? undefined
            : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );
  } catch (err) {
    const error = err as Error;

    throw new ApiError(
      0,
      error.name === 'TimeoutError'
        ? 'The server took too long to respond. Please try again.'
        : 'Unable to reach the server. Check your connection and try again.'
    );
  }

  // Handle 304 before the generic error check.
  // A 304 response has no response body to parse.
  if (res.status === 304) {
    throw new ApiError(
      304,
      'The server returned a cached response. Please retry.'
    );
  }

  // Handle unsuccessful HTTP responses.
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as
      | Partial<ValidationErrorBody>
      | null;

    throw new ApiError(
      res.status,
      data?.message || `Request failed (${res.status}).`,
      data
    );
  }

  // Handle file downloads.
  if (responseType === 'blob') {
    return res.blob();
  }

  // Handle responses without a body.
  if (res.status === 204) {
    return null;
  }

  // Parse JSON response.
  return res.json();
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
