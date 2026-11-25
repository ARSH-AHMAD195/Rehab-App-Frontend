import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { setLang } from '../../lib/i18n';
import { MealSlots } from './MealDay';
import type { MealDay } from '../../types/api';

const flags = vi.hoisted(() => ({ meal: false }));
vi.mock('../../lib/features', () => ({
  get MEAL_ADVICE() {
    return flags.meal;
  },
}));

const day = {
  slots: [
    {
      code: 'LUNCH',
      label: { en: 'Lunch', hi: null },
      window: '13:00-14:00',
      kcal: 500,
      proteinG: 20,
      advice: 'Eat slowly',
      eaten: false,
      loggedAt: null,
      options: [{ code: 'ROTI', label: { en: 'Roti', hi: null }, quantity: '2', kind: 'OPTION', ticked: false }],
    },
  ],
} as unknown as MealDay;

beforeEach(() => {
  flags.meal = false;
  setLang('en');
});

describe('meal advice display', () => {
  it('shows the advice to the patient when the flag is on', () => {
    flags.meal = true;
    render(<MealSlots day={day} onToggle={() => {}} />);
    expect(screen.getByText('Your doctor’s advice:')).toBeInTheDocument();
    expect(screen.getByText(/Eat slowly/)).toBeInTheDocument();
  });

  it('shows it to the doctor as "Advice:"', () => {
    flags.meal = true;
    render(<MealSlots day={day} />);
    expect(screen.getByText('Advice:')).toBeInTheDocument();
  });

  it('labels the advice in Hindi for the patient when Hindi is chosen', () => {
    flags.meal = true;
    setLang('hi');
    render(<MealSlots day={day} onToggle={() => {}} />);
    expect(screen.getByText('आपके डॉक्टर की सलाह:')).toBeInTheDocument();
    expect(screen.getByText(/Eat slowly/)).toBeInTheDocument();
  });

  it('hides it when the flag is off or the slot has none', () => {
    const { rerender } = render(<MealSlots day={day} onToggle={() => {}} />);
    expect(screen.queryByText(/Eat slowly/)).not.toBeInTheDocument();
    flags.meal = true;
    rerender(<MealSlots day={{ slots: [{ ...day.slots[0]!, advice: null }] } as unknown as MealDay} onToggle={() => {}} />);
    expect(screen.queryByText(/advice/i)).not.toBeInTheDocument();
  });
});
