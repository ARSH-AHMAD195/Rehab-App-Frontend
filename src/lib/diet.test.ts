import { describe, expect, it } from 'vitest';
import { newCode } from './diet';

describe('newCode', () => {
  it('makes an API code from a name', () => {
    expect(newCode('Evening snack', [])).toBe('EVENING_SNACK');
    expect(newCode('  Dal / sabzi (1 katori) ', [])).toBe('DAL_SABZI_1_KATORI');
    expect(newCode('दाल', [])).toBe('ITEM');
    expect(newCode('x'.repeat(60), [])).toHaveLength(36);
  });

  it('never repeats a code in the list', () => {
    expect(newCode('Milk', ['MILK'])).toBe('MILK_2');
    expect(newCode('Milk', ['MILK', 'MILK_2'])).toBe('MILK_3');
  });
});
