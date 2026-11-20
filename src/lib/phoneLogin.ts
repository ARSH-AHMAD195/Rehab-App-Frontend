// Patients sign in with their mobile number and a 6-digit code from their doctor.

/** "+91 98765-43210" or a stored "+919876543210" → "9876543210": digits only, a leading 91 or 0 dropped. */
export const normalizePhone = (input: string) => input.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');

/** Sign-in code as typed: digits only, at most 6. */
export const cleanCode = (input: string) => input.replace(/\D/g, '').slice(0, 6);
