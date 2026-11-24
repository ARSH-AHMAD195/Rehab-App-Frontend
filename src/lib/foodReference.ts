/**
 * The AIIMS Bhopal "Fit for Surgery: Indian Diet, Calorie & Protein Reference" (Department of
 * Anaesthesiology, Critical Care & Palliative Medicine). Approximate values for standard home
 * servings (katori ~150 ml, glass ~200 ml), as printed. A help for doctors writing a diet plan,
 * not shown to patients. Don't edit the numbers without a new version of the sheet.
 */
export type FoodRef = { group: string; name: string; serving: string; kcal: number; proteinG: number };

const rows = (group: string, items: [string, string, number, number][]): FoodRef[] =>
  items.map(([name, serving, kcal, proteinG]) => ({ group, name, serving, kcal, proteinG }));

export const FOOD_REFERENCE: FoodRef[] = [
  ...rows('Breakfast', [
    ['Poha (plain, cooked)', '1 katori (150 g)', 180, 3],
    ['Upma', '1 katori (150 g)', 190, 4],
    ['Idli', '2 pieces', 140, 4],
    ['Dosa (plain)', '1 medium', 160, 4],
    ['Oats (cooked)', '1 katori', 150, 5],
    ['Paratha (plain)', '1 medium', 200, 4],
    ['Paratha (aloo)', '1 medium', 250, 5],
  ]),
  ...rows('Main meal', [
    ['Rice (cooked)', '1 katori (150 g)', 200, 4],
    ['Roti / Chapati', '1 medium (30 g)', 80, 3],
    ['Dal (any, cooked)', '1 katori', 150, 9],
    ['Rajma', '1 katori', 180, 10],
    ['Chole', '1 katori', 200, 10],
    ['Paneer bhurji', '1 katori', 220, 14],
    ['Chicken curry', '1 katori (100 g chicken)', 230, 22],
    ['Fish curry', '1 katori (100 g fish)', 180, 20],
    ['Egg curry', '2 eggs', 220, 14],
    ['Sabzi (mixed veg)', '1 katori', 100, 3],
    ['Curd / Dahi', '1 katori (100 g)', 60, 3],
    ['Raita', '1 katori', 70, 3],
  ]),
  ...rows('High protein', [
    ['Boiled egg (whole)', '1 egg', 77, 6],
    ['Egg white only', '1 white', 17, 4],
    ['Paneer (raw)', '100 g', 265, 18],
    ['Sprouts (moong)', '1 katori', 100, 8],
    ['Soya chunks (cooked)', '1 katori', 150, 20],
    ['Peanuts', '1 handful (30 g)', 170, 7],
    ['Peanut butter', '1 tablespoon', 95, 4],
  ]),
  ...rows('Drinks and dairy', [
    ['Full-fat milk', '1 glass (200 ml)', 130, 7],
    ['Toned milk', '1 glass (200 ml)', 100, 6],
    ['Skimmed milk', '1 glass (200 ml)', 70, 7],
    ['Green tea', '1 cup', 2, 0],
    ['Black tea (no sugar)', '1 cup', 5, 0],
    ['Tea with milk + sugar', '1 cup', 50, 2],
    ['Lassi (plain)', '1 glass', 150, 6],
    ['Buttermilk (chaach)', '1 glass', 40, 2],
    ['Protein shake', '1 scoop (30 g)', 120, 24],
  ]),
  ...rows('Fruits and snacks', [
    ['Banana', '1 medium', 90, 1],
    ['Apple', '1 medium', 80, 0.4],
    ['Papaya', '1 katori (150 g)', 65, 0.6],
    ['Guava', '1 medium', 55, 2],
    ['Makhana (fox nuts)', '1 handful (30 g)', 100, 4],
    ['Almonds', '10 pieces', 70, 3],
    ['Walnuts', '4 halves (20 g)', 100, 2],
  ]),
];

/** The reference food a typed name matches exactly (ignoring case and surrounding spaces), if any. */
export const findFood = (name: string) => {
  const n = name.trim().toLowerCase();
  return n ? FOOD_REFERENCE.find((f) => f.name.toLowerCase() === n) : undefined;
};
