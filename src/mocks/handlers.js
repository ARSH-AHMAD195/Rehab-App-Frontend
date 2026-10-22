// In-browser mock of the Fit for Surgery REST API (ported from backend/controllers).
// Only loaded when VITE_USE_MOCK=true, for frontend work without the backend running.
// NOT secure: the session id and passwords live in localStorage. Never enable in production.
import { ApiError } from '../services/api';
import { all, byId, insert, update, save, newId } from './db.js';

// Stands in for the backend's httpOnly session cookie
const SESSION_KEY = 'ffs_mock_session';

const DAY = 864e5;
const iso = (d = new Date()) => new Date(d).toISOString();
const within = (date, days) => new Date(date).getTime() >= Date.now() - Number(days) * DAY;
const desc = (key) => (a, b) => new Date(b[key]) - new Date(a[key]);
const asc = (key) => (a, b) => new Date(a[key]) - new Date(b[key]);
const matches = (search, ...fields) => {
  const re = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return fields.some((f) => re.test(f || ''));
};

const fail = (status, message) => {
  throw new ApiError(status, message, { success: false, message });
};

// ---------- shared helpers (ports of mongoose populate / controller utilities) ----------

const safeUser = ({ password, resetPasswordToken, resetPasswordExpires, ...u }) => u;
const pickUser = (id, fields) => {
  const u = byId('users', id);
  return u ? Object.fromEntries([['_id', u._id], ...fields.split(' ').map((f) => [f, u[f]])]) : null;
};
const withExercise = (doc) => ({ ...doc, exercise: byId('exercises', doc.exercise) || null });
const withDoctor = (doc, fields = 'firstName lastName') => ({ ...doc, doctor: pickUser(doc.doctor, fields) });
const rawProfile = (userId) => all('patientProfiles').find((p) => p.user === userId);
const patientProfile = (userId, doctorFields = 'firstName lastName email phone') => {
  const p = rawProfile(userId);
  return p ? { ...p, assignedDoctor: p.assignedDoctor ? pickUser(p.assignedDoctor, doctorFields) : null } : null;
};
const measurementsOf = (pid) => all('healthMeasurements').filter((m) => m.patient === pid).sort(desc('measuredAt'));
const sessionsOf = (pid) => all('exerciseSessions').filter((s) => s.patient === pid).sort(desc('completedAt')).map(withExercise);
const findPatientUser = (pid) => {
  const u = byId('users', pid);
  if (!u) fail(404, 'Patient not found.');
  return u;
};

const audit = (me, action, targetResource, targetId = '', details = {}) =>
  insert('auditLogs', {
    userId: me?._id || null,
    userEmail: me?.email || 'unauthenticated',
    role: me?.role || 'anonymous',
    action,
    targetResource,
    targetId: String(targetId),
    userAgent: globalThis.navigator?.userAgent || '',
    details,
  });
const notify = (recipient, title, message, type, link) => insert('notifications', { recipient, title, message, type, link });

const doctorPatientIds = (doctorId) => [
  ...new Set([
    ...all('doctorPatientAssignments').filter((a) => a.doctor === doctorId && a.status === 'active').map((a) => a.patient),
    ...all('patientProfiles').filter((p) => p.assignedDoctor === doctorId).map((p) => p.user),
  ]),
];
const assertDoctorAccess = (me, patientId, message) => {
  if (me.role === 'doctor' && !doctorPatientIds(me._id).includes(patientId)) fail(403, message);
};

const createUser = ({ email, password, firstName, lastName, phone }, role, duplicateMessage) => {
  if (!email || !firstName || !lastName || !password || password.length < 6) {
    fail(400, 'Email, first name, last name and a password of at least 6 characters are required.');
  }
  email = email.toLowerCase().trim();
  if (all('users').some((u) => u.email === email)) fail(409, duplicateMessage);
  return insert('users', { email, password, role, firstName, lastName, phone: phone || '' });
};

// Clinician-approved neutral threshold notices (informational only)
const safetyGuidance = (type, { systolic, diastolic, numericValue }) => {
  if (type === 'blood_pressure') {
    if (systolic >= 160 || diastolic >= 100) {
      return 'Your blood pressure reading is higher than your usual target. Please rest for 10 minutes and retake it. If it remains elevated or you experience symptoms, contact your surgical care coordinator.';
    }
    if (systolic < 90 || diastolic < 60) {
      return 'Your blood pressure reading is lower than standard range. If you feel dizzy or lightheaded, sit down comfortably and notify your care team.';
    }
  }
  if (type === 'spo2' && numericValue && numericValue < 93) {
    return 'Your oxygen saturation reading is below 93%. Please ensure the pulse oximeter is properly positioned on a warm finger, take several slow deep breaths, and re-test. Contact your clinical team if low readings persist.';
  }
  if (type === 'pulse') {
    if (numericValue > 110) return 'Resting pulse is elevated. Rest quietly for a few minutes and recheck.';
    if (numericValue < 50) return 'Resting pulse is low. If you experience lightheadedness, consult your doctor.';
  }
  if (type === 'pain_score' && numericValue >= 8) {
    return 'You logged a high pain score. Follow your pre-operative pain protocol or contact your care team if pain is sudden or unexpected.';
  }
  return null;
};

const TREND_KEYS = {
  spo2: 'spo2', pulse: 'pulse', temperature: 'temperature', weight: 'weight', blood_sugar: 'blood_sugar',
  pain_score: 'pain', walking_minutes: 'walking_minutes', step_count: 'steps', sleep_hours: 'sleep_hours',
  water_intake: 'water_intake',
};

