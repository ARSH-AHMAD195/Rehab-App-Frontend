// Patients sign in with their mobile number. Firebase passwords need an email, so each patient's
// Firebase account uses a login alias built from the phone; the Auth API builds the same one
// (docs/backend-requirements-change-requests.md). It is never shown or used to send mail.

const DOMAIN = import.meta.env.VITE_PATIENT_LOGIN_EMAIL_DOMAIN || 'patients.fitforsurgery.app';

/** "+91 98765-43210" → "+919876543210". Keeps a leading + and digits only. */
export const normalizePhone = (input: string) => {
  const trimmed = input.trim();
  return (trimmed.startsWith('+') ? '+' : '') + trimmed.replace(/\D/g, '');
};

/** The Firebase login email for a patient's phone, e.g. p919876543210@patients.fitforsurgery.app */
export const phoneLoginEmail = (phone: string, domain = DOMAIN) => `p${normalizePhone(phone).replace('+', '')}@${domain}`;

/** Sign-in code as typed: digits only, at most 6. */
export const cleanCode = (input: string) => input.replace(/\D/g, '').slice(0, 6);
