import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { queryClient } from '../../lib/queryClient';
import { MealHistory } from '../health/MealDay';
import { NutritionPanel } from './NutritionPanel';
import type { MealDay, MealHistoryDay } from '../../types/api';

const today: MealDay = {
  date: '2026-11-22',
  timeZone: 'Asia/Kolkata',
  dietType: 'STANDARD',
  dietLabel: { en: 'Standard diet', hi: null },
  targets: { kcal: 2000, proteinG: 80 },
  totals: { kcal: 600, proteinG: 20, slotsEaten: 1 },
  percent: { kcal: 30, protein: 25 },
  planVersion: 0,
  slots: [
    {
      code: 'BREAKFAST',
      label: { en: 'Breakfast', hi: null },
      window: '08:00-09:00',
      kcal: 600,
      proteinG: 20,
      eaten: true,
      loggedAt: null,
      options: [{ code: 'POHA', label: { en: 'Poha', hi: null }, quantity: '1 bowl', kind: 'OPTION', ticked: true }],
    },
  ],
};

const history: MealHistoryDay[] = [
  { date: '2026-11-22', logged: true, totals: today.totals, targets: today.targets, percent: today.percent },
  { date: '2026-11-21', logged: true, totals: { kcal: 1800, proteinG: 70, slotsEaten: 4 }, targets: { kcal: 2000, proteinG: 80 }, percent: { kcal: 90, protein: 88 } },
  { date: '2026-11-20', logged: false, totals: null, targets: null, percent: null },
];

vi.mock('../../services/apiServices', () => ({
  nutritionService: {
    getPatientPlan: () => Promise.resolve({ version: 0, updatedAt: null }),
    getPatientToday: () => Promise.resolve(today),
    getPatientHistory: () => Promise.resolve(history),
  },
}));

const renderPanel = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NutritionPanel patientId="p1" />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('doctor nutrition: last 7 days', () => {
  it('opens one day at a time, with the meal list only for today', async () => {
    const user = userEvent.setup();
    renderPanel();
    const past = await screen.findByRole('button', { name: /90% calories/ });
    const todayRow = screen.getByRole('button', { name: /30% calories/ });
    expect(past).toHaveAttribute('aria-expanded', 'false');

    await user.click(past);
    expect(past).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(past.getAttribute('aria-controls')!)!;
    expect(within(panel).getByText('1800 of 2000 kcal (90%)')).toBeInTheDocument();
    expect(within(panel).getByText('70 of 80 g (88%)')).toBeInTheDocument();
    expect(within(panel).getByText('4')).toBeInTheDocument();
    expect(within(panel).getByText(/isn’t available yet/)).toBeInTheDocument();

    await user.click(todayRow);
    expect(past).toHaveAttribute('aria-expanded', 'false');
    const todayPanel = document.getElementById(todayRow.getAttribute('aria-controls')!)!;
    expect(within(todayPanel).getByText('Poha')).toBeInTheDocument();
    expect(within(todayPanel).queryByText(/isn’t available yet/)).not.toBeInTheDocument();
  });

  it('says nothing was ticked on a day not logged', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(await screen.findByRole('button', { name: /Nothing ticked/ }));
    expect(screen.getByText('Nothing ticked this day.')).toBeInTheDocument();
  });

  it('links to the printable weekly report in a new tab', async () => {
    renderPanel();
    const link = await screen.findByRole('link', { name: /Weekly calorie report/ });
    expect(link).toHaveAttribute('href', '/doctor/patient/p1/reports/nutrition');
    expect(link).toHaveAttribute('target', '_blank');
  });
});

describe('patient meal history', () => {
  it('stays plain lines without buttons', () => {
    render(<MealHistory days={history} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/90% calories/)).toBeInTheDocument();
  });
});
