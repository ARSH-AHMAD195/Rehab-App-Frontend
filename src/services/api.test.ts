import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// A signed-in Firebase user whose ID token the client should forward
vi.mock('../lib/firebase', () => ({ firebaseAuth: { currentUser: { getIdToken: () => Promise.resolve('firebase-id-token') } } }));

const loadClient = async () => {
  vi.stubEnv('VITE_AUTH_API_URL', 'https://auth.test/api/v1/');
  vi.stubEnv('VITE_HEALTH_API_URL', 'https://health.test/api/v1');
  vi.stubEnv('VITE_EXERCISE_API_URL', 'https://exercise.test/api/v1');
  vi.resetModules();
  return import('./api');
};

const jsonResponse = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('api client', () => {
  let fetchMock: Mock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends each path to the API that owns it', async () => {
    const { apiBaseFor } = await loadClient();
    const routes: [string, string][] = [
      ['/auth/me', 'https://auth.test/api/v1'],
      ['/users/me/profile', 'https://auth.test/api/v1'],
      ['/patients', 'https://auth.test/api/v1'],
      ['/patients/abc', 'https://auth.test/api/v1'],
      ['/patients/me/medical-profile', 'https://auth.test/api/v1'],
      ['/patients/abc/medical-profile', 'https://auth.test/api/v1'],
      ['/doctors/abc', 'https://auth.test/api/v1'],
      ['/users/abc/invitations', 'https://auth.test/api/v1'],
      ['/vital-types', 'https://health.test/api/v1'],
      ['/me/vitals/today', 'https://health.test/api/v1'],
      ['/doctor/alerts', 'https://health.test/api/v1'],
      ['/doctor/patients/abc/vitals/trends', 'https://health.test/api/v1'],
      ['/admin/alert-thresholds/PAIN', 'https://health.test/api/v1'],
      ['/admin/vital-types/BP', 'https://health.test/api/v1'],
      ['/exercise-categories', 'https://exercise.test/api/v1'],
      ['/exercises/abc', 'https://exercise.test/api/v1'],
      ['/exercise-completions/abc', 'https://exercise.test/api/v1'],
      ['/patients/me/exercise-plan', 'https://exercise.test/api/v1'],
      ['/patients/me/exercise-checklist', 'https://exercise.test/api/v1'],
      ['/patients/me/exercise-completions', 'https://exercise.test/api/v1'],
      ['/patients/abc/exercise-plan/versions', 'https://exercise.test/api/v1'],
      ['/patients/abc/exercise-compliance', 'https://exercise.test/api/v1'],
    ];
    for (const [path, base] of routes) expect(apiBaseFor(path), path).toBe(base);
  });

  it('sends the Firebase token, JSON bodies, the idempotency key, and drops empty query params', async () => {
    const { api } = await loadClient();
    fetchMock.mockReturnValueOnce(jsonResponse(200, { data: [] }));
    fetchMock.mockReturnValueOnce(jsonResponse(200, { date: '2026-10-26' }));

    await api.get('/patients', { q: 'meera', cursor: '', limit: undefined });
    await api.put('/me/vitals/today', { date: '2026-10-26', readings: {} }, 'key-1');

    const [getUrl, getInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(getUrl).toBe('https://auth.test/api/v1/patients?q=meera');
    expect((getInit.headers as Record<string, string>).Authorization).toBe('Bearer firebase-id-token');

    const [putUrl, putInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(putUrl).toBe('https://health.test/api/v1/me/vitals/today');
    expect(putInit.method).toBe('PUT');
    expect(putInit.body).toBe(JSON.stringify({ date: '2026-10-26', readings: {} }));
    expect(putInit.headers).toMatchObject({ 'Content-Type': 'application/json', 'Idempotency-Key': 'key-1' });
  });

  it('turns the API error shape into ApiError with code and per-field messages', async () => {
    const { api, ApiError } = await loadClient();
    fetchMock.mockReturnValueOnce(
      jsonResponse(400, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        requestId: 'r1',
        details: [{ field: 'readings.PULSE.num', code: 'OUT_OF_RANGE', issue: 'must be between 30 and 220' }],
      })
    );

    const err = await api.put('/me/vitals/today', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_FAILED', message: 'Validation failed' });
    expect((err as InstanceType<typeof ApiError>).fieldErrors).toEqual({ 'readings.PULSE.num': 'must be between 30 and 220' });
  });

  it('reports a 401 as an ended session and network failures as status 0', async () => {
    const { api, onUnauthorized } = await loadClient();
    const ended = vi.fn();
    onUnauthorized(ended);
    fetchMock.mockReturnValueOnce(jsonResponse(401, { statusCode: 401, code: 'UNAUTHENTICATED', message: 'Sign in again' }));
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(api.get('/auth/me')).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(ended).toHaveBeenCalledOnce();
    await expect(api.get('/auth/me')).rejects.toMatchObject({ status: 0, code: 'NETWORK' });
  });

  it('returns null for 204 responses', async () => {
    const { api } = await loadClient();
    fetchMock.mockReturnValueOnce(Promise.resolve(new Response(null, { status: 204 })));
    await expect(api.delete('/exercise-completions/abc')).resolves.toBeNull();
  });
});
