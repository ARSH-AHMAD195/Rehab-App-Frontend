/** Build-time switches for features waiting on backend support (docs/backend-request-2026-11-25.md). Off unless set to 'true'. */
// Draft endpoint for past advice saves; nothing is fetched when off.
export const ADVICE_HISTORY = import.meta.env.VITE_ADVICE_HISTORY === 'true';
