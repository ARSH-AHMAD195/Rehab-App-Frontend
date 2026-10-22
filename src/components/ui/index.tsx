import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, RefreshCw, X, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../services/api';

// Contrast note: text uses slate-600 or darker and teal-700 or darker on white (WCAG AA 4.5:1).
// teal-600 (#0d9488) is only 3.7:1 and is reserved for non-text accents.

// ---------- Buttons ----------

const BUTTON_VARIANTS = {
  primary: 'bg-teal-700 text-white hover:bg-teal-800 shadow-xs',
  secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
  subtle: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
  danger: 'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50',
  'danger-solid': 'bg-rose-700 text-white hover:bg-rose-800 shadow-xs',
  success: 'border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50',
  ghost: 'text-teal-800 hover:bg-teal-50',
} as const;

const BUTTON_SIZES = {
  sm: 'min-h-9 px-3 py-1.5 text-xs',
  md: 'min-h-10 px-4 py-2 text-sm',
  lg: 'min-h-12 px-5 py-3 text-base',
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;
export type ButtonSize = keyof typeof BUTTON_SIZES;

export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) =>
  cn(
    'inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className
  );

type ButtonProps = ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean };

export const Button = ({ variant, size, loading = false, className, children, disabled, ...props }: ButtonProps) => (
  <button
    type="button"
    {...props}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={buttonClass(variant, size, className)}
  >
    {loading && <Spinner className="h-4 w-4 border-2 border-current border-t-transparent" />}
    {children}
  </button>
);

// ---------- Layout ----------

export const Card = ({ className, children, ...props }: ComponentProps<'section'>) => (
  <section className={cn('rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6', className)} {...props}>
    {children}
  </section>
);

export const PageHeader = ({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) => (
  <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:p-6">
    <div>
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
  </div>
);

export const SectionTitle = ({
  title,
  description,
  actions,
  as: Heading = 'h2',
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  as?: 'h2' | 'h3';
}) => (
  <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
    <div>
      <Heading className="text-lg font-bold text-slate-900">{title}</Heading>
      {description && <p className="text-sm text-slate-600">{description}</p>}
    </div>
    {actions}
  </div>
);

export const StatCard = ({ label, value, hint, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'teal' }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</span>
    <p className={cn('mt-1 text-3xl font-bold', tone === 'teal' ? 'text-teal-800' : 'text-slate-900')}>{value}</p>
    {hint && <span className="mt-1 block text-xs text-slate-600">{hint}</span>}
  </div>
);

const BADGE_TONES = {
  slate: 'bg-slate-100 text-slate-800',
  teal: 'bg-teal-50 text-teal-900 border border-teal-200',
  emerald: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  amber: 'bg-amber-100 text-amber-900',
  rose: 'bg-rose-50 text-rose-800 border border-rose-200',
} as const;

export const Badge = ({ tone = 'slate', className, children }: { tone?: keyof typeof BADGE_TONES; className?: string; children: ReactNode }) => (
  <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold', BADGE_TONES[tone], className)}>{children}</span>
);

// ---------- Forms ----------

export const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 transition-colors placeholder:text-slate-500 ' +
  'focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/30 disabled:bg-slate-50 disabled:opacity-60 ' +
  'aria-[invalid=true]:border-rose-500 aria-[invalid=true]:ring-rose-500/30';

type FieldProps = { label: ReactNode; hint?: ReactNode; error?: string; className?: string; children: ReactElement };

/**
 * Wrapping <label> associates the text with its control; hint and error are linked via
 * aria-describedby so screen readers announce them, and aria-invalid marks the control.
 */
export const Field = ({ label, hint, error, className, children }: FieldProps) => {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const child = Children.only(children);
  const control = isValidElement<Record<string, unknown>>(child)
    ? cloneElement(child, {
        'aria-invalid': error ? true : undefined,
        'aria-describedby': cn(errorId, hintId) || undefined,
      })
    : child;

  return (
    <div className={className}>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-800">{label}</span>
        {control}
      </label>
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-slate-600">
          {hint}
        </p>
      )}
    </div>
  );
};

export const Input = ({ className, ...props }: ComponentProps<'input'>) => <input className={cn(inputClass, className)} {...props} />;
export const Textarea = ({ className, ...props }: ComponentProps<'textarea'>) => <textarea className={cn(inputClass, className)} {...props} />;
export const Select = ({ className, children, ...props }: ComponentProps<'select'>) => (
  <select className={cn(inputClass, className)} {...props}>
    {children}
  </select>
);

