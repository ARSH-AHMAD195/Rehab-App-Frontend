import { MIN } from './constants';

// Unambiguous characters only (no 0/O, 1/l/I) since this is read out or copied to the user.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';

export const MIN_PASSWORD_LENGTH = MIN.password;

export const generatePassword = (length = 14) => {
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length]).join('');
};