const buildTimeline = (me, pid) => {
  const timeline = [];
  const titleCase = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  sessionsOf(pid).slice(0, 30).forEach((s) =>
    timeline.push({
      id: `session-${s._id}`,
      type: 'exercise',
      timestamp: s.completedAt || s.createdAt,
      title: `Completed ${s.exercise?.title || 'Exercise Session'}`,
      description: `${s.durationMinutes || 0} mins logged • Difficulty: ${s.perceivedExertion || 'N/A'}/10`,
      badge: s.exercise?.category || 'Exercise',
      metadata: { sessionId: s._id, status: s.status, notes: s.patientFeedback },
    })
  );

  measurementsOf(pid).slice(0, 40).forEach((m) => {
    const val =
      m.type === 'blood_pressure'
        ? `${m.systolic}/${m.diastolic} ${m.unit}`
        : `${m.numericValue ?? m.textValue ?? ''} ${m.unit}`;
    const label = titleCase(m.type);
    timeline.push({
      id: `measurement-${m._id}`,
      type: 'measurement',
      timestamp: m.measuredAt || m.createdAt,
      title: `Logged ${label}`,
      description: `Value: ${val}${m.notes ? ` • Note: ${m.notes}` : ''}`,
      badge: label,
      metadata: { measurementId: m._id, measurementType: m.type },
    });
  });

  all('clinicalNotes')
    .filter((n) => n.patient === pid && (me.role !== 'patient' || !n.isConfidential))
    .sort(desc('createdAt'))
    .slice(0, 20)
    .map((n) => withDoctor(n))
    .forEach((n) =>
      timeline.push({
        id: `note-${n._id}`,
        type: 'clinical_note',
        timestamp: n.createdAt,
        title: `Clinical Note (${n.noteType.replace(/_/g, ' ')})`,
        description: n.content,
        badge: `Dr. ${n.doctor?.lastName || 'Clinician'}`,
        metadata: { noteId: n._id, followUpInstructions: n.followUpInstructions },
      })
    );

  all('followUps')
    .filter((f) => f.patient === pid)
    .sort(desc('scheduledDate'))
    .slice(0, 20)
    .map((f) => withDoctor(f))
    .forEach((f) =>
      timeline.push({
        id: `followup-${f._id}`,
        type: 'follow_up',
        timestamp: f.scheduledDate,
        title: `Follow-up: ${f.reason}`,
        description: `Status: ${f.status} with Dr. ${f.doctor?.lastName || 'Clinician'}${f.notes ? ` • ${f.notes}` : ''}`,
        badge: f.status.toUpperCase(),
        metadata: { followUpId: f._id, status: f.status },
      })
    );

  all('exerciseAssignments')
    .filter((a) => a.patient === pid)
    .sort(desc('createdAt'))
    .slice(0, 20)
    .map(withExercise)
    .forEach((a) =>
      timeline.push({
        id: `assignment-${a._id}`,
        type: 'prescription',
        timestamp: a.startDate || a.createdAt,
        title: `Prescribed: ${a.exercise?.title || 'Exercise'}`,
        description: `${a.frequency} • Target: ${a.customizedDurationMinutes} mins/session`,
        badge: a.exercise?.category || 'Prehab',
        metadata: { assignmentId: a._id },
      })
    );

  return timeline.sort(desc('timestamp'));
};

const buildAlerts = (me) => {
  const ids =
    me.role === 'doctor'
      ? doctorPatientIds(me._id)
      : all('users').filter((u) => u.role === 'patient' && u.isActive).map((u) => u._id);
  const nameOf = (pid) => {
    const u = byId('users', pid);
    return u ? `${u.firstName} ${u.lastName}` : 'Patient';
  };
  const alerts = [];
  const push = (m, idPrefix, type, severity, message, value) =>
    alerts.push({ id: `${idPrefix}-${m._id}`, patientId: m.patient, patientName: nameOf(m.patient), type, severity, message, timestamp: m.measuredAt, value });

  all('healthMeasurements')
    .filter((m) => ids.includes(m.patient) && within(m.measuredAt, 14))
    .sort(desc('measuredAt'))
    .forEach((m) => {
      const v = m.numericValue;
      const bp = `${m.systolic}/${m.diastolic} mmHg`;
      if (m.type === 'blood_pressure') {
        if (m.systolic >= 160 || m.diastolic >= 100) push(m, 'alert-bp-crit', 'vital_critical', 'critical', `Stage 2 Hypertension detected: ${bp}`, bp);
        else if (m.systolic >= 140 || m.diastolic >= 90) push(m, 'alert-bp-warn', 'vital_warning', 'high', `Elevated Blood Pressure: ${bp}`, bp);
        else if (m.systolic < 90 || m.diastolic < 60) push(m, 'alert-bp-low', 'vital_warning', 'medium', `Hypotension recorded: ${bp}`, bp);
      } else if (m.type === 'spo2') {
        if (v < 90) push(m, 'alert-spo2-crit', 'vital_critical', 'critical', `Critical Hypoxemia: SpO2 ${v}%`, `${v}%`);
        else if (v < 95) push(m, 'alert-spo2-warn', 'vital_warning', 'high', `Low Oxygen Saturation: SpO2 ${v}%`, `${v}%`);
      } else if (m.type === 'pulse' && (v > 110 || v < 45)) {
        push(m, 'alert-hr-warn', 'vital_warning', 'high', `Abnormal Heart Rate: ${v} bpm`, `${v} bpm`);
      } else if (m.type === 'pain_score' && v >= 7) {
        push(m, 'alert-pain', 'vital_warning', 'high', `Severe pre-operative pain score reported: ${v}/10`, `${v}/10`);
      } else if (m.type === 'temperature' && v >= 38.3) {
        push(m, 'alert-fever', 'vital_critical', 'critical', `Pre-operative fever detected: ${v} ${m.unit}`, `${v} ${m.unit}`);
      }
    });

  ids.forEach((pid) => {
    const prof = rawProfile(pid);
    if (prof?.surgeryDate) {
      const diffDays = Math.ceil((new Date(prof.surgeryDate) - Date.now()) / DAY);
      if (diffDays >= 0 && diffDays <= 7) {
        alerts.push({
          id: `alert-surg-${pid}`,
          patientId: pid,
          patientName: nameOf(pid),
          type: 'upcoming_surgery',
          severity: diffDays <= 2 ? 'critical' : 'high',
          message: `Upcoming Surgery in ${diffDays} day${diffDays === 1 ? '' : 's'} (${prof.surgeryType || 'Scheduled Procedure'})`,
          timestamp: prof.surgeryDate,
          value: `${diffDays} days remaining`,
        });
      }
    }
    if (!all('exerciseSessions').some((s) => s.patient === pid && within(s.completedAt, 3))) {
      alerts.push({
        id: `alert-inact-${pid}`,
        patientId: pid,
        patientName: nameOf(pid),
        type: 'inactivity',
        severity: 'medium',
        message: 'Zero exercise sessions logged in the last 3 days',
        timestamp: iso(),
        value: '3+ days inactive',
      });
    }
  });

  const rank = { critical: 1, high: 2, medium: 3, info: 4 };
  return alerts.sort((a, b) => (rank[a.severity] || 5) - (rank[b.severity] || 5) || new Date(b.timestamp) - new Date(a.timestamp));
};

