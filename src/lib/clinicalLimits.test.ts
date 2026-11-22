import { describe, expect, it } from 'vitest';
import { toLimit, validateLimits } from './clinicalLimits';

const b = { min: 0, max: 100 };

describe('validateLimits', () => {
  it('accepts one or both limits inside the range', () => {
    expect(validateLimits('10', '', b)).toEqual({});
    expect(validateLimits('', '90', b)).toEqual({});
    expect(validateLimits('10', '90', b)).toEqual({});
  });
  it('needs at least one limit (a range is removed only through Remove range)', () => {
    expect(validateLimits('', ' ', b).low).toBeTruthy();
  });
  it('requires low below high', () => {
    expect(validateLimits('50', '50', b).low).toBeTruthy();
    expect(validateLimits('60', '50', b).low).toBeTruthy();
  });
  it('rejects values outside min..max and non-numbers', () => {
    expect(validateLimits('-1', '', b).low).toBeTruthy();
    expect(validateLimits('', '101', b).high).toBeTruthy();
    expect(validateLimits('abc', '', b).low).toBeTruthy();
  });
  it('toLimit maps empty to null', () => {
    expect(toLimit('')).toBeNull();
    expect(toLimit('2.5')).toBe(2.5);
  });
});
