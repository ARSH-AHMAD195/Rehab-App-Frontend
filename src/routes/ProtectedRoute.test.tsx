import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LoginPage } from '../pages/LoginPage';
import { ToastProvider } from '../components/ui/toast';
import { api, ApiError } from '../services/api';
import { ProtectedRoute } from './ProtectedRoute';

const { signInWithCustomToken, fakeAuth } = vi.hoisted(() => ({
  signInWithCustomToken: vi.fn(),
  fakeAuth: { currentUser: null as null | { uid: string; metadata: { lastSignInTime?: string } } },
}));
vi.mock('firebase/auth', () => ({
  signInWithCustomToken,
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  onAuthStateChanged: (_auth: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
}));
vi.mock('../lib/firebase', () => ({ firebaseAuth: fakeAuth }));

const me = (over: Record<string, unknown>) => ({ id: 'u1', role: 'PATIENT', name: 'Asha', email: null, emailVerified: false, active: true, loginMethod: 'LOGIN_CODE', hasPassword: false, ...over });

const post = vi.spyOn(api, 'post');
const put = vi.spyOn(api, 'put');
const get = vi.spyOn(api, 'get');

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  fakeAuth.currentUser = { uid: 'fb1', metadata: { lastSignInTime: 'Mon, 23 Nov 2026 10:00:00 GMT' } };
  signInWithCustomToken.mockReset();
  post.mockResolvedValue({ customToken: 'tok-1' });
  put.mockResolvedValue({ hasPassword: true });
  get.mockResolvedValue(me({}));
});

const Home = () => <p>APP HOME</p>;

const renderApp = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );

const signInWithPassword = async (user = userEvent.setup()) => {
  await user.type(screen.getByLabelText('Mobile number'), '9876543210');
  await user.type(screen.getByLabelText('Password'), 'secret1');
  await user.click(screen.getByRole('button', { name: /^sign in/i }));
};

describe('patient password sign-in', () => {
  it('signs in with the custom token from the API', async () => {
    renderApp();
    await signInWithPassword();
    await waitFor(() => expect(signInWithCustomToken).toHaveBeenCalledWith(expect.anything(), 'tok-1'));
    expect(post).toHaveBeenCalledWith('/auth/password-login', { phone: '9876543210', password: 'secret1' });
  });

  it('shows the message for wrong number or password', async () => {
    post.mockRejectedValue(new ApiError(401, 'x', { code: 'INVALID_CREDENTIALS' }));
    renderApp();
    await signInWithPassword();
    expect(await screen.findByText(/Wrong number or password\. After 5 wrong tries/)).toBeInTheDocument();
  });

  it('switches to the code form and back', async () => {
    renderApp();
    const user = userEvent.setup();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /First time, or forgot your password/ }));
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ask for a code/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Back to sign in with password/ }));
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });
});

/** Signs in through the real provider, then shows the protected area for the role. */
const Gate = ({ method }: { method: 'code' | 'password' }) => {
  const { user, loginWithCode, passwordLogin } = useAuth();
  if (!user)
    return (
      <button onClick={() => void (method === 'code' ? loginWithCode({ phone: '9876543210', code: '123456' }) : passwordLogin({ phone: '9876543210', password: 'secret1' }))}>
        go
      </button>
    );
  return (
    <ProtectedRoute allowedRoles={[user.role]}>
      <Home />
    </ProtectedRoute>
  );
};

const renderGate = async (user: Record<string, unknown>, method: 'code' | 'password') => {
  get.mockResolvedValue(me(user));
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <MemoryRouter>
            <Gate method={method} />
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
  await userEvent.click(await screen.findByRole('button', { name: 'go' }));
};

describe('set-password gate', () => {
  it('blocks a code sign-in patient, validates, sends the password untrimmed, then lets them in', async () => {
    await renderGate({}, 'code');
    const user = userEvent.setup();
    expect(await screen.findByRole('heading', { name: 'Set your password' })).toBeInTheDocument();
    expect(screen.queryByText('APP HOME')).not.toBeInTheDocument();
    expect(screen.queryByText(/verify your email/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('New password'), 'abc');
    await user.type(screen.getByLabelText('Type it again'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByText(/at least 6 characters/)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('New password'));
    await user.clear(screen.getByLabelText('Type it again'));
    await user.type(screen.getByLabelText('New password'), ' pass word ');
    await user.type(screen.getByLabelText('Type it again'), ' pass word X');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByText('The two passwords do not match.')).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Type it again'));
    await user.type(screen.getByLabelText('Type it again'), ' pass word ');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/users/me/password', { password: ' pass word ' }));
    expect(await screen.findByText('APP HOME')).toBeInTheDocument();
  });

  it('is not asked again when the app is reopened in the same sign-in, but is after a new code sign-in', async () => {
    await renderGate({}, 'code');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('New password'), 'secret1');
    await user.type(screen.getByLabelText('Type it again'), 'secret1');
    await user.click(screen.getByRole('button', { name: 'Save password' }));
    expect(await screen.findByText('APP HOME')).toBeInTheDocument();
    cleanup();

    // Reopened: same Firebase sign-in, still a code session
    await renderGate({ hasPassword: true }, 'code');
    expect(await screen.findByText('APP HOME')).toBeInTheDocument();
    cleanup();

    // A new code sign-in (forgot the password): asked again
    fakeAuth.currentUser = { uid: 'fb1', metadata: { lastSignInTime: 'Tue, 24 Nov 2026 09:00:00 GMT' } };
    await renderGate({ hasPassword: true }, 'code');
    expect(await screen.findByRole('heading', { name: 'Set a new password' })).toBeInTheDocument();
  });

  it('says "Set a new password" when one already exists', async () => {
    await renderGate({ hasPassword: true }, 'code');
    expect(await screen.findByRole('heading', { name: 'Set a new password' })).toBeInTheDocument();
  });

  it('is not shown to a patient who signed in with a password', async () => {
    await renderGate({ loginMethod: 'PASSWORD', hasPassword: true }, 'password');
    expect(await screen.findByText('APP HOME')).toBeInTheDocument();
  });

  it('is not shown to staff, who still get the verify-email screen when unverified', async () => {
    await renderGate({ role: 'DOCTOR', loginMethod: 'PASSWORD', hasPassword: null, email: 'd@x.org', emailVerified: true }, 'password');
    expect(await screen.findByText('APP HOME')).toBeInTheDocument();
  });

  it('never shows verify-email to a patient, even with an unverified flag', async () => {
    await renderGate({ loginMethod: 'PASSWORD', hasPassword: true, emailVerified: false }, 'password');
    expect(await screen.findByText('APP HOME')).toBeInTheDocument();
    expect(screen.queryByText(/verify your email/i)).not.toBeInTheDocument();
  });

  it('still asks unverified staff to verify their email', async () => {
    await renderGate({ role: 'DOCTOR', loginMethod: 'PASSWORD', hasPassword: null, email: 'd@x.org', emailVerified: false }, 'password');
    expect(await screen.findByRole('heading', { name: 'Please verify your email' })).toBeInTheDocument();
  });
});
