export type LimitErrors = { low?: string; high?: string; severity?: string };

/**
 * Mirrors the server's rules for a low/high pair: both inside min..max, low below high.
 * `low` and `high` are the raw input texts ('' = not set); at least one is needed.
 */
export const validateLimits = (low: string, high: string, bounds: { min?: number; max?: number }): LimitErrors => {
  const errors: LimitErrors = {};
  const lo = low.trim() === '' ? null : Number(low);
  const hi = high.trim() === '' ? null : Number(high);
  if (lo === null && hi === null) {
    errors.low = 'Enter a low limit, a high limit, or both.';
    return errors;
  }
  const check = (v: number | null, key: 'low' | 'high') => {
    if (v === null) return;
    if (!Number.isFinite(v)) errors[key] = 'Enter a number.';
    else if (bounds.min !== undefined && v < bounds.min) errors[key] = `Must be at least ${bounds.min}.`;
    else if (bounds.max !== undefined && v > bounds.max) errors[key] = `Must be at most ${bounds.max}.`;
  };
  check(lo, 'low');
  check(hi, 'high');
  if (!errors.low && !errors.high && lo !== null && hi !== null && lo >= hi) errors.low = 'Low must be less than high.';
  return errors;
};

/** '' -> null, else the number. Call only after validateLimits passed. */
export const toLimit = (text: string) => (text.trim() === '' ? null : Number(text));
