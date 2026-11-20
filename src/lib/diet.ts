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
