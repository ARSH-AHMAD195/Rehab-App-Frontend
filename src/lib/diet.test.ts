import { describe, expect, it } from 'vitest';
import { kcalGap, newCode, sumMeals, toRows, toSlots, type SlotRow } from './diet';
import type { MealSlot } from '../types/api';

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
    rows[0]!.options.push({ code: '', en: 'Dal', hi: '', quantity: '1 katori' });
    expect(toSlots(rows)[0]!.options[2]).toEqual({ code: 'DAL', label: { en: 'Dal', hi: null }, quantity: '1 katori', kind: 'OPTION' });
  });
});

const meal = (kcal: string, protein: string): SlotRow => ({ code: '', en: '', hi: '', from: '', to: '', kcal, protein, options: [] });

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
