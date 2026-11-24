import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../../lib/queryClient';
import { ToastProvider } from '../ui/toast';
import { DietPlanModal } from './DietPlanModal';
import type { DietPlan } from '../../types/api';

const { updatePlan } = vi.hoisted(() => ({ updatePlan: vi.fn() }));

vi.mock('../../services/apiServices', () => ({
  nutritionService: {
    updatePatientPlan: (...args: unknown[]) => updatePlan(...args),
  },
}));

// Two meals: Breakfast 600 kcal + Lunch 800 kcal = 1400 kcal, 20 + 30 = 50 g protein. Target 2000 kcal → 600 short.
const plan: DietPlan = {
  patientId: 'p1',
  dietType: 'STANDARD',
  dietLabel: { en: 'Standard diet', hi: 'मानक आहार' },
  targets: { kcal: 2000, proteinG: 80 },
  version: 3,
  updatedAt: null,
  updatedBy: null,
  slots: [
    {
      code: 'BREAKFAST',
      label: { en: 'Breakfast', hi: null },
      window: '08:00-09:00',
      kcal: 600,
      proteinG: 20,
      options: [{ code: 'POHA', label: { en: 'Poha', hi: null }, quantity: '1 bowl', kind: 'OPTION' }],
    },
    {
      code: 'LUNCH',
      label: { en: 'Lunch', hi: 'दोपहर का खाना' },
      window: '13:00-14:00',
      kcal: 800,
      proteinG: 30,
      options: [
        { code: 'ROTI', label: { en: 'Roti', hi: 'रोटी' }, quantity: '3', kind: 'OPTION' },
        { code: 'CURD', label: { en: 'Curd', hi: null }, quantity: '80 g', kind: 'ADDON' },
      ],
    },
  ],
} as unknown as DietPlan;

const renderModal = (onClose = vi.fn()) =>
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <DietPlanModal patientId="p1" plan={plan} onClose={onClose} />
      </ToastProvider>
    </QueryClientProvider>
  );

/** The collapsible header button and its panel for a meal, found by its English name. */
const mealParts = (name: string) => {
  const header = screen.getByRole('button', { name: new RegExp(`^${name}\\b`) });
  const panel = document.getElementById(header.getAttribute('aria-controls')!)!;
  return { header, panel };
};

beforeEach(() => {
  updatePlan.mockReset();
  updatePlan.mockResolvedValue({});
});

