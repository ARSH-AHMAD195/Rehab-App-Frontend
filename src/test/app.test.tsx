import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import App from '../App';
import { authService } from '../services/authService';
import { exerciseService } from '../services/apiServices';

const renderAt = (path: string) => {
  window.history.pushState({}, '', path);
  return render(<App />);
};

const signInAs = (email: string) => authService.login({ email, password: 'Password123!' });

const fillLogin = async (user: UserEvent, email: string, password = 'Password123!') => {
  await user.type(await screen.findByLabelText(/email address/i), email);
  await user.type(screen.getByLabelText(/^password$/i), password);
  await user.click(screen.getByRole('button', { name: /^sign in/i }));
};

// Lazy route chunks (and recharts) transform slowly under jsdom on a cold cache, especially
// while other test files run in parallel
const SLOW = { timeout: 25_000 };

describe('app flows (mock API)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends signed-out users to the login page', async () => {
    renderAt('/patient/dashboard');
    expect(await screen.findByRole('heading', { name: /^sign in$/i }, SLOW)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('shows the server error for wrong credentials', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await fillLogin(user, 'patient.john@example.com', 'wrong-password');
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid email or password/i);
  });

  it('signs a patient in, requires consent, and never shows invented vitals', async () => {
    const user = userEvent.setup();
    renderAt('/patient/report');
    await fillLogin(user, 'patient.margaret@example.com');

    // Returns to the page they asked for, within their role
    expect(await screen.findByRole('heading', { name: /progress report/i }, SLOW)).toBeInTheDocument();

    await user.click(screen.getAllByRole('link', { name: /^today$/i })[0]!);
    const consent = await screen.findByRole('dialog', { name: /informed consent/i }, SLOW);
    const submit = within(consent).getByRole('button', { name: /acknowledge/i });
    expect(submit).toBeDisabled();
    await user.click(within(consent).getByRole('button', { name: /select all/i }));
    await user.click(submit);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Margaret has BP and pain logged but no SpO2/pulse: those tiles must say so, not show defaults
    expect(screen.getByRole('heading', { level: 1, name: /margaret/i })).toBeInTheDocument();
    expect(screen.getAllByText(/no reading this week/i)).toHaveLength(2);
  }, 40_000);

  it('logs an exercise in two taps, recording the effort the patient chose', async () => {
    const user = userEvent.setup();
    await signInAs('patient.margaret@example.com');
    renderAt('/patient/dashboard');

    await user.click((await screen.findAllByRole('button', { name: /mark done/i }, SLOW))[0]!);
    const dialog = screen.getByRole('dialog', { name: /how hard did it feel/i });
    await user.click(within(dialog).getByRole('button', { name: /^hard/i }));

    expect(await screen.findByText(/well done!/i)).toBeInTheDocument();
    const { sessions } = await exerciseService.getMySessions({ days: 1 });
    expect(sessions[0]).toMatchObject({ perceivedExertion: 7, durationMinutes: 15 });
  }, 40_000);

  it('keeps users inside their own role area', async () => {
    await signInAs('patient.john@example.com');
    renderAt('/admin/audit-logs');
    await waitFor(() => expect(window.location.pathname).toBe('/patient/dashboard'), SLOW);
  });

  it('validates measurements inline, then surfaces the clinician safety notice', async () => {
    const user = userEvent.setup();
    await signInAs('patient.john@example.com');
    renderAt('/patient/health-tracker');

    await user.click(await screen.findByRole('radio', { name: 'Oxygen' }, SLOW));
    const value = screen.getByLabelText(/oxygen level/i);
    await user.type(value, '980');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(value).toHaveAttribute('aria-invalid', 'true');
    expect(value).toHaveFocus();

    await user.clear(value);
    await user.type(value, '88');
    await user.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText(/below 93%/i)).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: '88' })).toBeInTheDocument();
  }, 40_000);

  it('updates contact details and guards against leaving with unsaved changes', async () => {
    const user = userEvent.setup();
    await signInAs('patient.john@example.com');
    renderAt('/patient/profile');

    const phone = await screen.findByLabelText(/your phone number/i, {}, SLOW);
    await user.clear(phone);
    await user.type(phone, '+1 555 0100');

    await user.click(screen.getByRole('link', { name: /my exercises/i }));
    const guard = await screen.findByRole('dialog', { name: /leave without saving/i });
    await user.click(within(guard).getByRole('button', { name: /keep editing/i }));
    expect(window.location.pathname).toBe('/patient/profile');

    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/contact details have been updated/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  }, 40_000);

  it('opens the page a notification links to', async () => {
    const user = userEvent.setup();
    await signInAs('patient.john@example.com');
    renderAt('/patient/report');

    await user.click(await screen.findByRole('button', { name: /notifications, 2 unread/i }, SLOW));
    await user.click(screen.getByRole('button', { name: /^welcome to fit for surgery/i }));
    await waitFor(() => expect(window.location.pathname).toBe('/patient/exercises'));
  }, 40_000);

  it('shows every missing required field when onboarding a patient', async () => {
    const user = userEvent.setup();
    await signInAs('doctor.jenkins@fitforsurgery.org');
    renderAt('/doctor/onboard-patient');

    await user.click(await screen.findByRole('button', { name: /enroll patient/i }, SLOW));
    const firstName = screen.getByLabelText(/^first name$/i);
    expect(firstName).toHaveFocus();
    for (const label of [/^first name$/i, /^email address$/i, /^date of birth$/i, /^procedure$/i, /^temporary password$/i]) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
    }
  }, 40_000);

  it('signs out after inactivity, with a warning first', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await signInAs('doctor.jenkins@fitforsurgery.org');
    renderAt('/doctor/exercises');
    await screen.findAllByRole('button', { name: /view steps/i }, SLOW);

    act(() => vi.advanceTimersByTime(14 * 60_000 + 5_000));
    expect(await screen.findByRole('dialog', { name: /still there/i })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(60_000));
    expect(await screen.findByText(/signed out after a period of inactivity/i, {}, SLOW)).toBeInTheDocument();
    await expect(authService.getMe()).rejects.toMatchObject({ status: 401 });
  }, 40_000);

  it('organises the patient chart into keyboard-navigable tabs kept in the URL', async () => {
    const user = userEvent.setup();
    await signInAs('doctor.jenkins@fitforsurgery.org');
    renderAt('/doctor/patients');
    await user.click(await screen.findByRole('link', { name: /chart for john davis/i }, SLOW));

    const overview = await screen.findByRole('tab', { name: 'Overview' }, SLOW);
    expect(overview).toHaveAttribute('aria-selected', 'true');
    overview.focus();
    await user.keyboard('{ArrowRight}');

    const vitals = screen.getByRole('tab', { name: 'Vitals' });
    expect(vitals).toHaveAttribute('aria-selected', 'true');
    expect(vitals).toHaveFocus();
    expect(window.location.search).toBe('?tab=vitals');
    expect(screen.getByRole('tabpanel', { name: 'Vitals' })).toHaveTextContent(/readings, last 14 days/i);
  }, 40_000);

  it('closes dialogs with Escape and returns focus', async () => {
    const user = userEvent.setup();
    await signInAs('doctor.jenkins@fitforsurgery.org');
    renderAt('/doctor/exercises');

    const trigger = (await screen.findAllByRole('button', { name: /view steps/i }, SLOW))[0]!;
    await user.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
