import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/toast';
import { ApiError } from '../../services/api';
import { DoctorDietPlanPage } from './DoctorDietPlanPage';
import type { DietPlan } from '../../types/api';

const { updatePlan, getPlan } = vi.hoisted(() => ({ updatePlan: vi.fn(), getPlan: vi.fn() }));

vi.mock('../../services/apiServices', () => ({
  nutritionService: {
    getPatientPlan: (...args: unknown[]) => getPlan(...args),
    updatePatientPlan: (...args: unknown[]) => updatePlan(...args),
  },
  patientService: { get: () => Promise.resolve({ id: 'p1', name: 'Asha Verma' }) },
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

const Where = () => {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
};

const renderPage = async () => {
  const router = createMemoryRouter(
    [
      { path: '/doctor/patient/:id/diet-plan', element: <DoctorDietPlanPage /> },
      { path: '/doctor/patient/:id', element: <Where /> },
    ],
    { initialEntries: ['/doctor/patient/p1/diet-plan'] },
  );
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { name: 'Edit diet plan' });
  await screen.findByRole('button', { name: 'Save diet plan' });
  return router;
};

/** The Edit button and its panel for a meal, found by its English name. */
const mealParts = (name: string) => {
  // "Edit Lunch" while collapsed, "Done with Lunch" while open
  const header = screen.getByRole('button', { name: (n) => n === `Edit ${name}` || n === `Done with ${name}` });
  const panel = document.getElementById(header.getAttribute('aria-controls')!)!;
  return { header, panel };
};

beforeEach(() => {
  updatePlan.mockReset();
  updatePlan.mockResolvedValue({});
  getPlan.mockReset();
  getPlan.mockResolvedValue(plan);
});

describe('diet plan page: meal cards', () => {
  it('starts with every meal collapsed and a summary of the meal totals', async () => {
    await renderPage();
    const breakfast = mealParts('Breakfast');
    const lunch = mealParts('Lunch');
    expect(breakfast.header).toHaveAttribute('aria-expanded', 'false');
    expect(lunch.header).toHaveAttribute('aria-expanded', 'false');
    expect(breakfast.panel).not.toBeVisible();
    expect(lunch.panel).not.toBeVisible();
    const card = breakfast.header.closest('li')!;
    expect(card).toHaveTextContent('08:00–09:00');
    expect(card).toHaveTextContent('600 kcal · 20 g');
    expect(card).toHaveTextContent('Poha, 1 bowl');
    const lunchFoods = within(lunch.header.closest('li')!).getAllByRole('listitem');
    expect(lunchFoods.map((li) => li.textContent)).toEqual(['Roti, 3', 'Curd, 80 g']);
    expect(screen.queryByText(/Roti, 3 · Curd/)).toBeNull();

    const summary = screen.getByText(/Meals add up to/).closest('p')!;
    expect(within(summary).getByText('1400 kcal')).toBeInTheDocument();
    expect(summary).toHaveTextContent('50 g');
    expect(summary).toHaveTextContent('(600 kcal short)');
  });

  it('expands a meal when its header is clicked', async () => {
    const user = userEvent.setup();
    await renderPage();
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
    await renderPage();
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

describe('diet plan page: save payload', () => {
  it('sends every food as a main option with the original dietLabel', async () => {
    const user = userEvent.setup();
    const router = await renderPage();
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
          advice: null,
          options: [{ code: 'POHA', label: { en: 'Poha', hi: null }, quantity: '1 bowl', kind: 'OPTION' }],
        },
        {
          code: 'LUNCH',
          label: { en: 'Lunch', hi: 'दोपहर का खाना' },
          window: '13:00-14:00',
          kcal: 800,
          proteinG: 30,
          advice: null,
          options: [
            { code: 'ROTI', label: { en: 'Roti', hi: 'रोटी' }, quantity: '3', kind: 'OPTION' },
            // Was an add-on before: the add-on type is gone from the form, so it goes out as a main option
            { code: 'CURD', label: { en: 'Curd', hi: null }, quantity: '80 g', kind: 'OPTION' },
          ],
        },
      ],
    });
    for (const slot of body.slots) for (const o of slot.options) expect(o.kind).toBe('OPTION');
    await vi.waitFor(() => expect(router.state.location.pathname + router.state.location.search).toBe('/doctor/patient/p1?tab=nutrition'));
  });
});

describe('diet plan page: edits', () => {
  it('drops the saved Hindi of an item whose English is renamed, keeps the rest', async () => {
    const user = userEvent.setup();
    await renderPage();
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
    await renderPage();
    await user.click(mealParts('Lunch').header);
    await user.click(screen.getByRole('button', { name: 'Remove meal Breakfast' }));
    expect(screen.queryByRole('button', { name: /^Breakfast\b/ })).not.toBeInTheDocument();
    expect(mealParts('Lunch').header).toHaveAttribute('aria-expanded', 'true');
  });

  it("won't remove a meal's last food", async () => {
    await renderPage();
    expect(within(mealParts('Breakfast').panel).getByRole('button', { name: 'Remove Poha', hidden: true })).toBeDisabled();
  });
});

describe('diet plan page: checks before saving (from #8)', () => {
  beforeEach(() => updatePlan.mockReset());

  it('refuses a meal whose end time is before its start, but allows ending at midnight', async () => {
    const user = userEvent.setup();
    await renderPage();
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
    await renderPage();
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

describe('diet plan page: food reference', () => {
  const openLunch = async (user: ReturnType<typeof userEvent.setup>) => {
    await renderPage();
    const { header, panel } = mealParts('Lunch');
    await user.click(header);
    fireEvent.click(within(panel).getByRole('button', { name: 'Add food' }));
    const foods = within(panel).getAllByLabelText('Food');
    const quantities = within(panel).getAllByLabelText('Quantity');
    return { food: foods[2]!, quantity: quantities[2]! as HTMLInputElement };
  };

  it('suggests reference foods and shows the source line once', async () => {
    await renderPage();
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
    expect(screen.getByText('Reference: 180 kcal · 3 g per 1 katori (150 g)')).toBeInTheDocument();
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

describe('diet plan page: layout C', () => {
  it('renders the timeline in plan order with the start times and a back link', async () => {
    await renderPage();
    const items = screen.getAllByRole('listitem').filter((li) => li.parentElement?.tagName === 'OL');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('08:00');
    expect(items[0]).toHaveTextContent('Breakfast');
    expect(items[1]).toHaveTextContent('Lunch');
    expect(await screen.findByRole('link', { name: /Back to Asha Verma · Nutrition/ })).toHaveAttribute('href', '/doctor/patient/p1?tab=nutrition');
  });

  it('saves and returns to the Nutrition tab', async () => {
    const user = userEvent.setup();
    const router = await renderPage();
    await user.click(screen.getByRole('button', { name: 'Save diet plan' }));
    await vi.waitFor(() => expect(router.state.location.pathname + router.state.location.search).toBe('/doctor/patient/p1?tab=nutrition'));
    expect(await screen.findByTestId('where')).toHaveTextContent('/doctor/patient/p1?tab=nutrition');
  });

  it('Cancel links back to the Nutrition tab', async () => {
    await renderPage();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/doctor/patient/p1?tab=nutrition');
  });
});

describe('diet plan page: reference panel', () => {
  it('filters by name and adds the food with its serving to the active meal, without touching meal kcal', async () => {
    const user = userEvent.setup();
    await renderPage();
    expect(screen.getByText('Type to search the AIIMS Bhopal list')).toBeInTheDocument();
    await user.click(mealParts('Lunch').header);
    await user.type(screen.getByLabelText('Search foods'), 'idl');
    expect(screen.queryByText('Upma')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add to Lunch (Idli)' }));
    const { panel } = mealParts('Lunch');
    expect(within(panel).getAllByLabelText('Food')[2]).toHaveValue('Idli');
    expect(within(panel).getAllByLabelText('Quantity')[2]).toHaveValue('2 pieces');
    expect(within(panel).getByLabelText('kcal')).toHaveValue(800);
  });

  it('disables adding until a meal is open', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.type(screen.getByLabelText('Search foods'), 'idli');
    expect(screen.getByRole('button', { name: 'Add (Idli)' })).toBeDisabled();
    expect(screen.getByText('Open a meal to add foods')).toBeInTheDocument();
  });

  it('hides a zero part of a reference hint', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(mealParts('Lunch').header);
    const food = within(mealParts('Lunch').panel).getAllByLabelText('Food')[0]!;
    fireEvent.change(food, { target: { value: 'Green tea' } });
    expect(screen.getByText('Reference: 2 kcal per 1 cup')).toBeInTheDocument();
  });

  it('keeps the active meal when a meal before it is removed', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(mealParts('Lunch').header);
    await user.type(screen.getByLabelText('Search foods'), 'idl');
    await user.click(screen.getByRole('button', { name: 'Remove meal Breakfast' }));
    await user.click(screen.getByRole('button', { name: 'Add to Lunch (Idli)' }));
    const { panel } = mealParts('Lunch');
    expect(within(panel).getAllByLabelText('Food')).toHaveLength(3);
    expect(within(panel).getAllByLabelText('Food')[2]).toHaveValue('Idli');
    expect(within(panel).getByLabelText('kcal')).toHaveValue(800);
  });

  it('disables adding when the active meal is removed, and enables it again once another meal is opened', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(mealParts('Lunch').header);
    await user.type(screen.getByLabelText('Search foods'), 'idli');
    await user.click(screen.getByRole('button', { name: 'Remove meal Lunch' }));
    expect(screen.getByRole('button', { name: 'Add (Idli)' })).toBeDisabled();
    expect(screen.getByText('Open a meal to add foods')).toBeInTheDocument();
    await user.click(mealParts('Breakfast').header);
    expect(screen.getByRole('button', { name: 'Add to Breakfast (Idli)' })).toBeEnabled();
  });

  it('disables adding to a meal that already has 20 foods', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(mealParts('Lunch').header);
    const panel = mealParts('Lunch').panel;
    // Lunch starts with 2 foods: 18 more reach the 20 the API allows
    for (let n = 0; n < 18; n++) fireEvent.click(within(panel).getByRole('button', { name: 'Add food' }));
    expect(within(panel).getAllByLabelText('Food')).toHaveLength(20);
    expect(within(panel).getByRole('button', { name: 'Add food' })).toBeDisabled();
    await user.type(screen.getByLabelText('Search foods'), 'idli');
    expect(screen.getByRole('button', { name: 'Add to Lunch (Idli)' })).toBeDisabled();
    await user.click(mealParts('Breakfast').header);
    expect(screen.getByRole('button', { name: 'Add to Breakfast (Idli)' })).toBeEnabled();
  });
});

describe('diet plan page: save errors', () => {
  it('shows the concurrent-update message and stays on the page', async () => {
    const user = userEvent.setup();
    updatePlan.mockRejectedValue(new ApiError(409, 'conflict', { code: 'CONCURRENT_UPDATE' }));
    const router = await renderPage();
    await user.click(screen.getByRole('button', { name: 'Save diet plan' }));
    expect(await screen.findByText(/Someone else changed this diet plan just now\. Reload this page/)).toBeInTheDocument();
    expect(updatePlan).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe('/doctor/patient/p1/diet-plan');
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save diet plan' })).toBeInTheDocument();
  });

  it('shows the API error message and stays on the page', async () => {
    const user = userEvent.setup();
    updatePlan.mockRejectedValue(new ApiError(500, 'Server is busy, try later', { code: 'SERVER_ERROR' }));
    const router = await renderPage();
    await user.click(screen.getByRole('button', { name: 'Save diet plan' }));
    expect(await screen.findByText('Server is busy, try later')).toBeInTheDocument();
    expect(updatePlan).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe('/doctor/patient/p1/diet-plan');
  });

  it('falls back to a generic message when the failure is not an API error', async () => {
    const user = userEvent.setup();
    updatePlan.mockRejectedValue(new Error('socket hang up'));
    const router = await renderPage();
    await user.click(screen.getByRole('button', { name: 'Save diet plan' }));
    expect(await screen.findByText('Could not save the diet plan.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/doctor/patient/p1/diet-plan');
  });
});

describe('diet plan page: submit with an empty meal name', () => {
  it('opens the collapsed meal with the empty name, focuses it, and does not save', async () => {
    const user = userEvent.setup();
    await renderPage();
    const { header, panel } = mealParts('Lunch');
    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: '' } });
    expect(header).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('button', { name: 'Save diet plan' }));

    expect(updatePlan).not.toHaveBeenCalled();
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(within(panel).getByLabelText('Name')).toHaveFocus();
    expect(mealParts('Breakfast').header).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('diet plan page: meal advice', () => {
  const adviceBox = (name: string) => within(mealParts(name).panel).queryByRole('textbox', { name: /Advice for this meal/ });

  it('shows the box above the foods and saves the typed advice', async () => {
    getPlan.mockResolvedValue({ ...plan, slots: [{ ...plan.slots[0]!, advice: 'Eat slowly' }, plan.slots[1]!] });
    const user = userEvent.setup();
    await renderPage();
    // The collapsed card shows the saved advice
    expect(mealParts('Breakfast').header.closest('li')).toHaveTextContent('Eat slowly');
    await user.click(mealParts('Lunch').header);
    const box = adviceBox('Lunch')!;
    expect(box).toHaveAttribute('maxlength', '500');
    expect(within(mealParts('Lunch').panel).getByText("The patient sees this above the meal's foods.")).toBeInTheDocument();
    expect(box.compareDocumentPosition(within(mealParts('Lunch').panel).getAllByLabelText('Food')[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.type(box, ' Warm water ');
    await user.click(screen.getByRole('button', { name: 'Save diet plan' }));
    const slots = updatePlan.mock.calls[0]![1].slots;
    expect(slots[0].advice).toBe('Eat slowly');
    expect(slots[1].advice).toBe('Warm water');
  });

  it('stops typing at 500 characters and saves a full 500 unchanged', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(mealParts('Lunch').header);
    const box = adviceBox('Lunch')!;
    await user.type(box, 'y'.repeat(501));
    expect(box).toHaveValue('y'.repeat(500));
    await user.click(screen.getByRole('button', { name: 'Save diet plan' }));
    expect(updatePlan).toHaveBeenCalledTimes(1);
    expect(updatePlan.mock.calls[0]![1].slots[1].advice).toBe('y'.repeat(500));
  });

  it('sends advice as null on a meal with none', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('button', { name: 'Save diet plan' }));
    expect(updatePlan.mock.calls[0]![1].slots.map((s: { advice: unknown }) => s.advice)).toEqual([null, null]);
  });
});

describe('diet plan page: reference servings', () => {
  const openLunchRoti = async (user: ReturnType<typeof userEvent.setup>) => {
    await renderPage();
    await user.click(mealParts('Lunch').header);
    const panel = mealParts('Lunch').panel;
    fireEvent.change(within(panel).getAllByLabelText('Food')[0]!, { target: { value: 'Roti / Chapati' } });
    fireEvent.change(within(panel).getAllByLabelText('Quantity')[0]!, { target: { value: '1 medium (30 g)' } });
    return within(panel);
  };

  it('sets the quantity to the servings count and shows the servings nutrients, leaving the meal kcal alone', async () => {
    const user = userEvent.setup();
    const panel = await openLunchRoti(user);
    fireEvent.change(panel.getAllByLabelText('Servings')[0]!, { target: { value: '2' } });
    expect(panel.getAllByLabelText('Quantity')[0]).toHaveValue('2 × 1 medium (30 g)');
    expect(screen.getByText(/2 servings: 160 kcal · 6 g/)).toBeInTheDocument();
    expect(panel.getByLabelText('kcal')).toHaveValue(800);
    await user.click(screen.getByRole('button', { name: 'Save diet plan' }));
    const [, body] = updatePlan.mock.calls[0] as [string, { slots: { kcal: number; options: object[] }[] }];
    expect(body.slots[1]!.kcal).toBe(800);
    expect(body.slots[1]!.options[0]).toEqual({ code: 'ROTI', label: { en: 'Roti / Chapati', hi: null }, quantity: '2 × 1 medium (30 g)', kind: 'OPTION' });
  });

  it('accepts a half serving typed in pieces', async () => {
    const user = userEvent.setup();
    const panel = await openLunchRoti(user);
    const servings = panel.getAllByLabelText('Servings')[0]!;
    await user.clear(servings);
    await user.type(servings, '0.5');
    expect(panel.getAllByLabelText('Quantity')[0]).toHaveValue('0.5 × 1 medium (30 g)');
    expect(servings).toHaveValue(0.5);
  });

  it('shows no servings box for a hand-typed quantity', async () => {
    const panel = await openLunchRoti(userEvent.setup());
    fireEvent.change(panel.getAllByLabelText('Quantity')[0]!, { target: { value: '3' } });
    expect(panel.queryByLabelText('Servings')).toBeNull();
  });
});
