// In-browser stand-in for the old Express/MongoDB backend.
// All data lives in localStorage under KEY; delete that key to restore the demo seed.
const KEY = 'ffs_mock_db_v1';
const DAY = 864e5;

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
const iso = (d = new Date()) => new Date(d).toISOString();

// Mongoose schema defaults, per collection
const DEFAULTS = {
  users: () => ({ phone: '', isActive: true, isVerified: true, isEmailVerified: true, lastLogin: null }),
  patientProfiles: () => ({
    hospitalNumber: '',
    assignedDoctor: null,
    emergencyContact: { name: '', relationship: '', phone: '' },
    targetWeeklyExerciseMinutes: 150,
    heightCm: null,
    weightKg: null,
    bmi: null,
    allergies: [],
    currentMedications: [],
    baselineMobility: 'independent',
    smokingStatus: 'never',
    alcoholIntake: 'none',
    medicalConditions: [],
    clinicalNotesSummary: '',
  }),
  doctorProfiles: () => ({
    hospitalAffiliation: 'General Hospital Prehabilitation Care Center',
    consultationHours: 'Mon - Fri: 09:00 - 17:00',
  }),
  doctorPatientAssignments: () => ({ status: 'active', assignedDate: iso(), carePlanNotes: '' }),
  exercises: () => ({
    category: 'walking',
    instructions: [],
    videoUrl: '',
    defaultDurationMinutes: 15,
    defaultReps: 10,
    defaultSets: 3,
    defaultFrequency: 'Once Daily',
    contraindications: [],
    safetyNotes: 'Perform within comfortable limits. Stop immediately if you experience sharp pain or dizziness.',
    isActive: true,
  }),
  exerciseAssignments: () => ({
    startDate: iso(),
    endDate: null,
    frequency: 'Daily',
    customizedDurationMinutes: 15,
    customizedReps: 10,
    customizedSets: 3,
    customizedInstructions: '',
    status: 'active',
  }),
  exerciseSessions: () => ({
    completedAt: iso(),
    status: 'completed',
    durationMinutes: 15,
    repetitionsCompleted: 10,
    setsCompleted: 3,
    perceivedExertion: 3,
    patientFeedback: '',
  }),
  healthMeasurements: () => ({ measuredAt: iso(), notes: '' }),
  clinicalNotes: () => ({ noteType: 'progress_review', followUpInstructions: '', isConfidential: false }),
  followUps: () => ({ status: 'scheduled', notes: '' }),
  notifications: () => ({ type: 'system', isRead: false, link: '' }),
  consentRecords: () => ({ version: 'v1.0', ipAddress: '', timestamp: iso() }),
  auditLogs: () => ({ userEmail: '', role: '', targetId: '', ipAddress: '', userAgent: '', details: {}, timestamp: iso() }),
};

let db;

export const all = (col) => db[col];
export const byId = (col, id) => db[col].find((d) => d._id === String(id));
export const insert = (col, doc) => {
  const now = iso();
  const d = { _id: newId(), ...DEFAULTS[col](), createdAt: now, updatedAt: now, ...doc };
  db[col].push(d);
  return d;
};
export const update = (doc, patch) => Object.assign(doc, patch, { updatedAt: iso() });
export const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // storage full/blocked: data stays in memory for this tab
  }
};

