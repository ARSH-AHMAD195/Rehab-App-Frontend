import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

type Tone = 'success' | 'error' | 'info';
type ToastApi = Record<Tone, (message: string) => void>;

const ToastContext = createContext<ToastApi | null>(null);

const TONES: Record<Tone, [string, LucideIcon, string]> = {
  success: ['border-emerald-200 bg-white text-emerald-950', CheckCircle2, 'text-emerald-700'],
  error: ['border-rose-200 bg-white text-rose-950', AlertCircle, 'text-rose-700'],
  info: ['border-slate-200 bg-white text-slate-900', Info, 'text-teal-700'],
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<{ id: number; tone: Tone; message: string }[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (tone: Tone, message: string) => {
      const id = ++nextId.current;
      setToasts((all) => [...all.slice(-3), { id, tone, message }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 5000);
    },
    [dismiss]
  );

  const toast = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m), info: (m) => push('info', m) }),
    [push]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        // Clears the patient bottom tab bar on phones
        className="pointer-events-none fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-[60] w-[calc(100%-2rem)] space-y-2 sm:w-96 lg:bottom-4"
        aria-live="polite"
      >
        {toasts.map(({ id, tone, message }) => {
          const [styles, Icon, iconColor] = TONES[tone];
          return (
            <div
              key={id}
              role={tone === 'error' ? 'alert' : 'status'}
              className={cn('pointer-events-auto flex items-start gap-2.5 rounded-2xl border p-3.5 text-sm shadow-lg', styles)}
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', iconColor)} aria-hidden="true" />
              <p className="flex-1 leading-relaxed">{message}</p>
              <button type="button" onClick={() => dismiss(id)} aria-label="Dismiss notification" className="rounded p-1 text-slate-600 hover:text-slate-900">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast must be used within a ToastProvider');
  return toast;
};
