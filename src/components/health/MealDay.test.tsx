import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { setLang } from '../../lib/i18n';
import { MealSlots } from './MealDay';
import type { MealDay } from '../../types/api';

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
  setLang('en');
});

describe('meal advice display', () => {
  it('shows the advice to the patient', () => {
    render(<MealSlots day={day} onToggle={() => {}} />);
    expect(screen.getByText('Your doctor’s advice:')).toBeInTheDocument();
    expect(screen.getByText(/Eat slowly/)).toBeInTheDocument();
  });

  it('shows it to the doctor as "Advice:"', () => {
    render(<MealSlots day={day} />);
    expect(screen.getByText('Advice:')).toBeInTheDocument();
  });

  it('labels the advice in Hindi for the patient when Hindi is chosen', () => {
    setLang('hi');
    render(<MealSlots day={day} onToggle={() => {}} />);
    expect(screen.getByText('आपके डॉक्टर की सलाह:')).toBeInTheDocument();
    expect(screen.getByText(/Eat slowly/)).toBeInTheDocument();
  });

  it('shows the advice above the foods, before the first checkbox', () => {
    render(<MealSlots day={day} onToggle={() => {}} />);
    const advice = screen.getByText(/Eat slowly/);
    const firstCheckbox = screen.getByRole('checkbox');
    expect(advice.compareDocumentPosition(firstCheckbox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hides it when the slot has none', () => {
    render(<MealSlots day={{ slots: [{ ...day.slots[0]!, advice: null }] } as unknown as MealDay} onToggle={() => {}} />);
    expect(screen.queryByText(/advice/i)).not.toBeInTheDocument();
  });
});
