import { Languages } from 'lucide-react';
import { setLang, useLang } from '../../lib/i18n';
import { cn } from '../../lib/cn';

/** English / Hindi for patient screens. Each language is named in itself, so it can be found without reading the other. */
export const LanguageSwitch = ({ className }: { className?: string }) => {
  const hindi = useLang() === 'hi';
  return (
    <button
      type="button"
      onClick={() => setLang(hindi ? 'en' : 'hi')}
      lang={hindi ? 'en' : 'hi'}
      className={cn('flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900', className)}
    >
      <Languages className="h-4 w-4" aria-hidden="true" />
      {hindi ? 'English' : 'हिन्दी'}
    </button>
  );
};
