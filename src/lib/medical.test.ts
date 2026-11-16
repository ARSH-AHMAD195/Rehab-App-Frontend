import { describe, expect, it } from 'vitest';
import { bmi, conditionNames, EMPTY_MEDICAL_FORM, flipTriState, foldListedConditions, formToMedical, hasCondition, medicalChanges, medicalToForm, setCondition } from './medical';
import type { MedicalProfile } from '../types/api';

describe('medical form', () => {
  it('keeps yes, no and not-recorded apart for yes/no fields', () => {
    const form = medicalToForm({ anaemia: false, chemotherapy: true, radiotherapy: null } as MedicalProfile);
    expect([form.anaemia, form.chemotherapy, form.radiotherapy]).toEqual(['false', 'true', '']);
    const saved = formToMedical(form);
    expect([saved.anaemia, saved.chemotherapy, saved.radiotherapy]).toEqual([false, true, null]);
  });

  it('sends no untouched field, even one an older API version does not return', () => {
    const before = { heightCm: 170 } as MedicalProfile;
    expect(medicalChanges(before, formToMedical({ ...EMPTY_MEDICAL_FORM, heightCm: '170' }))).toEqual({});
  });

  it('works out BMI once height and weight are both known', () => {
    expect(bmi(170, 70)).toBe(24.2);
    expect(bmi(null, 70)).toBeNull();
    expect(bmi(170, null)).toBeNull();
  });

  it('clears follow-up answers whose question is hidden', () => {
    const answered = { lastChemoDate: '2026-01-01', chemoSchedule: 'FOLFOX', smokingQuitDate: '2020-01-01', hypertensionControlled: 'true', ihdStatus: 'STABLE' };
    const hidden = formToMedical({ ...EMPTY_MEDICAL_FORM, ...answered, chemotherapy: 'false', smokingStatus: 'CURRENT' });
    expect([hidden.lastChemoDate, hidden.chemoSchedule, hidden.smokingQuitDate, hidden.hypertensionControlled, hidden.ihdStatus]).toEqual([null, null, null, null, null]);
    const shown = formToMedical({
      ...EMPTY_MEDICAL_FORM,
      ...answered,
      chemotherapy: 'true',
      smokingStatus: 'FORMER',
      comorbidities: 'Hypertension, Ischaemic heart disease',
    });
    expect([shown.lastChemoDate, shown.chemoSchedule, shown.smokingQuitDate, shown.hypertensionControlled, shown.ihdStatus]).toEqual(['2026-01-01', 'FOLFOX', '2020-01-01', true, 'STABLE']);
  });

  it('flips yes and no for a question asked the other way round, and round-trips', () => {
    expect(['', 'true', 'false'].map(flipTriState)).toEqual(['', 'false', 'true']);
    expect(['', 'true', 'false'].map((v) => flipTriState(flipTriState(v)))).toEqual(['', 'true', 'false']);
  });
});

describe('comorbidity checkboxes', () => {
  it('reads condition codes as ticks and other text, and saves them back as codes plus OTHER', () => {
    const form = medicalToForm({ conditions: ['DM', 'HTN', 'OTHER'], otherConditions: 'Asthma' } as MedicalProfile);
    expect(form.comorbidities).toBe('Hypertension, Diabetes');
    expect(form.otherComorbidities).toBe('Asthma');
    expect(hasCondition(form.comorbidities, 'Chronic kidney disease')).toBe(false);
    const saved = formToMedical(form);
    expect([saved.conditions, saved.otherConditions]).toEqual([['HTN', 'DM', 'OTHER'], 'Asthma']);
    expect(conditionNames(saved)).toEqual(['Hypertension', 'Diabetes', 'Asthma']);
  });

  it('adds and removes a tick, whatever the case it was saved in', () => {
    expect(setCondition('', 'Diabetes', true)).toBe('Diabetes');
    expect(setCondition('hypertension, Diabetes', 'Hypertension', false)).toBe('Diabetes');
  });

  it('ticks a listed condition typed as other text, so its follow-up shows', () => {
    const folded = foldListedConditions({ ...EMPTY_MEDICAL_FORM, comorbidities: 'Diabetes', otherComorbidities: 'hypertension, Asthma, DM' });
    expect(folded.comorbidities).toBe('Diabetes, Hypertension');
    expect(folded.otherComorbidities).toBe('Asthma, DM');
    const nothingListed = { ...EMPTY_MEDICAL_FORM, otherComorbidities: 'Asthma' };
    expect(foldListedConditions(nothingListed)).toBe(nothingListed);
  });

  it('does not count a reordered list as a change', () => {
    const before = { conditions: ['DM', 'HTN'], allergies: ['Latex', 'Penicillin'] } as MedicalProfile;
    const after = { ...formToMedical(EMPTY_MEDICAL_FORM), conditions: ['HTN', 'DM'] as MedicalProfile['conditions'], allergies: ['Penicillin', 'Latex'] };
    expect(medicalChanges(before, after)).not.toHaveProperty('conditions');
    expect(medicalChanges(before, after)).not.toHaveProperty('allergies');
    expect(medicalChanges(before, { ...after, conditions: ['HTN'] })).toHaveProperty('conditions');
  });

  it('saves nothing ticked or typed as null', () => {
    const saved = formToMedical(EMPTY_MEDICAL_FORM);
    expect([saved.conditions, saved.otherConditions]).toEqual([null, null]);
  });
});
