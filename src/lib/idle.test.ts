import { beforeEach, describe, expect, it } from 'vitest';
import { IDLE_MS, idleExpired, writeLastActivity } from './idle';

describe('idleExpired', () => {
  beforeEach(() => localStorage.clear());

  it('does not expire a session with no recorded activity', () => {
    expect(idleExpired()).toBe(false);
  });

  it('expires a session left unused past the limit, and not one just inside it', () => {
    const now = 1_000_000_000;
    writeLastActivity(now - IDLE_MS);
    expect(idleExpired(now)).toBe(true);
    writeLastActivity(now - IDLE_MS + 1);
    expect(idleExpired(now)).toBe(false);
  });
});
