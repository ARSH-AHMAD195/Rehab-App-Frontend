import { FOOD_NUTRIENTS } from './features';
import type { FoodRef } from './foodReference';
import type { MealSlot } from '../types/api';

export const MAX_SERVINGS = 20;
/** How many reference servings a quantity is: "1 medium (30 g)" → 1, "2 × 1 medium (30 g)" → 2. null for a hand-typed quantity. */
export const servingsOf = (quantity: string, serving: string): number | null => {
  const q = quantity.trim();
  if (q === serving) return 1;
  const m = /^(\d+(?:\.\d+)?) × (.+)$/.exec(q);
  const n = m && m[2] === serving ? Number(m[1]) : NaN;
  return n > 0 && n <= MAX_SERVINGS ? n : null;
};
/** Quantity text for n servings; the count lives in the quantity so it is saved and the patient sees it. */
export const withServings = (n: number, serving: string) => (n === 1 ? serving : `${n} × ${serving}`);

/**
 * A code for a new meal slot or food option, from its English name: "Evening snack" → "EVENING_SNACK".
 * The API wants 1-40 of A-Z, 0-9 and _, unique within the list, so a clash gets _2, _3…
 * Existing items keep their codes: the patient's ticks point at them.
 */
export const newCode = (label: string, taken: Iterable<string>) => {
  const used = new Set(taken);
  const base = label.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36) || 'ITEM';
  let code = base;
  for (let n = 2; used.has(code); n++) code = `${base}_${n}`;
  return code;
};

/** Form rows: numbers as typed, and an empty code for anything added here (made on save).
 * Hindi isn't edited here: saved Hindi goes back unchanged, and the form clears it when the English is renamed.

* `key` is for React only, so a removed row doesn't hand its inputs to the next one. */
export type OptionRow = { key?: number; code: string; en: string; hi: string; quantity: string; kcal: string; protein: string };
export type SlotRow = { key?: number; code: string; en: string; hi: string; from: string; to: string; kcal: string; protein: string; advice: string; options: OptionRow[] };

let lastKey = 0;
export const nextKey = () => ++lastKey;
export const emptyOption = (): OptionRow => ({ key: nextKey(), code: '', en: '', hi: '', quantity: '', kcal: '', protein: '' });

export const toRows = (slots: MealSlot[]): SlotRow[] =>
  slots.map((s) => {
    const [from = '', to = ''] = s.window.split('-');
    return {
      key: nextKey(),
      code: s.code,
      en: s.label.en,
      hi: s.label.hi ?? '',
      from,
      to,
      kcal: String(s.kcal),
      protein: String(s.proteinG),
      advice: s.advice ?? '',
      options: s.options.map((o) => ({
        key: nextKey(),
        code: o.code,
        en: o.label.en,
        hi: o.label.hi ?? '',
        quantity: o.quantity,
        kcal: o.kcal == null ? '' : String(o.kcal),
        protein: o.proteinG == null ? '' : String(o.proteinG),
      })),
    };
  });

/** A typed number; blank or invalid counts as 0. */
const num = (v: string) => {
  const n = Number(v);
  return v.trim() !== '' && Number.isFinite(n) ? n : 0;
};

/** The named foods of a meal. A food with no name isn't sent, so it doesn't count. */
const namedFoods = (row: SlotRow) => row.options.filter((o) => o.en.trim());

/** True when the meal has at least one named food and every one of them has kcal and protein. */
export const foodsComplete = (row: SlotRow) => {
  const foods = namedFoods(row);
  return foods.length > 0 && foods.every((o) => o.kcal.trim() !== '' && o.protein.trim() !== '');
};

/** The named foods of a meal added up: kcal to a whole number, protein to 1 dp. */
export const foodSums = (row: SlotRow) => {
  const foods = namedFoods(row);
  return {
    kcal: Math.round(foods.reduce((sum, o) => sum + num(o.kcal), 0)),
    protein: Math.round(foods.reduce((sum, o) => sum + num(o.protein), 0) * 10) / 10,
  };
};

/** A meal's kcal and protein as saved: the sum of its foods once every food has values (flag on), else the typed numbers. */
export const mealValues = (row: SlotRow) => (FOOD_NUTRIENTS && foodsComplete(row) ? foodSums(row) : { kcal: num(row.kcal), protein: num(row.protein) });

/** Sum of all meals as shown in the summary: kcal to a whole number, protein to 1 dp. */
export const sumMeals = (rows: SlotRow[]) => {
  const values = rows.map(mealValues);
  return {
    kcal: Math.round(values.reduce((sum, v) => sum + v.kcal, 0)),
    protein: Math.round(values.reduce((sum, v) => sum + v.protein, 0) * 10) / 10,
  };
};

export type Nutrients = { kcal: string; protein: string };

/** The kcal and protein a reference food fills in for `servings` of it, as the text the inputs hold. Null when there is no reference food or no count. */
export const autoNutrientsFor = (ref: Pick<FoodRef, 'kcal' | 'proteinG'> | undefined, servings: number | null): Nutrients | null =>
  ref && servings !== null ? { kcal: String(Math.round(ref.kcal * servings)), protein: String(Math.round(ref.proteinG * servings * 10) / 10) } : null;

/**
 * A food's kcal and protein after its name or servings change. Each one takes the new auto value (`next`) when it is blank or
 * still the auto value from before the change (`was`); a value the doctor typed stays as it is.
 */
export const autoNutrients = (current: Nutrients, was: Nutrients | null, next: Nutrients | null): Nutrients => {
  const pick = (field: keyof Nutrients) => (current[field].trim() === '' || (was !== null && current[field] === was[field]) ? (next?.[field] ?? '') : current[field]);
  return { kcal: pick('kcal'), protein: pick('protein') };
};

/** Meal kcal minus the daily kcal target: negative is short, positive is over, 0 matches. */
export const kcalGap = (rows: SlotRow[], targetKcal: string) => sumMeals(rows).kcal - Math.round(num(targetKcal));

const text = (en: string, hi: string) => ({ en: en.trim(), hi: hi.trim() || null });
/** A typed food number, or null when left blank. */
const optional = (v: string) => (v.trim() === '' ? null : Number(v));

export const toSlots = (rows: SlotRow[]): MealSlot[] => {
  const slotCodes = rows.map((r) => r.code).filter(Boolean);
  return rows.map((r) => {
    const code = r.code || newCode(r.en, slotCodes);
    if (!r.code) slotCodes.push(code);
    const optionCodes = r.options.map((o) => o.code).filter(Boolean);
    return {
      code,
      label: text(r.en, r.hi),
      window: `${r.from}-${r.to}`,
      kcal: mealValues(r).kcal,
      proteinG: mealValues(r).protein,
      advice: r.advice.trim() || null,
      options: r.options.map((o) => {
        const optionCode = o.code || newCode(o.en, optionCodes);
        if (!o.code) optionCodes.push(optionCode);
        // Every food is a main option: the add-on type was dropped from the form
        return {
          code: optionCode,
          label: text(o.en, o.hi),
          quantity: o.quantity.trim(),
          kind: 'OPTION' as const,
          ...(FOOD_NUTRIENTS && { kcal: optional(o.kcal), proteinG: optional(o.protein) }),
        };
      }),
    };
  });
};

/** Nutrients of a food or meal as text: "180 kcal · 3 g". A part that is 0 is left out; both 0 gives "". */
export const nutrientText = (kcal: number, proteinG: number) => [kcal ? `${kcal} kcal` : '', proteinG ? `${proteinG} g` : ''].filter(Boolean).join(' · ');
