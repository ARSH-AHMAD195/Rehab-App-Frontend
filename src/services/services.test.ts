import { describe, expect, it } from 'vitest';
import {
  adminService,
  authService,
  clinicalNoteService,
  consentService,
  doctorService,
  exerciseService,
  followUpService,
  healthService,
  patientService,
  reportService,
} from './apiServices';
import { REQUIRED_CONSENTS } from '../lib/constants';

// End-to-end through the typed service layer against the mock backend (VITE_USE_MOCK in tests).
// The mock mirrors backend/controllers, including its quirks, so these double as contract notes.
const login = (email: string, password = 'Password123!') => authService.login({ email, password });

// jsdom's Blob has no .text()
const readBlob = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

describe('service layer (mock API)', () => {
  it('rejects bad credentials and protected calls without a session', async () => {
    await expect(login('patient.john@example.com', 'nope')).rejects.toMatchObject({ status: 401 });
    await expect(patientService.getMyProfile()).rejects.toMatchObject({ status: 401 });
  });

  it('supports the patient workflow', async () => {
    await login('patient.john@example.com');

    const { profile, daysUntilSurgery } = await patientService.getMyProfile();
    expect(profile.assignedDoctor?.lastName).toBe('Jenkins');
    expect(daysUntilSurgery).toBeGreaterThan(15);

    const { assignments } = await exerciseService.getMyAssigned();
    expect(assignments).toHaveLength(3);
    await exerciseService.logSession({ assignmentId: assignments[2]!._id, durationMinutes: 8, perceivedExertion: 3, patientFeedback: '', status: 'completed' });
    expect((await exerciseService.getMyAssigned()).assignments[2]!.completedToday).toBe(true);

    const low = await healthService.logMeasurement({ type: 'spo2', numericValue: 88, unit: '%', notes: '' });
    expect(low.guidanceNotice).toMatch(/below 93%/);

    expect((await consentService.getMyConsents()).isFullyConsented).toBe(false);
    await consentService.recordConsents(REQUIRED_CONSENTS.map(({ type }) => ({ consentType: type, agreed: true })));
    expect((await consentService.getMyConsents()).isFullyConsented).toBe(true);

    await patientService.updateMyProfile({ phone: '+1 555 0100', emergencyContact: { name: 'Martha', relationship: 'Spouse', phone: '+1 555 0101' } });
    const updated = await patientService.getMyProfile();
    expect(updated.user.phone).toBe('+1 555 0100');
    expect(updated.profile.emergencyContact.name).toBe('Martha');

    expect((await followUpService.getMyFollowUps()).followUps).toHaveLength(1);
    expect((await patientService.getMyTimeline()).timeline.length).toBeGreaterThan(10);
    expect((await reportService.getMyPeriodReport('weekly')).summary.adherenceRate).toBeGreaterThan(0);
    expect((await readBlob(await reportService.exportMyCsv())).startsWith('Date,Time,MeasurementType')).toBe(true);

    await authService.logout();
    await expect(patientService.getMyProfile()).rejects.toMatchObject({ status: 401 });
  });

  it('supports the doctor workflow and scopes data to the doctor', async () => {
    await login('doctor.jenkins@fitforsurgery.org');

    const { patients, total } = await patientService.getPatients();
    expect(total).toBe(1);
    const patientId = patients[0]!.user._id;

    const { alerts } = await doctorService.getAlerts();
    expect(alerts.every((a) => a.patientName === 'John Davis')).toBe(true);

    const { measurements } = await healthService.getPatientMeasurements(patientId, { days: 14 });
    expect(measurements.length).toBeGreaterThan(20);

    const { exercises } = await exerciseService.getLibrary();
    await exerciseService.assignExercise({
      patientId,
      exerciseId: exercises[0]!._id,
      frequency: 'Daily',
      customizedDurationMinutes: 10,
      customizedSets: 2,
      customizedReps: 10,
      customizedInstructions: '',
    });
    await clinicalNoteService.createNote({ patientId, noteType: 'progress_review', content: 'Tolerating program well.', followUpInstructions: '', isConfidential: false });
    const { followUp } = await followUpService.createFollowUp({ patientId, scheduledDate: new Date(Date.now() + 864e5).toISOString(), reason: 'Check-in', notes: '' });

    const forPatient = await followUpService.getPatientFollowUps(patientId);
    expect(forPatient.followUps).toHaveLength(2);
    await followUpService.updateStatus(followUp._id, 'completed');
    expect((await followUpService.getPatientFollowUps(patientId)).followUps.find((f) => f._id === followUp._id)?.status).toBe('completed');
  });

  it('returns field-level validation errors like the backend', async () => {
    await login('doctor.jenkins@fitforsurgery.org');
    const err = await clinicalNoteService
      .createNote({ patientId: 'x', noteType: 'progress_review', content: 'ok', followUpInstructions: '', isConfidential: false })
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 400, fieldErrors: { content: expect.stringMatching(/at least 5/) } });
  });

  it('supports admin account management', async () => {
    await login('admin@fitforsurgery.org');
    expect((await adminService.getAnalytics()).analytics.totalPatients).toBe(2);

    const { users } = await adminService.getUsers({ role: 'doctor' });
    const miller = users.find((u) => u.lastName === 'Miller')!;
    await adminService.toggleUserStatus(miller._id);
    await authService.logout();

    await expect(login(miller.email)).rejects.toMatchObject({ status: 403 });
  });

  it('resets a password with the issued token', async () => {
    const { demoResetToken } = await authService.forgotPassword('admin@fitforsurgery.org');
    await authService.resetPassword({ resetToken: demoResetToken!, newPassword: 'a-new-password' });
    await expect(login('admin@fitforsurgery.org')).rejects.toMatchObject({ status: 401 });
    await expect(login('admin@fitforsurgery.org', 'a-new-password')).resolves.toMatchObject({ success: true });
  });
});
