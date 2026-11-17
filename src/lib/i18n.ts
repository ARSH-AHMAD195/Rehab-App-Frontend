import { useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react';
import { hi } from './hi';
import type { BiText, ExerciseHindi } from '../types/api';

// Hindi for the patient area only. Text is keyed by its English wording, so anything missing
// from the dictionary (and everything outside the patient area) simply stays English.
export type Lang = 'en' | 'hi';

const STORAGE_KEY = 'ffs_language';
let lang: Lang = 'en';
const listeners = new Set<() => void>();

const apply = (next: Lang) => {
  lang = next;
  document.documentElement.lang = next;
  listeners.forEach((l) => l());
};

/** The choice made on this device, or null if none was. */
const stored = (): Lang | null => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'hi' || value === 'en' ? value : null;
  } catch {
    return null;
  }
};
const saved = (): Lang => stored() ?? 'en';

export const setLang = (next: Lang) => {
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private mode: the choice just lasts until the page is closed
  }
  apply(next);
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Re-renders on a switch. Pages call it once; everything they render re-renders with them. */
export const useLang = () => useSyncExternalStore(subscribe, () => lang);

/** Applies the saved language while the patient area is on screen, and English again once it's gone. */
export const usePatientLanguage = (enabled: boolean) => {
  useLayoutEffect(() => {
    if (!enabled) return undefined;
    apply(saved());
    return () => apply('en');
  }, [enabled]);
};

/**
 * Once a patient's account is loaded: a choice already made on this phone is saved to the account;
 * on a phone with no choice yet, the account's is used. So the language follows them to a new phone.
 */
export const syncLanguage = (account: Lang, saveToAccount: (next: Lang) => void) => {
  const local = stored();
  if (!local) setLang(account);
  else if (local !== account) saveToAccount(local);
};

/** undefined means the browser's own locale. */
export const locale = () => (lang === 'hi' ? 'hi-IN' : undefined);

export const isHindi = () => lang === 'hi';

export const t = (text: string, vars?: Record<string, string | number>) => {
  const s = lang === 'hi' ? (hi[text] ?? text) : text;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k])) : s;
};

/** For props that may be plain text or JSX: translates the text, leaves JSX alone. */
export const tx = (node: ReactNode) => (typeof node === 'string' ? t(node) : node);

type Translatable = { name: string; description: string | null; instructions: string[]; hi: ExerciseHindi | null };

/** An exercise in the patient's language: each Hindi part falls back to English when empty. */
export const localExercise = <E extends Translatable>(ex: E): E =>
  lang === 'hi' && ex.hi
    ? { ...ex, name: ex.hi.name || ex.name, description: ex.hi.description || ex.description, instructions: ex.hi.instructions.length ? ex.hi.instructions : ex.instructions }
    : ex;

/** A plan or checklist with every exercise in the patient's language. Use as a query `select` written inline, so it reruns on a language switch. */
export const localItems = <D extends { items: { exercise: Translatable }[] }>(data: D): D => ({
  ...data,
  items: data.items.map((item) => ({ ...item, exercise: localExercise(item.exercise) })),
});

/** API text with an optional Hindi version (diet chart). Until the clinic sends Hindi, ours by the English wording, else English. */
export const biText = (text: BiText) => (lang === 'hi' && text.hi) || t(text.en);
