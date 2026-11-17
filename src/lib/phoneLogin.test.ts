import { describe, expect, it } from 'vitest';
import { cleanCode, normalizePhone } from './phoneLogin';

describe('phone login', () => {
  it('normalizes a typed phone number', () => {
    expect(normalizePhone(' +91 98765-43210 ')).toBe('+919876543210');
    expect(normalizePhone('(0)98765 43210')).toBe('09876543210');
  });

  it('keeps a code to six digits', () => {
    expect(cleanCode('12 34-567')).toBe('123456');
  });
});
