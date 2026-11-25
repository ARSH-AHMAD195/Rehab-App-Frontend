/** Build-time switches for features waiting on backend fields (docs/backend-request-2026-11-25.md). Off unless set to 'true'. */
export const MEAL_ADVICE = import.meta.env.VITE_MEAL_ADVICE === 'true';
export const PATIENT_ADVICE = import.meta.env.VITE_PATIENT_ADVICE === 'true';
