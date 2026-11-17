// Patients sign in with their mobile number and a 6-digit code from their doctor.

/** "+91 98765-43210" → "+919876543210". Keeps a leading + and digits only. */
export const normalizePhone = (input: string) => {
  const trimmed = input.trim();
  return (trimmed.startsWith('+') ? '+' : '') + trimmed.replace(/\D/g, '');
};

/** Sign-in code as typed: digits only, at most 6. */
export const cleanCode = (input: string) => input.replace(/\D/g, '').slice(0, 6);
