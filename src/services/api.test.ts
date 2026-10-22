import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// Exercises the real fetch client (the test env defaults to the mock API).
const loadClient = async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false');
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test/api/v1/');
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

  it('sends cookies, JSON bodies and drops empty query params', async () => {
    const { api } = await loadClient();
    fetchMock.mockReturnValueOnce(jsonResponse(200, { ok: 1 }));
    fetchMock.mockReturnValueOnce(jsonResponse(201, { success: true }));

    await expect(api.get('/patients', { search: '', page: 2, type: undefined })).resolves.toEqual({ ok: 1 });
    await api.post('/clinical-notes', { content: 'hi' });

    const [getUrl, getInit] = fetchMock.mock.calls[0]!;
    expect(getUrl).toBe('https://api.example.test/api/v1/patients?page=2');
    expect(getInit.credentials).toBe('include');
    expect(getInit.body).toBeUndefined();

    const [, postInit] = fetchMock.mock.calls[1]!;
    expect(postInit.method).toBe('POST');
    expect(postInit.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(postInit.body)).toEqual({ content: 'hi' });
  });

  it('surfaces the server message and per-field validation errors', async () => {
    const { api, ApiError } = await loadClient();
    fetchMock.mockReturnValueOnce(
      jsonResponse(400, { success: false, message: 'Invalid input data', errors: [{ field: 'firstName', message: 'First name is required' }] })
    );

    const err = await api.post('/auth/register-patient', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, message: 'Invalid input data', fieldErrors: { firstName: 'First name is required' } });
  });

  it('turns network failures into a readable ApiError with status 0', async () => {
    const { api } = await loadClient();
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(api.get('/patients/me')).rejects.toMatchObject({ status: 0, message: expect.stringMatching(/unable to reach/i) });
  });

  it('reports 401s as an ended session, except wrong-credential responses from login', async () => {
    const { api, onUnauthorized } = await loadClient();
    const handler = vi.fn();
    onUnauthorized(handler);

    fetchMock.mockReturnValueOnce(jsonResponse(401, { message: 'Invalid email or password.' }));
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ status: 401 });
    expect(handler).not.toHaveBeenCalled();

    fetchMock.mockReturnValueOnce(jsonResponse(401, { message: 'Session has expired.' }));
    await expect(api.get('/patients/me')).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('returns blobs for file downloads', async () => {
    const { api } = await loadClient();
    fetchMock.mockReturnValueOnce(Promise.resolve(new Response('a,b\n1,2', { status: 200 })));
    const blob = await api.getBlob('/reports/me/csv');
    expect(await blob.text()).toBe('a,b\n1,2');
  });
});
