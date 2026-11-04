import { afterEach, describe, expect, it } from 'vitest';
import { hi } from './hi';
import { setLang, t } from './i18n';

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe('i18n', () => {
  afterEach(() => setLang('en'));

  it('translates when switched on and falls back to English for anything unknown', () => {
    expect(t('Done')).toBe('Done');
    expect(t('Week {week} of {weeks}', { week: 1, weeks: 4 })).toBe('Week 1 of 4');
    setLang('hi');
    expect(t('Done')).toBe('पूरा हुआ');
    expect(t('{done} of {planned} done', { done: 2, planned: 5 })).toBe('5 में से 2 पूरे');
    expect(t('An exercise name from the API')).toBe('An exercise name from the API');
  });

  it('keeps every placeholder in the Hindi text', () => {
    for (const [en, text] of Object.entries(hi)) expect(placeholders(text), en).toEqual(placeholders(en));
  });

  it('has Hindi for every t() in the patient area', () => {
    const files = import.meta.glob(['../components/{patient,exercise,health,common,pwa}/*.tsx', '../pages/patient/*.tsx', '../layouts/*.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    for (const [file, source] of Object.entries(files)) {
      for (const [, text] of source.matchAll(/\b(?:t|tr)\('([^']+)'/g)) expect(hi[text!], `${file}: ${text}`).toBeDefined();
    }
  });
});
