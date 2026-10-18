import { Loader2, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warn';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90 shadow-sm',
  secondary: 'bg-card text-fg border border-line hover:bg-hover',
  ghost: 'text-fg hover:bg-hover',
  danger: 'bg-card text-danger border border-line hover:bg-danger/10',
  warn: 'bg-warn/10 text-warn border border-warn/40 hover:bg-warn/20',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition select-none whitespace-nowrap',
        'disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      className={cx(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-hover hover:text-fg',
        active && 'bg-accent-soft text-accent hover:text-accent',
        className,
      )}
    >
      {children}
    </button>
  );
}

export const inputClass =
  'w-full rounded-lg border border-line bg-card px-3 text-sm text-fg placeholder:text-muted/70 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(inputClass, 'h-10', className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(inputClass, 'min-h-24 py-2 leading-relaxed', className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(inputClass, 'h-10 cursor-pointer', className)}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-fg">{label}</span>
      {children}
      {hint && <span className="block text-xs leading-relaxed text-muted">{hint}</span>}
    </label>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cx('flex cursor-pointer items-start gap-3', disabled && 'pointer-events-none opacity-50')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition',
          checked ? 'bg-accent' : 'bg-line',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 size-4 rounded-full bg-white shadow transition-all',
            checked ? 'start-[18px]' : 'start-0.5',
          )}
        />
      </button>
      <span className="space-y-0.5">
        <span className="block text-sm text-fg">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-xl border border-line bg-panel', className)}>{children}</div>;
}

export function Badge({ tone = 'muted', children }: { tone?: 'muted' | 'ok' | 'danger' | 'warn' | 'accent'; children: ReactNode }) {
  const tones = {
    muted: 'bg-hover text-muted',
    ok: 'bg-ok/10 text-ok',
    danger: 'bg-danger/10 text-danger',
    warn: 'bg-warn/10 text-warn',
    accent: 'bg-accent-soft text-accent',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-4 animate-spin text-muted', className)} />;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[10vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className={cx('animate-in w-full rounded-2xl border border-line bg-panel shadow-2xl', wide ? 'max-w-2xl' : 'max-w-md')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ---- confirm dialog

interface ConfirmState {
  message: string;
  ok: string;
  cancel: string;
  danger?: boolean;
  resolve: (v: boolean) => void;
}

const ConfirmCtx = createContext<(o: Omit<ConfirmState, 'resolve'>) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const ask = useCallback((o: Omit<ConfirmState, 'resolve'>) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onMouseDown={() => close(false)}>
          <div className="animate-in w-full max-w-sm rounded-2xl border border-line bg-panel p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <p className="text-sm leading-relaxed">{state.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => close(false)}>{state.cancel}</Button>
              <Button variant={state.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
                {state.ok}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmCtx);
}

// ---- toasts

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error';
}

const ToastCtx = createContext<(text: string, tone?: 'ok' | 'error') => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const n = useRef(0);
  const push = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    const id = ++n.current;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 start-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2 rtl:translate-x-1/2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'animate-in pointer-events-auto max-w-md rounded-xl px-4 py-2.5 text-sm shadow-lg',
              t.tone === 'error' ? 'bg-danger text-white' : 'bg-fg text-bg',
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

export function Empty({ icon, title, hint, children }: { icon: ReactNode; title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">{icon}</div>
      <h3 className="text-base font-semibold">{title}</h3>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
