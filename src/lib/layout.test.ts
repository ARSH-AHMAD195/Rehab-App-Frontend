import { describe, expect, it } from 'vitest';
import { showsSideMenu } from './layout';

describe('side menu', () => {
  it('is hidden on the diet plan editor', () => {
    expect(showsSideMenu('/doctor/patient/p1/diet-plan')).toBe(false);
  });

  it('shows everywhere else', () => {
    expect(showsSideMenu('/doctor/patient/p1')).toBe(true);
    expect(showsSideMenu('/doctor/patients')).toBe(true);
    expect(showsSideMenu('/doctor/patient/p1/diet-plan/extra')).toBe(true);
  });
});
