import { beforeEach, describe, expect, it, vi } from 'vitest';
import { autoNutrients, autoNutrientsFor, emptyOption, foodsComplete, kcalGap, mealValues, newCode, nutrientText, servingsOf, sumMeals, toRows, toSlots, withServings, type SlotRow } from './diet';
import type { MealSlot } from '../types/api';

const flags = vi.hoisted(() => ({ food: false }));
vi.mock('./features', () => ({
  get FOOD_NUTRIENTS() {
    return flags.food;
  },
}));

describe('newCode', () => {
  it('makes an API code from a name', () => {
    expect(newCode('Evening snack', [])).toBe('EVENING_SNACK');
    expect(newCode('  Dal / sabzi (1 katori) ', [])).toBe('DAL_SABZI_1_KATORI');
    expect(newCode('दाल', [])).toBe('ITEM');
    expect(newCode('x'.repeat(60), [])).toHaveLength(36);
  });

  it('never repeats a code in the list', () => {
    expect(newCode('Milk', ['MILK'])).toBe('MILK_2');
    expect(newCode('Milk', ['MILK', 'MILK_2'])).toBe('MILK_3');
  });
});


const saved: MealSlot[] = [
  {
    code: 'LUNCH',
    label: { en: 'Lunch', hi: 'दोपहर का खाना' },
    window: '12:30-13:30',
    kcal: 711,
    proteinG: 24.7,
    options: [
      { code: 'ROTI', label: { en: 'Roti', hi: 'रोटी' }, quantity: '3', kind: 'OPTION' },
      { code: 'CURD', label: { en: 'Curd', hi: null }, quantity: '80 g', kind: 'ADDON' },
    ],
  },
];

describe('diet plan form', () => {
  it('sends saved Hindi back unchanged and saves every food as a main option', () => {
    const slots = toSlots(toRows(saved));
    expect(slots[0]!.label).toEqual({ en: 'Lunch', hi: 'दोपहर का खाना' });
    expect(slots[0]!.options.map((o) => [o.label.hi, o.kind])).toEqual([
      ['रोटी', 'OPTION'],
      [null, 'OPTION'],
    ]);
    expect(slots[0]).toMatchObject({ window: '12:30-13:30', kcal: 711, proteinG: 24.7 });
  });

  it('gives a new food no Hindi and a main-option kind', () => {
    const rows = toRows(saved);
    rows[0]!.options.push({ code: '', en: 'Dal', hi: '', quantity: '1 katori', kcal: '', protein: '' });
    expect(toSlots(rows)[0]!.options[2]).toEqual({ code: 'DAL', label: { en: 'Dal', hi: null }, quantity: '1 katori', kind: 'OPTION' });
  });
});

const meal = (kcal: string, protein: string): SlotRow => ({ code: '', en: '', hi: '', from: '', to: '', kcal, protein, advice: '', options: [] });

describe('meal totals', () => {
  it('adds kcal to a whole number and protein to 1 dp', () => {
    expect(sumMeals([meal('480', '22'), meal('711', '24.7')])).toEqual({ kcal: 1191, protein: 46.7 });
    expect(sumMeals([meal('100.6', '10.26'), meal('0', '0')])).toEqual({ kcal: 101, protein: 10.3 });
  });

  it('counts blank or invalid numbers as 0', () => {
    expect(sumMeals([meal('', ''), meal('abc', '5'), meal('200', '')])).toEqual({ kcal: 200, protein: 5 });
    expect(sumMeals([])).toEqual({ kcal: 0, protein: 0 });
  });

  it('gives the gap from the daily kcal target: negative is short, positive is over', () => {
    const rows = [meal('1000', '0'), meal('1150', '0')];
    expect(kcalGap(rows, '2206')).toBe(-56);
    expect(kcalGap(rows, '2100')).toBe(50);
    expect(kcalGap(rows, '2150')).toBe(0);
    expect(kcalGap(rows, '')).toBe(2150);
  });
});

describe('nutrientText', () => {
  it('shows kcal and protein, leaving out a part that is 0', () => {
    expect(nutrientText(180, 3)).toBe('180 kcal · 3 g');
    expect(nutrientText(30, 0)).toBe('30 kcal');
    expect(nutrientText(0, 3)).toBe('3 g');
    expect(nutrientText(0, 0)).toBe('');
  });

  it('shows decimals as given, without rounding', () => {
    expect(nutrientText(180.5, 3.25)).toBe('180.5 kcal · 3.25 g');
  });
});

describe('meal advice', () => {
  it('reads advice into the row, blank when missing or null', () => {
    expect(toRows([{ ...saved[0]!, advice: 'Eat slowly' }])[0]!.advice).toBe('Eat slowly');
    expect(toRows([{ ...saved[0]!, advice: null }])[0]!.advice).toBe('');
    expect(toRows(saved)[0]!.advice).toBe('');
  });

  it('sends trimmed advice, or null when blank', () => {
    const rows = toRows(saved);
    rows[0]!.advice = '  Eat slowly  ';
    expect(toSlots(rows)[0]!.advice).toBe('Eat slowly');
    rows[0]!.advice = '   ';
    expect(toSlots(rows)[0]).toHaveProperty('advice', null);
  });

  it('keeps a 500-character advice unchanged through toRows then toSlots, and again on the next load', () => {
    const advice = 'Eat slowly.\n' + 'x'.repeat(488);
    expect(advice).toHaveLength(500);
    const once = toSlots(toRows([{ ...saved[0]!, advice }]));
    expect(once[0]!.advice).toBe(advice);
    expect(toSlots(toRows(once))).toEqual(once);
  });

  it('trims advice on the way out, and a reload changes nothing more', () => {
    const rows = toRows(saved);
    rows[0]!.advice = '  Take with water \n';
    const first = toSlots(rows);
    expect(first[0]!.advice).toBe('Take with water');
    expect(toSlots(toRows(first))).toEqual(first);
  });

});