// ---------- Feedback ----------

const ALERT_STYLES: Record<'error' | 'success' | 'warning' | 'info', [string, LucideIcon, string]> = {
  error: ['border-rose-200 bg-rose-50 text-rose-900', AlertCircle, 'text-rose-700'],
  success: ['border-emerald-200 bg-emerald-50 text-emerald-900', CheckCircle2, 'text-emerald-700'],
  warning: ['border-amber-300 bg-amber-50 text-amber-950', AlertTriangle, 'text-amber-700'],
  info: ['border-teal-200 bg-teal-50 text-teal-950', Info, 'text-teal-700'],
};

export const Alert = ({
  tone = 'info',
  title,
  className,
  children,
}: {
  tone?: keyof typeof ALERT_STYLES;
  title?: ReactNode;
  className?: string;
  children: ReactNode;
}) => {
  const [styles, Icon, iconColor] = ALERT_STYLES[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex items-start gap-2.5 rounded-xl border p-3.5 text-sm', styles, className)}>
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', iconColor)} aria-hidden="true" />
      <div>
        {title && <strong className="block font-bold">{title}</strong>}
        <div className="leading-relaxed">{children}</div>
      </div>
    </div>
  );
};

export const Spinner = ({ className }: { className?: string }) => (
  <span aria-hidden="true" className={cn('inline-block h-10 w-10 animate-spin rounded-full border-4 border-teal-700 border-t-transparent', className)} />
);

export const PageLoader = ({ label = 'Loading…' }: { label?: string }) => (
  <div role="status" className="flex flex-col items-center justify-center py-20">
    <Spinner />
    <p className="mt-3 text-sm text-slate-600">{label}</p>
  </div>
);

export const ErrorState = ({ error, onRetry, title = 'We couldn’t load this page' }: { error: unknown; onRetry?: () => void; title?: string }) => (
  <div role="alert" className="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
    <AlertCircle className="mx-auto h-8 w-8 text-rose-600" aria-hidden="true" />
    <h2 className="mt-3 text-base font-bold text-slate-900">{title}</h2>
    <p className="mt-1 text-sm text-slate-600">{errorMessage(error)}</p>
    {onRetry && (
      <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Try again
      </Button>
    )}
  </div>
);

export const EmptyState = ({ className, children }: { className?: string; children: ReactNode }) => (
  <p className={cn('py-8 text-center text-sm text-slate-600', className)}>{children}</p>
);

// ---------- Dialogs ----------

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

type ModalProps = { title: ReactNode; description?: ReactNode; onClose?: () => void; size?: 'md' | 'lg' | 'xl'; children: ReactNode };

/** Omit `onClose` for a mandatory dialog (no close button, Escape or backdrop dismissal). */
export const Modal = ({ title, description, onClose, size = 'md', children }: ModalProps) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialog.querySelector<HTMLElement>('input, select, textarea')?.focus();
    // The first field may be hidden (e.g. inside a closed <details>): keep focus in the dialog
    if (!dialog.contains(document.activeElement)) dialog.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current?.();
      if (e.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-xs sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl focus:outline-none sm:rounded-3xl sm:p-6',
          { md: 'sm:max-w-md', lg: 'sm:max-w-lg', xl: 'sm:max-w-xl' }[size]
        )}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute right-3 top-3 rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        <h2 id={titleId} className="pr-10 text-lg font-bold text-slate-900">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export const ModalActions = ({
  onCancel,
  cancelLabel = 'Cancel',
  submitLabel,
  loading,
  submitVariant = 'primary',
}: {
  onCancel: () => void;
  cancelLabel?: string;
  submitLabel: string;
  loading?: boolean;
  submitVariant?: ButtonVariant;
}) => (
  <div className="flex gap-3 pt-2">
    <Button variant="secondary" className="flex-1" onClick={onCancel}>
      {cancelLabel}
    </Button>
    <Button type="submit" variant={submitVariant} className="flex-1" loading={loading}>
      {submitLabel}
    </Button>
  </div>
);

export const ConfirmDialog = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel,
  tone = 'danger',
  loading,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <Modal title={title} onClose={onCancel}>
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm();
      }}
    >
      <div className="text-sm text-slate-700">{message}</div>
      <div className="mt-4">
        <ModalActions
          onCancel={onCancel}
          cancelLabel={cancelLabel}
          submitLabel={confirmLabel}
          loading={loading}
          submitVariant={tone === 'danger' ? 'danger-solid' : 'primary'}
        />
      </div>
    </form>
  </Modal>
);
