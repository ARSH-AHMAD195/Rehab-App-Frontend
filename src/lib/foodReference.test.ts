import { describe, expect, it } from 'vitest';
import { findFood } from './foodReference';

describe('findFood', () => {
  it('matches ignoring case and surrounding spaces', () => {
    expect(findFood('  poha (PLAIN, cooked) ')?.serving).toBe('1 katori (150 g)');
  });
  it('returns undefined for unknown, partial or empty names', () => {
    expect(findFood('Moonrock')).toBeUndefined();
    expect(findFood('Poha')).toBeUndefined();
    expect(findFood('  ')).toBeUndefined();
  });
});
