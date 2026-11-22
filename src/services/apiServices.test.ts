import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('../lib/firebase', () => ({ firebaseAuth: { currentUser: { getIdToken: () => Promise.resolve('firebase-id-token') } } }));

const loadServices = async () => {
  vi.stubEnv('VITE_HEALTH_API_URL', 'https://health.test/api/v1');
  vi.resetModules();
  return import('./apiServices');
};

const jsonResponse = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('vitalsService.savePatientToday', () => {
  let fetchMock: Mock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('PUTs the patient’s day to the doctor endpoint with the same body and idempotency key as the patient’s save', async () => {
    const { vitalsService } = await loadServices();
    fetchMock.mockReturnValueOnce(jsonResponse(200, { date: '2026-11-21', alerts: [] }));

    await vitalsService.savePatientToday('p1', '2026-11-21', { PULSE: { num: 72 }, BP: null }, 'key-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://health.test/api/v1/doctor/patients/p1/vitals/today');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ date: '2026-11-21', readings: { PULSE: { num: 72 }, BP: null } }));
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', 'Idempotency-Key': 'key-1' });
  });

  it('makes a fresh idempotency key when none is given', async () => {
    const { vitalsService } = await loadServices();
    fetchMock.mockReturnValueOnce(jsonResponse(200, { alerts: [] })).mockReturnValueOnce(jsonResponse(200, { alerts: [] }));

    await vitalsService.savePatientToday('p1', '2026-11-21', {});
    await vitalsService.savePatientToday('p1', '2026-11-21', {});

    const keys = fetchMock.mock.calls.map(([, init]) => (init as RequestInit & { headers: Record<string, string> }).headers['Idempotency-Key']);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).not.toBe(keys[0]);
  });

  it('rejects with DAY_CHANGED when the date is no longer the patient’s today', async () => {
    const { vitalsService } = await loadServices();
    fetchMock.mockReturnValueOnce(jsonResponse(409, { statusCode: 409, code: 'DAY_CHANGED', message: 'A new day has started' }));

    await expect(vitalsService.savePatientToday('p1', '2026-11-20', {})).rejects.toMatchObject({ status: 409, code: 'DAY_CHANGED' });
  });
});
