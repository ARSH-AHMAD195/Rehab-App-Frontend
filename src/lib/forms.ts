import { useCallback, useState, type FormEvent } from 'react';
import { ApiError, errorMessage } from '../services/api';
import { isHindi, t } from './i18n';

type FieldErrors = Record<string, string>;

/** Browsers word validation messages in their own language, so Hindi needs its own wording. */
const validationText = (el: HTMLInputElement) => {
  const v = el.validity;
  if (!isHindi()) return el.validationMessage;
  if (v.valueMissing) return t('Please fill this in.');
  if (v.rangeUnderflow) return t('Must be at least {n}.', { n: el.min });
  if (v.rangeOverflow) return t('Must be at most {n}.', { n: el.max });
  if (v.tooShort) return t('Must be at least {n} characters.', { n: el.minLength });
  if (v.badInput || v.stepMismatch) return t('Please enter a valid number.');
  if (v.patternMismatch || v.typeMismatch) return t('Please use the format shown.');
  return el.validationMessage;
};

/**
 * Inline validation using the browser's own constraint rules (required, min, minLength,
 * type=email…) but rendered next to each field instead of as native popups. Forms use
 * `noValidate`; inputs need a `name`. Server 400s with per-field errors map onto the same fields.
 */
export const useFormErrors = () => {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');

  /** Returns true when valid; otherwise shows messages and focuses the first invalid field. */
  const validate = useCallback((form: HTMLFormElement) => {
    const next: FieldErrors = {};
    let first: HTMLElement | null = null;
    for (const el of Array.from(form.elements) as HTMLInputElement[]) {
      if (!el.name || !el.willValidate || el.validity.valid) continue;
      next[el.name] = validationText(el);
      first ??= el;
    }
    setErrors(next);
    setFormError('');
    first?.focus();
    return first === null;
  }, []);

  const clear = useCallback((name: string) => {
    setErrors((prev) => {
      if (!(name in prev)) return prev;
      const { [name]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  /** Shows a failed request: field-level messages where the server provided them. */
  const fromApiError = useCallback((err: unknown, fallback?: string) => {
    const fieldErrors = err instanceof ApiError ? err.fieldErrors : {};
    setErrors(fieldErrors);
    setFormError(Object.keys(fieldErrors).length ? t('Please correct the highlighted fields.') : errorMessage(err, fallback));
  }, []);

  /** Clears a field's message as soon as the user edits it. Spread onto <form>. */
  const onChange = useCallback((e: FormEvent<HTMLFormElement>) => clear((e.target as HTMLInputElement).name), [clear]);

  return { errors, formError, setFormError, validate, clear, fromApiError, onChange };
};
