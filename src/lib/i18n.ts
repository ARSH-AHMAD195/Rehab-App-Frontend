import { useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react';
import { hi } from './hi';

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

const saved = (): Lang => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
};

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

/** undefined means the browser's own locale. */
export const locale = () => (lang === 'hi' ? 'hi-IN' : undefined);

export const isHindi = () => lang === 'hi';

export const t = (text: string, vars?: Record<string, string | number>) => {
  const s = lang === 'hi' ? (hi[text] ?? text) : text;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k])) : s;
};

/** For props that may be plain text or JSX: translates the text, leaves JSX alone. */
export const tx = (node: ReactNode) => (typeof node === 'string' ? t(node) : node);