describe('diet plan modal: meal cards', () => {
  it('starts with every meal collapsed and a summary of the meal totals', () => {
    renderModal();
    const breakfast = mealParts('Breakfast');
    const lunch = mealParts('Lunch');
    expect(breakfast.header).toHaveAttribute('aria-expanded', 'false');
    expect(lunch.header).toHaveAttribute('aria-expanded', 'false');
    expect(breakfast.panel).not.toBeVisible();
    expect(lunch.panel).not.toBeVisible();
    expect(breakfast.header).toHaveTextContent('08:00–09:00');
    expect(breakfast.header).toHaveTextContent('600 kcal · 20 g');
    expect(breakfast.header).toHaveTextContent('1 food');
    expect(lunch.header).toHaveTextContent('2 foods');

    const summary = screen.getByText(/Meals add up to/).closest('p')!;
    expect(within(summary).getByText('1400 kcal')).toBeInTheDocument();
    expect(summary).toHaveTextContent('50 g');
    expect(summary).toHaveTextContent('(600 kcal short)');
  });

  it('expands a meal when its header is clicked', async () => {
    const user = userEvent.setup();
    renderModal();
    const { header, panel } = mealParts('Lunch');
    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    expect(within(panel).getByDisplayValue('Lunch')).toBeInTheDocument();
    // Other meals stay collapsed
    expect(mealParts('Breakfast').header).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens only the collapsed meal with an empty required field and focuses that field', async () => {
    const user = userEvent.setup();
    renderModal();
    const { header, panel } = mealParts('Breakfast');
    fireEvent.change(within(panel).getByLabelText('kcal'), { target: { value: '' } });
    expect(header).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('button', { name: 'Save diet plan' }));

    expect(updatePlan).not.toHaveBeenCalled();
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    expect(within(panel).getByLabelText('kcal')).toHaveFocus();
    expect(mealParts('Lunch').header).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('diet plan modal: save payload', () => {
  it('sends every food as a main option with the original dietLabel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(onClose);
    await user.click(screen.getByRole('button', { name: 'Save diet plan' }));

    expect(updatePlan).toHaveBeenCalledTimes(1);
    const [patientId, body] = updatePlan.mock.calls[0] as [string, { slots: { options: { kind: string }[] }[] }];
    expect(patientId).toBe('p1');
    expect(body).toEqual({
      version: 3,
      dietLabel: { en: 'Standard diet', hi: 'मानक आहार' },
      targets: { kcal: 2000, proteinG: 80 },
      slots: [
        {
          code: 'BREAKFAST',
          label: { en: 'Breakfast', hi: null },
          window: '08:00-09:00',
          kcal: 600,
          proteinG: 20,
          options: [{ code: 'POHA', label: { en: 'Poha', hi: null }, quantity: '1 bowl', kind: 'OPTION' }],
        },
        {
          code: 'LUNCH',
          label: { en: 'Lunch', hi: 'दोपहर का खाना' },
          window: '13:00-14:00',
          kcal: 800,
          proteinG: 30,
          options: [
            { code: 'ROTI', label: { en: 'Roti', hi: 'रोटी' }, quantity: '3', kind: 'OPTION' },
            // Was an add-on before: the add-on type is gone from the form, so it goes out as a main option
            { code: 'CURD', label: { en: 'Curd', hi: null }, quantity: '80 g', kind: 'OPTION' },
          ],
        },
      ],
    });
    for (const slot of body.slots) for (const o of slot.options) expect(o.kind).toBe('OPTION');
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('diet plan modal: edits', () => {
  it('drops the saved Hindi of an item whose English is renamed, keeps the rest', async () => {
    const user = userEvent.setup();
    renderModal();
    const { header, panel } = mealParts('Lunch');
    await user.click(header);
    const roti = within(panel).getByDisplayValue('Roti');
    await user.clear(roti);
    await user.type(roti, 'Rice');
    await user.click(screen.getByRole('button', { name: 'Save diet plan' }));

    const [, body] = updatePlan.mock.calls[0] as [string, { slots: { label: object; options: { label: object }[] }[] }];
    expect(body.slots[1]!.label).toEqual({ en: 'Lunch', hi: 'दोपहर का खाना' });
    expect(body.slots[1]!.options[0]!.label).toEqual({ en: 'Rice', hi: null });
  });

  it('keeps the other meals open or closed when a meal is removed', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(mealParts('Lunch').header);
    await user.click(screen.getByRole('button', { name: 'Remove meal Breakfast' }));
    expect(screen.queryByRole('button', { name: /^Breakfast\b/ })).not.toBeInTheDocument();
    expect(mealParts('Lunch').header).toHaveAttribute('aria-expanded', 'true');
  });

  it("won't remove a meal's last food", () => {
    renderModal();
    expect(within(mealParts('Breakfast').panel).getByRole('button', { name: 'Remove Poha', hidden: true })).toBeDisabled();
  });
});

describe('diet plan modal: checks before saving (from #8)', () => {
  beforeEach(() => updatePlan.mockReset());

  it('refuses a meal whose end time is before its start, but allows ending at midnight', async () => {
    const user = userEvent.setup();
    renderModal();
    const to = screen.getAllByLabelText('To')[0]!;
    fireEvent.change(to, { target: { value: '07:00' } });
    await user.click(screen.getByRole('button', { name: 'Save diet plan' }));
    expect(await screen.findByText('Must be later than the start time.')).toBeInTheDocument();
    expect(updatePlan).not.toHaveBeenCalled();

    updatePlan.mockResolvedValue({});
    fireEvent.change(to, { target: { value: '00:00' } });
    await user.click(screen.getByRole('button', { name: 'Save diet plan' }));
    expect(updatePlan).toHaveBeenCalledOnce();
  });

  it('stops a plan too big for the API with a clear message', async () => {
    const user = userEvent.setup();
    renderModal();
    const { header, panel } = mealParts('Lunch');
    await user.click(header);
    for (let n = 0; n < 18; n++) fireEvent.click(within(panel).getByRole('button', { name: 'Add food' }));
    // Hindi takes 3 bytes a letter: 20 foods of 300 letters is well over 16 KB
    screen.getAllByLabelText('Food').forEach((el) => fireEvent.change(el, { target: { value: 'ऽ'.repeat(300) } }));
    screen.getAllByLabelText('Quantity').forEach((el) => fireEvent.change(el, { target: { value: '1' } }));
    await user.click(screen.getByRole('button', { name: 'Save diet plan' }));
    expect(await screen.findByText(/too long to save/)).toBeInTheDocument();
    expect(updatePlan).not.toHaveBeenCalled();
  });
});

describe('diet plan modal: food reference', () => {
  const openLunch = async (user: ReturnType<typeof userEvent.setup>) => {
    renderModal();
    const { header, panel } = mealParts('Lunch');
    await user.click(header);
    fireEvent.click(within(panel).getByRole('button', { name: 'Add food' }));
    const foods = within(panel).getAllByLabelText('Food');
    const quantities = within(panel).getAllByLabelText('Quantity');
    return { food: foods[2]!, quantity: quantities[2]! as HTMLInputElement };
  };

  it('suggests reference foods and shows the source line once', () => {
    renderModal();
    expect(screen.getAllByText(/AIIMS Bhopal diet reference/)).toHaveLength(1);
    const food = screen.getAllByLabelText('Food')[0]!;
    const list = document.getElementById(food.getAttribute('list')!)!;
    expect(list.querySelector('option[value="Idli"]')).not.toBeNull();
  });

  it('fills an empty quantity and shows the hint for a reference food', async () => {
    const user = userEvent.setup();
    const { food, quantity } = await openLunch(user);
    fireEvent.change(food, { target: { value: 'poha (plain, cooked)' } });
    expect(quantity).toHaveValue('1 katori (150 g)');
    expect(screen.getByText('Reference: 180 kcal, 3 g protein per 1 katori (150 g)')).toBeInTheDocument();
  });

  it('never overwrites a typed quantity', async () => {
    const user = userEvent.setup();
    const { food, quantity } = await openLunch(user);
    fireEvent.change(quantity, { target: { value: '2 bowls' } });
    fireEvent.change(food, { target: { value: 'Poha (plain, cooked)' } });
    expect(quantity).toHaveValue('2 bowls');
  });

  it('replaces the serving it filled when the food changes, but keeps one the doctor edited', async () => {
    const user = userEvent.setup();
    const { food, quantity } = await openLunch(user);
    fireEvent.change(food, { target: { value: 'Idli' } });
    expect(quantity).toHaveValue('2 pieces');
    fireEvent.change(food, { target: { value: 'Upma' } });
    expect(quantity).toHaveValue('1 katori (150 g)');
    fireEvent.change(food, { target: { value: 'Upma with veg' } });
    expect(quantity).toHaveValue('');
    fireEvent.change(food, { target: { value: 'Idli' } });
    fireEvent.change(quantity, { target: { value: '3 pieces' } });
    fireEvent.change(food, { target: { value: 'Upma' } });
    expect(quantity).toHaveValue('3 pieces');
  });

  it('saves only what the doctor entered', async () => {
    const user = userEvent.setup();
    const { food } = await openLunch(user);
    fireEvent.change(food, { target: { value: 'Idli' } });
    await user.click(screen.getByRole('button', { name: 'Save diet plan' }));
    const [, body] = updatePlan.mock.calls[0] as [string, { slots: { kcal: number; options: object[] }[] }];
    expect(body.slots[1]!.kcal).toBe(800);
    expect(body.slots[1]!.options[2]).toEqual({ code: 'IDLI', label: { en: 'Idli', hi: null }, quantity: '2 pieces', kind: 'OPTION' });
  });
});