const fullReport = (me, pid) => {
  const patient = findPatientUser(pid);
  const measurements = measurementsOf(pid);
  const sessions = sessionsOf(pid);
  const assignments = all('exerciseAssignments').filter((a) => a.patient === pid).sort(desc('createdAt')).map(withExercise);
  audit(me, 'PATIENT_REPORT_GENERATED', 'PatientReport', pid);
  return {
    success: true,
    report: {
      generatedAt: iso(),
      patient: { id: patient._id, name: `${patient.firstName} ${patient.lastName}`, email: patient.email, phone: patient.phone },
      profile: patientProfile(pid, 'firstName lastName email'),
      summary: {
        totalExercisesAssigned: assignments.length,
        totalSessionsLogged: sessions.length,
        completedSessionsCount: sessions.filter((s) => s.status === 'completed').length,
        totalMinutesLogged: sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0),
        totalMeasurementsRecorded: measurements.length,
      },
      recentMeasurements: measurements.slice(0, 30),
      recentSessions: sessions.slice(0, 30),
      assignments,
    },
  };
};

const periodReport = (pid, days) => {
  const patient = findPatientUser(pid);
  const measurements = measurementsOf(pid).filter((m) => within(m.measuredAt, days));
  const sessions = sessionsOf(pid).filter((s) => within(s.completedAt, days));
  const completedSessionsCount = sessions.filter((s) => s.status === 'completed').length;
  const summary = {
    totalMinutesLogged: sessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0),
    completedSessionsCount,
    totalMeasurements: measurements.length,
  };
  if (days === 7) {
    const active = all('exerciseAssignments').filter((a) => a.patient === pid && a.status === 'active').length;
    summary.adherenceRate = active ? Math.min(100, Math.round((completedSessionsCount / (active * 7)) * 100)) : 0;
  }
  return {
    success: true,
    reportType: days === 7 ? 'weekly' : 'monthly',
    period: `Last ${days} Days`,
    patient: { id: patient._id, name: `${patient.firstName} ${patient.lastName}`, email: patient.email },
    profile: patientProfile(pid, 'firstName lastName email'),
    summary,
    sessions,
    measurements,
  };
};

