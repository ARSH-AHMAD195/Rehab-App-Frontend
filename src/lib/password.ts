export const MIN_PASSWORD_LENGTH = 8;

/** English messages (callers translate). Empty object = valid. */
export const validateNewPassword = (password: string, confirm: string) => {
  const errors: { password?: string; confirm?: string } = {};
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = 'Use at least 8 characters.';
  if (!confirm) errors.confirm = 'Type the password again.';
  else if (confirm !== password) errors.confirm = 'The two passwords do not match.';
  return errors;
};