describe('reference servings', () => {
  it('reads a whole or half serving count from the quantity', () => {
    expect(servingsOf('1 medium (30 g)', '1 medium (30 g)')).toBe(1);
    expect(servingsOf('2 × 1 medium (30 g)', '1 medium (30 g)')).toBe(2);
    expect(servingsOf('1.5 × 1 medium (30 g)', '1 medium (30 g)')).toBe(1.5);
  });

  it('gives null for a hand-typed quantity, another serving, or a count out of range', () => {
    expect(servingsOf('2 rotis', '1 medium (30 g)')).toBeNull();
    expect(servingsOf('2 × 1 katori', '1 medium (30 g)')).toBeNull();
    expect(servingsOf('0 × 1 medium (30 g)', '1 medium (30 g)')).toBeNull();
    expect(servingsOf('21 × 1 medium (30 g)', '1 medium (30 g)')).toBeNull();
  });

  it('writes the count into the quantity, leaving one serving as it is', () => {
    expect(withServings(1, '1 medium (30 g)')).toBe('1 medium (30 g)');
    expect(withServings(2, '1 medium (30 g)')).toBe('2 × 1 medium (30 g)');
  });
});

describe('per-food kcal and protein', () => {
  beforeEach(() => {
    flags.food = false;
  });

  // Roti 2 × 160 kcal / 6 g and dal 150 kcal / 9 g: the meal is 310 kcal and 15 g. The typed 900 kcal / 99 g is replaced when on.
  const withFoods = (): MealSlot[] => [
    {
      ...saved[0]!,
      kcal: 900,
      proteinG: 99,
      options: [
        { code: 'ROTI', label: { en: 'Roti', hi: null }, quantity: '2 × 1 medium (30 g)', kind: 'OPTION', kcal: 160, proteinG: 6 },
        { code: 'DAL', label: { en: 'Dal', hi: null }, quantity: '1 katori', kind: 'OPTION', kcal: 150, proteinG: 9 },
      ],
    },
  ];

  it('round-trips each food value through the form', () => {
    flags.food = true;
    expect(toRows(withFoods())[0]!.options.map((o) => [o.kcal, o.protein])).toEqual([
      ['160', '6'],
      ['150', '9'],
    ]);
    expect(toSlots(toRows(withFoods()))).toEqual(withFoods().map((s) => ({ ...s, kcal: 310, proteinG: 15, advice: null })));
  });

  it('makes the meal kcal and protein the sum of its foods when every food has values', () => {
    flags.food = true;
    const rows = toRows(withFoods());
    expect(foodsComplete(rows[0]!)).toBe(true);
    expect(toSlots(rows)[0]).toMatchObject({ kcal: 310, proteinG: 15 });
    expect(sumMeals(rows)).toEqual({ kcal: 310, protein: 15 });
  });

  it('keeps the typed meal values when a food is missing its kcal, and sends that food as null', () => {
    flags.food = true;
    const rows = toRows(withFoods());
    rows[0]!.options[1]!.kcal = '';
    expect(foodsComplete(rows[0]!)).toBe(false);
    const [slot] = toSlots(rows);
    expect(slot).toMatchObject({ kcal: 900, proteinG: 99 });
    expect(slot!.options[1]).toMatchObject({ kcal: null, proteinG: 9 });
    expect(sumMeals(rows)).toEqual({ kcal: 900, protein: 99 });
  });

  it('is not complete without a named food', () => {
    flags.food = true;
    expect(foodsComplete({ ...toRows(withFoods())[0]!, options: [] })).toBe(false);
    expect(foodsComplete({ ...toRows(withFoods())[0]!, options: [emptyOption()] })).toBe(false);
  });

  it('with the flag off sends no food nutrient keys and keeps the typed meal values', () => {
    const rows = toRows(withFoods());
    const [slot] = toSlots(rows);
    for (const o of slot!.options) {
      expect(o).not.toHaveProperty('kcal');
      expect(o).not.toHaveProperty('proteinG');
    }
    expect(slot).toMatchObject({ kcal: 900, proteinG: 99 });
    expect(mealValues(rows[0]!)).toEqual({ kcal: 900, protein: 99 });
  });

  it('gives the auto values of a reference food for its servings', () => {
    expect(autoNutrientsFor({ kcal: 80, proteinG: 3 }, 2)).toEqual({ kcal: '160', protein: '6' });
    expect(autoNutrientsFor({ kcal: 80, proteinG: 3 }, null)).toBeNull();
    expect(autoNutrientsFor(undefined, 1)).toBeNull();
  });

  it('replaces only the blank or still-auto values, never a typed one', () => {
    const was = { kcal: '80', protein: '3' };
    const next = { kcal: '160', protein: '6' };
    expect(autoNutrients({ kcal: '', protein: '' }, null, next)).toEqual(next);
    expect(autoNutrients({ kcal: '80', protein: '3' }, was, next)).toEqual(next);
    expect(autoNutrients({ kcal: '90', protein: '3' }, was, next)).toEqual({ kcal: '90', protein: '6' });
    expect(autoNutrients({ kcal: '90', protein: '3' }, null, next)).toEqual({ kcal: '90', protein: '3' });
  });
});