// Port of backend/utils/seedData.js
const seed = () => {
  db = Object.fromEntries(Object.keys(DEFAULTS).map((c) => [c, []]));
  const at = (dayOffset, h = 0, m = 0) => {
    const d = new Date(Date.now() + dayOffset * DAY);
    d.setHours(h, m, 0, 0);
    return iso(d);
  };
  const pw = 'Password123!';

  const admin = insert('users', {
    email: 'admin@fitforsurgery.org', password: pw, role: 'admin',
    firstName: 'Clinical', lastName: 'Administrator', phone: '+1 (555) 010-0099',
  });

  const doctor1 = insert('users', {
    email: 'doctor.jenkins@fitforsurgery.org', password: pw, role: 'doctor',
    firstName: 'Sarah', lastName: 'Jenkins', phone: '+1 (555) 012-3456',
  });
  insert('doctorProfiles', {
    user: doctor1._id,
    specialization: 'Cardiothoracic Surgery & Prehab',
    department: 'Cardiovascular Surgical Unit',
    licenseNumber: 'MD-CARDIO-88941',
    hospitalAffiliation: 'Metropolitan General Hospital',
    consultationHours: 'Mon - Thu: 08:30 - 16:30',
  });

  const doctor2 = insert('users', {
    email: 'doctor.miller@fitforsurgery.org', password: pw, role: 'doctor',
    firstName: 'Robert', lastName: 'Miller', phone: '+1 (555) 014-7890',
  });
  insert('doctorProfiles', {
    user: doctor2._id,
    specialization: 'Orthopedic Surgery & Rehabilitation',
    department: 'Joint Reconstruction Division',
    licenseNumber: 'MD-ORTHO-41029',
    hospitalAffiliation: 'St. Jude Orthopedic Care Center',
    consultationHours: 'Tue - Fri: 09:00 - 17:00',
  });

  const patient1 = insert('users', {
    email: 'patient.john@example.com', password: pw, role: 'patient',
    firstName: 'John', lastName: 'Davis', phone: '+1 (555) 321-7654',
  });
  insert('patientProfiles', {
    user: patient1._id,
    dateOfBirth: iso('1964-06-14'),
    gender: 'male',
    surgeryType: 'Coronary Artery Bypass Graft (CABG)',
    surgeryDate: iso(Date.now() + 18 * DAY),
    hospitalNumber: 'PT-CABG-9921',
    assignedDoctor: doctor1._id,
    emergencyContact: { name: 'Martha Davis', relationship: 'Spouse', phone: '+1 (555) 321-7655' },
    targetWeeklyExerciseMinutes: 180,
    medicalConditions: ['Hypertension', 'Mild Dyslipidemia'],
    clinicalNotesSummary: 'Cardiovascular prehab target: optimize aerobic capacity and diaphragmatic breathing.',
  });
  insert('doctorPatientAssignments', {
    doctor: doctor1._id,
    patient: patient1._id,
    carePlanNotes: 'Phase 1 Cardiopulmonary Prehabilitation. Monitor SpO2 and resting heart rate closely.',
  });

  const patient2 = insert('users', {
    email: 'patient.margaret@example.com', password: pw, role: 'patient',
    firstName: 'Margaret', lastName: 'Thompson', phone: '+1 (555) 456-1122',
  });
  insert('patientProfiles', {
    user: patient2._id,
    dateOfBirth: iso('1958-11-20'),
    gender: 'female',
    surgeryType: 'Total Knee Arthroplasty (Right)',
    surgeryDate: iso(Date.now() + 25 * DAY),
    hospitalNumber: 'PT-ORTHO-4481',
    assignedDoctor: doctor2._id,
    emergencyContact: { name: 'David Thompson', relationship: 'Son', phone: '+1 (555) 456-9988' },
    targetWeeklyExerciseMinutes: 150,
    medicalConditions: ['Osteoarthritis', 'Controlled Hypothyroidism'],
    clinicalNotesSummary: 'Quadriceps strengthening, sit-to-stand endurance, and range-of-motion flexibility.',
  });
  insert('doctorPatientAssignments', {
    doctor: doctor2._id,
    patient: patient2._id,
    carePlanNotes: 'Pre-operative lower extremity kinetic chain stabilization.',
  });

  const exercises = [
    {
      title: 'Diaphragmatic Deep Breathing & Lung Expansion',
      description: 'Increases vital lung capacity, improves alveolar ventilation, and prevents post-operative atelectasis.',
      category: 'breathing',
      instructions: [
        'Sit upright in a supportive chair with feet flat on the floor.',
        'Place one hand gently on your upper chest and the other hand over your abdomen.',
        'Inhale slowly and deeply through your nose for 4 seconds, feeling your stomach push outward.',
        'Hold your breath comfortably for 2 seconds.',
        'Exhale slowly through pursed lips for 6 seconds as if blowing out a candle.',
        'Repeat for 10 controlled breathing cycles.',
      ],
      videoUrl: 'https://www.youtube.com/watch?v=g2Woo8x-mX4',
      defaultDurationMinutes: 10, defaultReps: 10, defaultSets: 3, defaultFrequency: 'Twice Daily',
      contraindications: ['Severe untreated pneumothorax', 'Acute thoracic trauma without medical clearance'],
      safetyNotes: 'Stop if you feel lightheaded. Inhale slowly and do not hyperventilate.',
    },
    {
      title: 'Sit-to-Stand Chair Squats (Quadriceps Strength)',
      description: 'Builds functional lower-body strength and independence for post-operative bed and chair transfers.',
      category: 'strength',
      instructions: [
        'Sit upright on a sturdy, armless dining chair with feet hip-width apart.',
        'Cross your arms across your chest or hold them extended forward for balance.',
        'Lean slightly forward and push through your heels to stand fully upright.',
        'Pause momentarily at the top without locking knees.',
        'Slowly lower your hips back onto the chair with control taking 3 seconds.',
        'Complete 10-12 controlled repetitions per set.',
      ],
      videoUrl: 'https://www.youtube.com/watch?v=7I8Vz0oYcCY',
      defaultDurationMinutes: 15, defaultReps: 10, defaultSets: 3, defaultFrequency: 'Daily',
      contraindications: ['Acute unstable fracture', 'Severe unmanaged joint inflammation'],
      safetyNotes: 'Keep knees aligned with toes. Do not drop rapidly onto the chair.',
    },
    {
      title: 'Low-Impact Brisk Walking (Aerobic Endurance)',
      description: 'Improves cardiopulmonary reserve, vascular circulation, and functional walking capacity.',
      category: 'walking',
      instructions: [
        'Wear supportive, non-skid walking shoes.',
        'Begin with a 3-minute gentle warm-up stroll.',
        'Increase to a moderate brisk pace where you can comfortably speak in short sentences.',
        'Swing arms naturally at your sides and maintain an upright posture.',
        'Conclude with 2 minutes of relaxed walking to cool down.',
      ],
      videoUrl: 'https://www.youtube.com/watch?v=enYITYwvPAQ',
      defaultDurationMinutes: 20, defaultReps: 1, defaultSets: 1, defaultFrequency: 'Daily',
      contraindications: ['Unstable angina', 'Severe decompensated heart failure', 'Active dizziness'],
      safetyNotes: 'Walk on flat, obstacle-free surfaces. Carry water and hydrate.',
    },
    {
      title: 'Ankle Pumps & Circulatory Calisthenics',
      description: 'Promotes venous return, prevents lower-extremity blood pooling, and mitigates DVT risks.',
      category: 'mobility',
      instructions: [
        'Sit comfortably or recline with legs extended.',
        'Point your toes downward away from your shin as far as comfortable.',
        'Pull your toes backward toward your kneecap.',
        'Perform in a smooth rhythmic pump motion 25 times per leg.',
      ],
      videoUrl: 'https://www.youtube.com/watch?v=0kFp6cT4W10',
      defaultDurationMinutes: 8, defaultReps: 25, defaultSets: 3, defaultFrequency: '3x Daily',
      contraindications: ['Active untreated acute deep vein thrombosis in lower extremity'],
      safetyNotes: 'Move ankles gently through complete pain-free range of motion.',
    },
    {
      title: 'Upper Body Wall Push-Ups',
      description: 'Strengthens pectoral, shoulder, and triceps muscle groups for safe post-operative crutch or walker use.',
      category: 'strength',
      instructions: [
        'Stand facing a sturdy flat wall about arms length away.',
        'Place palms flat on the wall at shoulder height and shoulder-width apart.',
        'Bend elbows slowly to lower your chest toward the wall over 2-3 seconds.',
        'Press through palms to return to starting position.',
      ],
      videoUrl: 'https://www.youtube.com/watch?v=a6YZbtd3_hM',
      defaultDurationMinutes: 10, defaultReps: 12, defaultSets: 3, defaultFrequency: 'Daily',
      contraindications: ['Recent sternotomy prior to clearance', 'Acute rotator cuff tear'],
      safetyNotes: 'Keep your spine straight without arching your lower back.',
    },
  ].map((e) => insert('exercises', { ...e, createdBy: admin._id }));

  const assign = (patient, doctor, exercise, fields) =>
    insert('exerciseAssignments', { patient: patient._id, doctor: doctor._id, exercise: exercise._id, ...fields });

  const p1Breathing = assign(patient1, doctor1, exercises[0], {
    frequency: 'Twice Daily', customizedDurationMinutes: 10, customizedReps: 10, customizedSets: 3,
    customizedInstructions: 'Do one set after waking up and one set before dinner. Keep track of deep inhalation capacity.',
  });
  const p1Walking = assign(patient1, doctor1, exercises[2], {
    frequency: 'Daily', customizedDurationMinutes: 20, customizedReps: 1, customizedSets: 1,
    customizedInstructions: 'Target comfortable conversational pace on flat indoor walking track or quiet sidewalk.',
  });
  assign(patient1, doctor1, exercises[3], {
    frequency: '3x Daily', customizedDurationMinutes: 8, customizedReps: 20, customizedSets: 2,
    customizedInstructions: 'Essential for circulation before evening rest.',
  });
  assign(patient2, doctor2, exercises[1], {
    frequency: 'Daily', customizedDurationMinutes: 15, customizedReps: 10, customizedSets: 3,
    customizedInstructions: 'Focus on slow controlled descent. Keep knee aligned with second toe.',
  });
  assign(patient2, doctor2, exercises[3], {
    frequency: 'Twice Daily', customizedDurationMinutes: 10, customizedReps: 25, customizedSets: 3,
    customizedInstructions: 'Perform while sitting with leg slightly elevated.',
  });

  for (let i = 6; i >= 0; i--) {
    insert('exerciseSessions', {
      assignment: p1Breathing._id, exercise: exercises[0]._id, patient: patient1._id,
      completedAt: at(-i, 10, 30), durationMinutes: 10, repetitionsCompleted: 10, setsCompleted: 3,
      perceivedExertion: 3, patientFeedback: i === 0 ? 'Felt energetic this morning!' : 'Good relaxed breathing.',
    });
    if (i % 2 === 0) {
      insert('exerciseSessions', {
        assignment: p1Walking._id, exercise: exercises[2]._id, patient: patient1._id,
        completedAt: at(-i, 16), durationMinutes: 20, repetitionsCompleted: 1, setsCompleted: 1,
        perceivedExertion: 4, patientFeedback: 'Completed 20 minutes brisk walking without breathless sensations.',
      });
    }
  }

  const measure = (patient, fields) => insert('healthMeasurements', { patient: patient._id, ...fields });
  for (let day = 10; day >= 0; day--) {
    const measuredAt = at(-day, 8);
    measure(patient1, {
      type: 'blood_pressure', unit: 'mmHg', measuredAt, notes: 'Morning resting reading',
      systolic: 122 + Math.floor(Math.sin(day) * 6), diastolic: 78 + Math.floor(Math.cos(day) * 4),
    });
    measure(patient1, { type: 'pulse', numericValue: 72 + Math.floor(Math.sin(day * 2) * 5), unit: 'bpm', measuredAt, notes: 'Resting pulse' });
    measure(patient1, { type: 'spo2', numericValue: 97 + (day % 3 === 0 ? 1 : 0), unit: '%', measuredAt, notes: 'Room air' });
    measure(patient1, { type: 'step_count', numericValue: 3800 + day * 180 + Math.floor(Math.random() * 400), unit: 'steps', measuredAt });
    measure(patient1, { type: 'pain_score', numericValue: Math.max(1, 3 - Math.floor(day / 4)), unit: 'score 0-10', measuredAt });
  }
  for (let day = 5; day >= 0; day--) {
    const measuredAt = at(-day, 9, 15);
    measure(patient2, { type: 'blood_pressure', systolic: 128 + day, diastolic: 82, unit: 'mmHg', measuredAt });
    measure(patient2, { type: 'pain_score', numericValue: 4, unit: 'score 0-10', measuredAt, notes: 'Mild right knee joint stiffness in morning' });
  }

  insert('clinicalNotes', {
    patient: patient1._id, doctor: doctor1._id, noteType: 'preop_assessment',
    content: 'Initial cardiothoracic prehab assessment completed. Patient demonstrates strong motivation. Exercise tolerance satisfactory with baseline 6-minute walk distance. Prescribed lung expansion and graded walking program.',
    followUpInstructions: 'Maintain daily logs and continue prescribed beta-blocker as scheduled.',
  });

  const followUpDate = at(5, 11);
  insert('followUps', {
    patient: patient1._id, doctor: doctor1._id, scheduledDate: followUpDate,
    reason: 'Cardiopulmonary Prehab Midpoint Check-in',
    notes: 'Review SpO2 trends and adjust walking duration to 25 minutes if tolerance remains stable.',
  });

  insert('notifications', {
    recipient: patient1._id, title: 'Welcome to Fit for Surgery', type: 'exercise_assigned', link: '/patient/exercises',
    message: 'Your surgical prehabilitation plan is now active. Dr. Jenkins has prescribed 3 targeted exercises.',
  });
  insert('notifications', {
    recipient: patient1._id, title: 'Upcoming Clinical Follow-Up', type: 'reminder', link: '/patient/dashboard',
    message: `Midpoint review scheduled with Dr. Jenkins on ${new Date(followUpDate).toLocaleDateString()}.`,
  });
};

export const resetDb = () => {
  seed();
  save();
};

try {
  db = JSON.parse(localStorage.getItem(KEY));
} catch {
  db = null;
}
if (!db) resetDb();
