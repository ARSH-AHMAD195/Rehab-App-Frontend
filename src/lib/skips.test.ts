import { describe, expect, it } from 'vitest';
import { clearAllSkips, readSkips, writeSkips } from './skips';

describe('skipped exercises (on this device)', () => {
  it('stores today, drops older days and clears on sign-out', () => {
    writeSkips('p1', '2026-10-30', { a: 'Too tired' });
    writeSkips('p1', '2026-10-31', { b: 'Pain or discomfort' });
    writeSkips('p2', '2026-10-30', { c: 'No time' });

    expect(readSkips('p1', '2026-10-31')).toEqual({ b: 'Pain or discomfort' });
    // Yesterday's entry for p1 is gone; another patient's is untouched
    expect(localStorage.getItem('ffs_skips_p1_2026-10-30')).toBeNull();
    expect(readSkips('p2', '2026-10-30')).toEqual({ c: 'No time' });

    // Without a date nothing is read or cleaned up
    expect(readSkips('p2', '')).toEqual({});
    expect(readSkips('p2', '2026-10-30')).toEqual({ c: 'No time' });

    writeSkips('p1', '2026-10-31', {});
    expect(localStorage.getItem('ffs_skips_p1_2026-10-31')).toBeNull();

    clearAllSkips();
    expect(readSkips('p2', '2026-10-30')).toEqual({});
  });
});