const measurementsCsv = (me, pid) => {
  const rows = measurementsOf(pid)
    .reverse()
    .map((m) => {
      const dt = new Date(m.measuredAt);
      const v1 = m.type === 'blood_pressure' ? m.systolic : m.numericValue ?? m.textValue ?? '';
      const v2 = m.type === 'blood_pressure' ? m.diastolic : '';
      const notes = (m.notes || '').replace(/"/g, '""');
      return `"${dt.toISOString().split('T')[0]}","${dt.toTimeString().split(' ')[0]}","${m.type}","${v1}","${v2}","${m.unit}","${notes}"`;
    });
  audit(me, 'PATIENT_MEASUREMENTS_EXPORTED_CSV', 'HealthMeasurement', pid);
  return 'Date,Time,MeasurementType,ValueOrSystolic,Diastolic,Unit,Notes\n' + rows.join('\n');
};

const listFollowUps = (predicate) => {
  const followUps = all('followUps')
    .filter(predicate)
    .sort(asc('scheduledDate'))
    .map((f) => ({ ...withDoctor(f), patient: pickUser(f.patient, 'firstName lastName email') }));
  return { success: true, count: followUps.length, followUps };
};

// Same 400 shape as the backend's zod `validate` middleware (backend/validators/schemas.js)
const validate = (rules) => {
  const errors = rules.filter(([ok]) => !ok).map(([, field, message]) => ({ field, message }));
  if (errors.length) throw new ApiError(400, 'Invalid input data', { success: false, message: 'Invalid input data', errors });
};
const minLen = (value, n) => typeof value === 'string' && value.trim().length >= n;

const filterMeasurements = (pid, { type, days = 30 }) =>
  measurementsOf(pid).filter(
    (m) => (!type || type === 'all' || m.type === type) && (!days || days === 'all' || within(m.measuredAt, parseInt(days, 10)))
  );

// ---------- routes: 'METHOD /path/:param' -> handler({ me, body, query, params }) ----------

const routes = {
  // Auth
  'POST /auth/login': ({ body }) => {
    const user = all('users').find((u) => u.email === String(body.email || '').toLowerCase().trim());
    if (!user || user.password !== body.password) fail(401, 'Invalid email or password.');
    if (!user.isActive) fail(403, 'Account has been deactivated. Please contact your clinical coordinator.');
    update(user, { lastLogin: iso() });
    audit(user, 'USER_LOGIN', 'User', user._id, { role: user.role });
    localStorage.setItem(SESSION_KEY, user._id);
    return { success: true, message: 'Logged in successfully', user: safeUser(user) };
  },

  'POST /auth/logout': ({ me }) => {
    if (me) audit(me, 'USER_LOGOUT', 'User', me._id);
    localStorage.removeItem(SESSION_KEY);
    return { success: true, message: 'Logged out successfully' };
  },

  'GET /auth/me': ({ me }) => ({
    success: true,
    user: safeUser(me),
    profile:
      me.role === 'patient'
        ? patientProfile(me._id)
        : me.role === 'doctor'
          ? all('doctorProfiles').find((p) => p.user === me._id) || null
          : null,
  }),

  'POST /auth/register-doctor': ({ me, body }) => {
    const { specialization, department, licenseNumber, hospitalAffiliation, consultationHours } = body;
    validate([
      [minLen(body.password, 8), 'password', 'Password must be at least 8 characters long'],
      [minLen(body.firstName, 2), 'firstName', 'First name is required'],
      [minLen(body.lastName, 2), 'lastName', 'Last name is required'],
      [minLen(specialization, 2), 'specialization', 'Specialization is required'],
      [minLen(department, 2), 'department', 'Department is required'],
      [minLen(licenseNumber, 3), 'licenseNumber', 'License number is required'],
    ]);
    const doctor = createUser(body, 'doctor', 'A user account with this email already exists.');
    const profile = insert('doctorProfiles', {
      user: doctor._id,
      specialization,
      department,
      licenseNumber,
      ...(hospitalAffiliation && { hospitalAffiliation }),
      ...(consultationHours && { consultationHours }),
    });
    audit(me, 'DOCTOR_ACCOUNT_CREATED', 'DoctorProfile', doctor._id, { email: doctor.email, specialization, licenseNumber });
    return { success: true, message: 'Doctor account registered successfully.', doctor: safeUser(doctor), profile };
  },

  'POST /auth/register-patient': ({ me, body }) => {
    const { dateOfBirth, gender, surgeryType, surgeryDate, hospitalNumber, emergencyContact, medicalConditions, assignedDoctorId } = body;
    validate([
      [minLen(body.firstName, 2), 'firstName', 'First name is required'],
      [minLen(body.lastName, 2), 'lastName', 'Last name is required'],
      [!Number.isNaN(Date.parse(dateOfBirth)), 'dateOfBirth', 'Valid date of birth is required'],
      [['male', 'female', 'other'].includes(gender), 'gender', "Invalid enum value. Expected 'male' | 'female' | 'other'"],
      [minLen(surgeryType, 3), 'surgeryType', 'Surgery type is required'],
      [!Number.isNaN(Date.parse(surgeryDate)), 'surgeryDate', 'Valid surgery date is required'],
    ]);
    const patient = createUser(body, 'patient', 'A patient account with this email already exists.');
    const doctorId = assignedDoctorId || (me.role === 'doctor' ? me._id : null);
    const profile = insert('patientProfiles', {
      user: patient._id,
      dateOfBirth: iso(dateOfBirth),
      gender,
      surgeryType,
      surgeryDate: iso(surgeryDate),
      hospitalNumber: hospitalNumber || '',
      ...(emergencyContact && { emergencyContact }),
      medicalConditions: medicalConditions || [],
      assignedDoctor: doctorId,
    });
    if (doctorId) insert('doctorPatientAssignments', { doctor: doctorId, patient: patient._id });
    audit(me, 'PATIENT_REGISTERED', 'PatientProfile', patient._id, { surgeryType, surgeryDate, assignedDoctor: doctorId });
    return { success: true, message: 'Patient registered successfully in prehabilitation program.', patient: safeUser(patient), profile };
  },

  'POST /auth/forgot-password': ({ body }) => {
    if (!body.email) fail(400, 'Email address is required.');
    const user = all('users').find((u) => u.email === String(body.email).toLowerCase().trim());
    if (!user) {
      return { success: true, message: 'If that email address exists in our system, password reset instructions have been generated.' };
    }
    const token = newId();
    update(user, { resetPasswordToken: token, resetPasswordExpires: Date.now() + 30 * 60 * 1000 });
    audit(user, 'PASSWORD_RESET_REQUESTED', 'User', user._id);
    return { success: true, message: 'Password reset token generated.', demoResetToken: token };
  },

  'POST /auth/reset-password': ({ body: { resetToken, newPassword } }) => {
    if (!resetToken || !newPassword || newPassword.length < 6) {
      fail(400, 'Valid reset token and new password (min 6 chars) are required.');
    }
    const user = all('users').find((u) => u.resetPasswordToken === resetToken && u.resetPasswordExpires > Date.now());
    if (!user) fail(400, 'Invalid or expired password reset token.');
    update(user, { password: newPassword, resetPasswordToken: undefined, resetPasswordExpires: undefined });
    audit(user, 'PASSWORD_RESET_COMPLETED', 'User', user._id);
    return { success: true, message: 'Password updated successfully. You can now log in with your new password.' };
  },

  // Patients
  'GET /patients/me': ({ me }) => {
    const profile = patientProfile(me._id);
    if (!profile) fail(404, 'Patient profile not found. Please contact your clinical team.');
    const days = Math.ceil((new Date(profile.surgeryDate) - Date.now()) / DAY);
    return { success: true, user: safeUser(me), profile, daysUntilSurgery: Math.max(0, days), isPreOp: days > 0 };
  },

  'PATCH /patients/me': ({ me, body: { phone, emergencyContact } }) => {
    if (phone) update(me, { phone });
    const profile = rawProfile(me._id);
    if (profile && emergencyContact) update(profile, { emergencyContact });
    audit(me, 'PATIENT_PROFILE_UPDATED', 'PatientProfile', me._id);
    return { success: true, message: 'Profile updated successfully.', profile };
  },

  'GET /patients/me/timeline': ({ me }) => {
    const timeline = buildTimeline(me, me._id);
    return { success: true, count: timeline.length, timeline };
  },

  'GET /patients': ({ me, query }) => {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 10;
    const search = (query.search || '').trim();
    const surgeryType = (query.surgeryType || '').trim();
    const allowed = me.role === 'doctor' ? doctorPatientIds(me._id) : null;

    const users = all('users')
      .filter((u) => u.role === 'patient' && (!allowed || allowed.includes(u._id)))
      .filter((u) => !search || matches(search, u.firstName, u.lastName, u.email))
      .sort(desc('createdAt'));
    const patients = users
      .slice((page - 1) * limit, page * limit)
      .map((u) => ({ user: safeUser(u), profile: patientProfile(u._id, 'firstName lastName email') }))
      .filter((r) => !surgeryType || (r.profile && matches(surgeryType, r.profile.surgeryType)));

    return { success: true, count: patients.length, total: users.length, page, totalPages: Math.ceil(users.length / limit) || 1, patients };
  },

  'GET /patients/:id/timeline': ({ me, params }) => {
    if (me.role === 'patient' && params.id !== me._id) fail(403, 'Access denied.');
    const timeline = buildTimeline(me, params.id);
    return { success: true, count: timeline.length, timeline };
  },

  'GET /patients/:id': ({ me, params }) => {
    const patient = byId('users', params.id);
    if (!patient || patient.role !== 'patient') fail(404, 'Patient not found.');
    const activeAssignments = all('exerciseAssignments')
      .filter((a) => a.patient === patient._id && a.status === 'active')
      .map(withExercise);
    audit(me, 'PATIENT_RECORD_VIEWED', 'PatientProfile', patient._id);
    return {
      success: true,
      patient: safeUser(patient),
      profile: patientProfile(patient._id),
      activeAssignments,
      adherence: {
        totalActiveExercises: activeAssignments.length,
        completedSessionsLast7Days: all('exerciseSessions').filter(
          (s) => s.patient === patient._id && s.status === 'completed' && within(s.completedAt, 7)
        ).length,
      },
      recentMeasurements: measurementsOf(patient._id).slice(0, 10),
    };
  },

  // Exercises
  'GET /exercises/library': ({ me, query: { category, search, activeOnly = 'true' } }) => {
    const exercises = all('exercises')
      .filter((e) => String(activeOnly) !== 'true' || me.role === 'admin' || e.isActive)
      .filter((e) => !category || category === 'all' || e.category === category)
      .filter((e) => !search || matches(search, e.title, e.description))
      .sort((a, b) => a.title.localeCompare(b.title));
    return { success: true, count: exercises.length, exercises };
  },

  'POST /exercises': ({ me, body }) => {
    validate([
      [minLen(body.title, 3), 'title', 'Title must be at least 3 characters'],
      [minLen(body.description, 5), 'description', 'Description is required'],
      [Array.isArray(body.instructions) && body.instructions.length > 0, 'instructions', 'At least one step instruction is required'],
    ]);
    const { _id, ...fields } = body;
    const exercise = insert('exercises', { ...fields, createdBy: me._id });
    audit(me, 'EXERCISE_CREATED', 'Exercise', exercise._id, { title: exercise.title, category: exercise.category });
    return { success: true, message: 'Exercise added to clinical library.', exercise };
  },

  'PATCH /exercises/:id': ({ me, body, params }) => {
    const exercise = byId('exercises', params.id);
    if (!exercise) fail(404, 'Exercise not found.');
    const { _id, ...patch } = body;
    update(exercise, patch);
    audit(me, 'EXERCISE_UPDATED', 'Exercise', exercise._id);
    return { success: true, message: 'Exercise updated successfully.', exercise };
  },

  'DELETE /exercises/:id': ({ me, params }) => {
    const exercise = byId('exercises', params.id);
    if (!exercise) fail(404, 'Exercise not found.');
    update(exercise, { isActive: false });
    audit(me, 'EXERCISE_DEACTIVATED', 'Exercise', exercise._id);
    return { success: true, message: 'Exercise deactivated successfully.' };
  },

  'GET /exercises/assigned': ({ me }) => {
    const doneToday = new Set(
      all('exerciseSessions')
        .filter((s) => s.patient === me._id && s.status === 'completed' && new Date(s.completedAt).toDateString() === new Date().toDateString())
        .map((s) => s.assignment)
    );
    const assignments = all('exerciseAssignments')
      .filter((a) => a.patient === me._id && a.status === 'active')
      .map((a) => ({ ...withDoctor(withExercise(a), 'firstName lastName email'), completedToday: doneToday.has(a._id) }));
    return { success: true, count: assignments.length, assignments };
  },

  'POST /exercises/assign': ({ me, body }) => {
    const { patientId, exerciseId, frequency, customizedDurationMinutes, customizedReps, customizedSets, customizedInstructions, startDate, endDate } = body;
    const exercise = byId('exercises', exerciseId);
    if (!exercise || !exercise.isActive) fail(404, 'Active exercise not found in library.');
    assertDoctorAccess(me, patientId, 'Access denied: You are not authorized to prescribe exercises to this patient.');
    const assignment = insert('exerciseAssignments', {
      patient: patientId,
      doctor: me._id,
      exercise: exerciseId,
      frequency: frequency || exercise.defaultFrequency,
      customizedDurationMinutes: customizedDurationMinutes || exercise.defaultDurationMinutes,
      customizedReps: customizedReps ?? exercise.defaultReps,
      customizedSets: customizedSets ?? exercise.defaultSets,
      customizedInstructions: customizedInstructions || '',
      startDate: startDate ? iso(startDate) : iso(),
      endDate: endDate ? iso(endDate) : null,
    });
    notify(patientId, 'New Exercise Prescribed', `Your doctor assigned a new exercise: "${exercise.title}". Check your daily routine.`, 'exercise_assigned', '/patient/exercises');
    audit(me, 'EXERCISE_ASSIGNED_TO_PATIENT', 'ExerciseAssignment', assignment._id, { patientId, exerciseTitle: exercise.title });
    return { success: true, message: 'Exercise prescribed to patient successfully.', assignment: withDoctor(withExercise(assignment)) };
  },

  'GET /exercises/patient/:id': ({ params }) => {
    const assignments = all('exerciseAssignments')
      .filter((a) => a.patient === params.id)
      .sort(desc('createdAt'))
      .map((a) => withDoctor(withExercise(a)));
    return { success: true, count: assignments.length, assignments };
  },

  // Exercise sessions
  'POST /exercise-sessions': ({ me, body }) => {
    const { assignmentId, status, durationMinutes, repetitionsCompleted, setsCompleted, perceivedExertion, patientFeedback } = body;
    const assignment = byId('exerciseAssignments', assignmentId);
    if (!assignment) fail(404, 'Exercise assignment not found.');
    if (assignment.patient !== me._id) fail(403, 'Forbidden: You cannot log sessions for another patient’s assigned routine.');
    const session = insert('exerciseSessions', {
      assignment: assignmentId,
      exercise: assignment.exercise,
      patient: me._id,
      status: status || 'completed',
      durationMinutes: durationMinutes || assignment.customizedDurationMinutes,
      repetitionsCompleted: repetitionsCompleted ?? assignment.customizedReps,
      setsCompleted: setsCompleted ?? assignment.customizedSets,
      perceivedExertion: perceivedExertion || 3,
      patientFeedback: patientFeedback || '',
      completedAt: iso(),
    });
    audit(me, 'EXERCISE_SESSION_LOGGED', 'ExerciseSession', session._id, { assignmentId, status });
    return { success: true, message: 'Exercise session recorded successfully.', session: withExercise(session) };
  },

  'GET /exercise-sessions/me': ({ me, query: { days = 30 } }) => {
    const sessions = sessionsOf(me._id).filter((s) => within(s.completedAt, parseInt(days, 10)));
    return { success: true, count: sessions.length, sessions };
  },

  'GET /exercise-sessions/patient/:id': ({ params, query: { days = 30 } }) => {
    const sessions = sessionsOf(params.id).filter((s) => within(s.completedAt, parseInt(days, 10)));
    return { success: true, count: sessions.length, sessions };
  },

  // Health measurements
  'POST /health-measurements': ({ me, body }) => {
    const { patientId, type, systolic, diastolic, numericValue, textValue, unit, measuredAt, notes } = body;
    if (!type || !unit) fail(400, 'Measurement type and unit are required.');
    let target = me._id;
    if (me.role === 'doctor') {
      if (!patientId) fail(400, 'Target patient ID is required for clinician logging.');
      target = String(patientId);
      assertDoctorAccess(me, target, 'Access denied: You are not authorized to log health measurements for this patient.');
    } else if (me.role === 'admin' && patientId) {
      target = String(patientId);
    }
    const isBp = type === 'blood_pressure';
    const measurement = insert('healthMeasurements', {
      patient: target,
      type,
      ...(isBp ? { systolic, diastolic } : { numericValue }),
      ...(textValue !== undefined && { textValue }),
      unit,
      measuredAt: measuredAt ? iso(measuredAt) : iso(),
      notes: notes || '',
    });
    audit(me, 'HEALTH_MEASUREMENT_LOGGED', 'HealthMeasurement', measurement._id, { type, unit, targetPatientId: target });
    return {
      success: true,
      message: 'Health record saved successfully.',
      measurement,
      guidanceNotice: safetyGuidance(type, { systolic, diastolic, numericValue }),
    };
  },

  'GET /health-measurements/me': ({ me, query }) => {
    const measurements = filterMeasurements(me._id, query);
    return { success: true, count: measurements.length, measurements };
  },

  'GET /health-measurements/patient/:id': ({ params, query }) => {
    const measurements = filterMeasurements(params.id, query);
    return { success: true, count: measurements.length, measurements };
  },

  'GET /health-measurements/trends': ({ me, query }) => {
    let pid = me._id;
    if (me.role !== 'patient') {
      if (!query.patientId) fail(400, 'Patient ID is required for clinical trend query.');
      pid = String(query.patientId);
      assertDoctorAccess(me, pid, 'Access denied: You are not authorized to view this patient’s health trends.');
    }
    const days = parseInt(query.days, 10) || 14;
    const byDate = {};
    all('healthMeasurements')
      .filter((m) => m.patient === pid && within(m.measuredAt, days))
      .sort(asc('measuredAt'))
      .forEach((m) => {
        const date = m.measuredAt.split('T')[0];
        const row = (byDate[date] ||= { date });
        if (m.type === 'blood_pressure') {
          row.systolic = m.systolic;
          row.diastolic = m.diastolic;
        } else if (m.type === 'mood') {
          row.mood = m.textValue || m.numericValue;
        } else if (m.type === 'nutrition_intake') {
          row.nutrition_intake = m.numericValue || (m.textValue ? 1 : 0);
          row.nutrition_text = m.textValue;
        } else if (TREND_KEYS[m.type]) {
          row[TREND_KEYS[m.type]] = m.numericValue;
        }
      });
    return { success: true, trendData: Object.values(byDate) };
  },

  // Reports
  'GET /reports/me': ({ me }) => fullReport(me, me._id),
  'GET /reports/me/csv': ({ me }) => measurementsCsv(me, me._id),
  'GET /reports/weekly': ({ me }) => periodReport(me._id, 7),
  'GET /reports/monthly': ({ me }) => periodReport(me._id, 30),
  'GET /reports/patient/:id/csv': ({ me, params }) => measurementsCsv(me, params.id),
  'GET /reports/patient/:id': ({ me, params }) => fullReport(me, params.id),
  'GET /reports/weekly/:id': ({ params }) => periodReport(params.id, 7),
  'GET /reports/monthly/:id': ({ params }) => periodReport(params.id, 30),

  // Clinical notes
  'POST /clinical-notes': ({ me, body: { patientId, noteType, content, followUpInstructions, isConfidential } }) => {
    validate([[minLen(content, 5), 'content', 'Clinical content must be at least 5 characters']]);
    const note = insert('clinicalNotes', {
      patient: patientId,
      doctor: me._id,
      ...(noteType && { noteType }),
      content,
      followUpInstructions: followUpInstructions || '',
      isConfidential: Boolean(isConfidential),
    });
    if (!isConfidential) {
      notify(patientId, 'New Clinical Guidance', 'Your surgical team has added new clinical instructions to your prehab care plan.', 'clinical_note', '/patient/dashboard');
    }
    audit(me, 'CLINICAL_NOTE_CREATED', 'ClinicalNote', note._id, { patientId, noteType, isConfidential });
    return { success: true, message: 'Clinical note saved successfully.', note: withDoctor(note, 'firstName lastName specialization') };
  },

  'GET /clinical-notes/patient/:id': ({ me, params }) => {
    const notes = all('clinicalNotes')
      .filter((n) => n.patient === params.id && (me.role !== 'patient' || !n.isConfidential))
      .sort(desc('createdAt'))
      .map((n) => withDoctor(n, 'firstName lastName specialization'));
    return { success: true, count: notes.length, notes };
  },

  // Follow-ups
  'POST /follow-ups': ({ me, body: { patientId, scheduledDate, reason, notes } }) => {
    validate([
      [!Number.isNaN(Date.parse(scheduledDate)), 'scheduledDate', 'Valid scheduled date is required'],
      [minLen(reason, 3), 'reason', 'Reason is required'],
    ]);
    const followUp = insert('followUps', { patient: patientId, doctor: me._id, scheduledDate: iso(scheduledDate), reason, notes: notes || '' });
    notify(patientId, 'Follow-Up Scheduled', `A prehab follow-up check has been scheduled for ${new Date(scheduledDate).toLocaleDateString()}: ${reason}`, 'reminder', '/patient/dashboard');
    audit(me, 'FOLLOW_UP_SCHEDULED', 'FollowUp', followUp._id, { patientId, scheduledDate, reason });
    return { success: true, message: 'Follow-up appointment scheduled successfully.', followUp: withDoctor(followUp) };
  },

  // Like the backend: query params are ignored; patients get theirs, doctors all of theirs.
  'GET /follow-ups': ({ me }) => listFollowUps(me.role === 'patient' ? (f) => f.patient === me._id : me.role === 'doctor' ? (f) => f.doctor === me._id : () => true),

  'GET /follow-ups/patient/:id': ({ params }) => listFollowUps((f) => f.patient === params.id),

  'PATCH /follow-ups/:id': ({ params, body: { status, notes } }) => {
    const followUp = byId('followUps', params.id);
    if (!followUp) fail(404, 'Follow-up not found.');
    update(followUp, { ...(status && { status }), ...(notes && { notes }) });
    return { success: true, message: 'Follow-up updated successfully.', followUp };
  },

  // Notifications
  'GET /notifications': ({ me }) => {
    const mine = all('notifications').filter((n) => n.recipient === me._id);
    return {
      success: true,
      unreadCount: mine.filter((n) => !n.isRead).length,
      notifications: mine.sort(desc('createdAt')).slice(0, 30),
    };
  },

  'PATCH /notifications/read-all': ({ me }) => {
    all('notifications').filter((n) => n.recipient === me._id && !n.isRead).forEach((n) => update(n, { isRead: true }));
    return { success: true, message: 'All notifications marked as read.' };
  },

  'PATCH /notifications/:id/read': ({ me, params }) => {
    const notification = byId('notifications', params.id);
    if (!notification || notification.recipient !== me._id) fail(404, 'Notification not found.');
    update(notification, { isRead: true });
    return { success: true, message: 'Notification marked as read.', notification };
  },

  // Admin
  'GET /admin/analytics': () => {
    const count = (col, pred = () => true) => all(col).filter(pred).length;
    return {
      success: true,
      analytics: {
        totalPatients: count('users', (u) => u.role === 'patient'),
        totalDoctors: count('users', (u) => u.role === 'doctor'),
        totalActiveExercises: count('exercises', (e) => e.isActive),
        totalSessions: count('exerciseSessions'),
        totalMeasurements: count('healthMeasurements'),
        sessionsLast7Days: count('exerciseSessions', (s) => within(s.completedAt, 7)),
        measurementsLast7Days: count('healthMeasurements', (m) => within(m.measuredAt, 7)),
      },
    };
  },

  'GET /admin/audit-logs': ({ query }) => {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 20;
    const logs = all('auditLogs')
      .filter((l) => !query.action || l.action === query.action)
      .sort(desc('timestamp'));
    return {
      success: true,
      total: logs.length,
      page,
      totalPages: Math.ceil(logs.length / limit) || 1,
      logs: logs.slice((page - 1) * limit, page * limit),
    };
  },

  'GET /admin/users': ({ query: { role, search } }) => {
    const users = all('users')
      .filter((u) => !role || role === 'all' || u.role === role)
      .filter((u) => !search || matches(search, u.firstName, u.lastName, u.email))
      .sort(desc('createdAt'))
      .map(safeUser);
    return { success: true, count: users.length, users };
  },

  'PATCH /admin/users/:id/toggle-status': ({ me, params }) => {
    const user = byId('users', params.id);
    if (!user) fail(404, 'User not found.');
    if (user._id === me._id) fail(400, 'You cannot deactivate your own administrative account.');
    update(user, { isActive: !user.isActive });
    audit(me, user.isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', 'User', user._id, { email: user.email, newStatus: user.isActive });
    return { success: true, message: `User account has been ${user.isActive ? 'activated' : 'deactivated'}.`, user: safeUser(user) };
  },

  // Doctors
  'GET /doctors': () => {
    const doctors = all('users')
      .filter((u) => u.role === 'doctor' && u.isActive)
      .map((u) => ({
        ...pickUser(u._id, 'firstName lastName email phone'),
        profile: all('doctorProfiles').find((p) => p.user === u._id) || null,
      }));
    return { success: true, count: doctors.length, doctors };
  },

  'GET /doctors/alerts': ({ me }) => {
    const alerts = buildAlerts(me);
    return { success: true, count: alerts.length, alerts };
  },

  'POST /doctors/assign-patient': ({ me, body: { doctorId, patientId, carePlanNotes } }) => {
    const doctor = byId('users', doctorId);
    if (!doctor || doctor.role !== 'doctor') fail(404, 'Doctor not found.');
    const patient = byId('users', patientId);
    if (!patient || patient.role !== 'patient') fail(404, 'Patient not found.');
    const fields = {
      status: 'active',
      carePlanNotes: carePlanNotes || 'Clinical prehabilitation protocol initiated.',
      assignedDate: iso(),
    };
    const existing = all('doctorPatientAssignments').find((a) => a.doctor === doctorId && a.patient === patientId);
    const assignment = existing ? update(existing, fields) : insert('doctorPatientAssignments', { doctor: doctorId, patient: patientId, ...fields });
    const profile = rawProfile(patientId);
    if (profile) update(profile, { assignedDoctor: doctorId });
    notify(patientId, 'Doctor Assigned', `Dr. ${doctor.lastName} has been assigned as your clinical prehabilitation supervisor.`, 'system', '/patient/dashboard');
    audit(me, 'DOCTOR_PATIENT_ASSIGNMENT_CREATED', 'DoctorPatientAssignment', assignment._id, { doctorId, patientId });
    return { success: true, message: 'Patient assigned to doctor successfully.', assignment };
  },

  'GET /doctors/:id': ({ params }) => {
    const doctor = byId('users', params.id);
    if (!doctor || doctor.role !== 'doctor') fail(404, 'Doctor not found.');
    return { success: true, doctor: safeUser(doctor), profile: all('doctorProfiles').find((p) => p.user === doctor._id) || null };
  },

  // Consent
  'GET /consent': ({ me }) => {
    const records = all('consentRecords').filter((r) => r.patient === me._id).sort(desc('timestamp'));
    const consentStatus = {
      privacy_policy_acceptance: false,
      prehab_program_agreement: false,
      health_data_sharing: false,
      research_participation_consent: false,
    };
    records.forEach((r) => {
      if (!consentStatus[r.consentType]) consentStatus[r.consentType] = r.agreed;
    });
    const isFullyConsented =
      consentStatus.privacy_policy_acceptance && consentStatus.prehab_program_agreement && consentStatus.health_data_sharing;
    return { success: true, consentStatus, isFullyConsented, consents: records, history: records };
  },

  'POST /consent': ({ me, body: { consents, consentType, agreed, version = 'v1.0' } }) => {
    const items = Array.isArray(consents) ? consents : consentType ? [{ consentType, agreed, version }] : null;
    if (!items) fail(400, 'Consent data is required.');
    const records = items.map((item) =>
      insert('consentRecords', {
        patient: me._id,
        consentType: item.consentType,
        agreed: Boolean(item.agreed),
        version: item.version || version,
      })
    );
    audit(me, 'PATIENT_CONSENT_RECORDED', 'ConsentRecord', me._id, { itemsCount: records.length });
    return { success: true, message: 'Patient consent documentation recorded successfully.', records };
  },

  'GET /consent/patient/:id': ({ params }) => {
    const records = all('consentRecords').filter((r) => r.patient === params.id).sort(desc('timestamp'));
    return { success: true, count: records.length, records };
  },
};

const PUBLIC = new Set(['POST /auth/login', 'POST /auth/logout', 'POST /auth/forgot-password', 'POST /auth/reset-password']);

const compiled = Object.entries(routes).map(([key, handler]) => {
  const [method, path] = key.split(' ');
  const names = [];
  const regex = new RegExp(`^${path.replace(/:(\w+)/g, (_, n) => (names.push(n), '([^/]+)'))}$`);
  return { key, method, regex, names, handler };
});

// Resolves like a parsed JSON response body; rejects with ApiError like the real client.
export const handle = async (method, path, { body, params: query } = {}) => {
  for (const route of compiled) {
    const match = route.method === method && path.match(route.regex);
    if (!match) continue;

    const sessionId = localStorage.getItem(SESSION_KEY);
    const me = sessionId ? byId('users', sessionId) : null;
    if (!PUBLIC.has(route.key)) {
      if (!me) fail(401, 'Authentication required. Please log in.');
      if (!me.isActive) fail(403, 'Account has been deactivated. Please contact your prehabilitation administrator.');
    }

    const params = Object.fromEntries(route.names.map((n, i) => [n, decodeURIComponent(match[i + 1])]));
    try {
      const data = route.handler({ me, body: body || {}, query: query || {}, params });
      // Strip undefined + detach from the store, like a real JSON response
      return typeof data === 'string' ? data : JSON.parse(JSON.stringify(data));
    } finally {
      save();
    }
  }
  fail(404, `Resource not found at ${path}`);
};
