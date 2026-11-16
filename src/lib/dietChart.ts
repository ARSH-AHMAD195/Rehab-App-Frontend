/**
 * The hospital's High-calorie, High-protein Diet chart, as printed. All wording is the English key
 * for the Hindi in hi.ts. Calories and protein belong to the whole meal slot, not to each option.
 */
export interface DietOption {
  /** How it joins the line above: 'or' is an alternative, 'plus' an add-on. */
  join: 'first' | 'or' | 'plus';
  food: string;
  quantity: string;
}

export interface DietSlot {
  name: string;
  time: string;
  kcal: number;
  proteinG: number;
  options: DietOption[];
}

/** The chart's printed daily totals. Its meal slots add up to 2207 kcal; the printed figure is kept. */
export const DIET_DAILY_KCAL = 2206;
export const DIET_DAILY_PROTEIN_G = 82.4;

export const DIET_CHART: DietSlot[] = [
  {
    name: 'Before breakfast',
    time: '06:00–07:00 AM',
    kcal: 183,
    proteinG: 4.2,
    options: [
      { join: 'first', food: 'Tea / green tea / black tea or lemon water (no sugar)', quantity: '½ cup / 1 glass' },
      { join: 'plus', food: 'Banana / roasted makhana / roasted chana', quantity: '1 / 1 katori' },
    ],
  },
  {
    name: 'Breakfast',
    time: '07:30–08:00 AM',
    kcal: 460,
    proteinG: 22.3,
    options: [
      { join: 'first', food: 'Poha / daliya / upma / bhagar (with vegetables)', quantity: '1 katori' },
      { join: 'or', food: 'Milk daliya (daliya / jau / bhagar / sevaiyan)', quantity: '1 katori' },
      { join: 'or', food: 'Besan chilla / moong dal chilla', quantity: '2–3' },
      { join: 'or', food: 'Idli + sambar', quantity: '2 + 1 katori' },
      { join: 'or', food: 'Toasted bread + roasted paneer / omelette', quantity: '2 slices + 50 g / 2 eggs' },
      { join: 'or', food: 'Roti + seasonal sabzi / paneer / soyabean', quantity: '2 + 1 katori' },
      { join: 'plus', food: 'Boiled eggs / paneer', quantity: '2 / 20–25 g' },
      { join: 'plus', food: 'Milk (boiled)', quantity: '1 glass' },
    ],
  },
  {
    name: 'Mid-morning',
    time: '10:00–10:30 AM',
    kcal: 86,
    proteinG: 3.4,
    options: [
      { join: 'first', food: 'Banana / seasonal fruit / orange (fresh, washed)', quantity: '2 / 100–150 g' },
      { join: 'or', food: 'Black chana / moong / sprout salad (boiled or steamed)', quantity: '1 katori' },
      { join: 'or', food: 'Chana / peanuts / murmura / chivda (roasted)', quantity: '1 katori' },
    ],
  },
  {
    name: 'Lunch',
    time: '12:30–01:30 PM',
    kcal: 711,
    proteinG: 24.7,
    options: [
      { join: 'first', food: 'Roti (atta / sattu / bajra / jowar / ragi / multigrain / missi) + boiled rice / pulao (soyabean / sabzi)', quantity: '3 + 1 katori' },
      { join: 'or', food: 'Vegetable khichdi / vegetable daliya + seasonal / green leafy sabzi', quantity: '1 plate + 1 katori' },
      { join: 'plus', food: 'Seasonal vegetables / green leafy / mixed veg', quantity: '2 katori' },
      { join: 'plus', food: 'Dal (dal / rajma / chhole / lobia) / kadhi / paneer / soyabean / sambar + curd (packaged)', quantity: '1 katori + 80 g' },
    ],
  },
  {
    name: 'Evening snack',
    time: '04:00–05:00 PM',
    kcal: 82,
    proteinG: 4.9,
    options: [
      { join: 'first', food: 'Green tea / black tea', quantity: '½ cup' },
      { join: 'plus', food: 'Chana / peanuts / dry fruits (roasted)', quantity: '½ katori' },
      { join: 'or', food: 'Sabudana / bajra khichdi', quantity: '1 katori' },
      { join: 'or', food: 'Ragi kheer / sevaiyan kheer / milk or fruit shake', quantity: '1 katori' },
      { join: 'or', food: 'Home-made soup (tomato / corn) / dal soup', quantity: '1 katori' },
      { join: 'or', food: 'Seasonal fruit (fresh, washed)', quantity: '2 / 100–150 g' },
    ],
  },
  {
    name: 'Dinner',
    time: '07:30–08:00 PM',
    kcal: 598,
    proteinG: 18.4,
    options: [
      { join: 'first', food: 'Roti + boiled rice', quantity: '2 + 1 katori' },
      { join: 'or', food: 'Dal khichdi / vegetable daliya + seasonal / green leafy sabzi', quantity: '1 plate + 2 katori' },
      { join: 'plus', food: 'Seasonal sabzi + dal / soyabean / egg curry / chicken curry', quantity: '2 katori + 1 katori' },
    ],
  },
  {
    name: 'After dinner',
    time: '08:30–09:00 PM',
    kcal: 87,
    proteinG: 4.5,
    options: [{ join: 'first', food: 'Milk (boiled, no sugar)', quantity: '1 cup' }],
  },
];
