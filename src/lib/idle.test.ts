import { beforeEach, describe, expect, it } from 'vitest';
import { IDLE_MS, idleExpired, idleSignOutApplies, writeLastActivity } from './idle';

describe('idleSignOutApplies', () => {
  it('signs out staff but keeps patients signed in, whichever way they signed in', () => {
    expect(idleSignOutApplies({ role: 'doctor' })).toBe(true);
    expect(idleSignOutApplies({ role: 'admin' })).toBe(true);
    expect(idleSignOutApplies({ role: 'patient' })).toBe(false);
  });
});

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
