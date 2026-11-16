import { describe, expect, it } from 'vitest';
import { validateNewPassword } from './password';

describe('validateNewPassword', () => {
  it('accepts 8+ matching characters', () => {
    expect(validateNewPassword('abcdefgh', 'abcdefgh')).toEqual({});
  });
  it('rejects short passwords', () => {
    expect(validateNewPassword('abc', 'abc').password).toBeDefined();
  });
  it('rejects a missing or different confirmation', () => {
    expect(validateNewPassword('abcdefgh', '').confirm).toBe('Type the password again.');
    expect(validateNewPassword('abcdefgh', 'abcdefgx').confirm).toBe('The two passwords do not match.');
  });
});
