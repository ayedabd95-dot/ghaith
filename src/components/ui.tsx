import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X, type LucideIcon } from 'lucide-react';

/* ---------- data loader ---------- */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fnRef.current()); } catch (e) { setError((e as Error).message || 'خطأ'); }
    finally { setLoading(false); }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, deps);
  return { data, error, loading, reload, setData };
}

/* ---------- toast ---------- */
type Toast = { id: number; text: string; kind: 'ok' | 'err'; action?: { label: string; run: () => void } };
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { ...t, id }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), t.action ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed inset-x-0 bottom-24 lg:bottom-6 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none no-print" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`anim-toast pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 shadow-lift text-[15px] font-medium max-w-md w-full ${t.kind === 'ok' ? 'bg-brand-900 text-white' : 'bg-red-700 text-white'}`}>
            {t.kind === 'ok' ? <CheckCircle2 className="size-5 shrink-0" /> : <AlertCircle className="size-5 shrink-0" />}
            <span className="flex-1">{t.text}</span>
            {t.action && <button className="font-bold underline underline-offset-4" onClick={() => { t.action!.run(); setList((l) => l.filter((x) => x.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- modal ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center no-print" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-ink-900/50" onClick={onClose} />
      <div className={`anim-pop relative bg-white w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} rounded-t-3xl sm:rounded-2xl max-h-[92vh] overflow-auto`}>
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-ink-200 z-10">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="size-10 grid place-items-center rounded-xl hover:bg-ink-100" onClick={onClose} aria-label="إغلاق"><X className="size-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({ open, title, text, confirmLabel, danger, onConfirm, onClose, busy }: {
  open: boolean; title: string; text: ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-ink-700 leading-7">{text}</div>
      <div className="flex gap-2 mt-6">
        <button className={danger ? 'btn-danger flex-1' : 'btn-primary flex-1'} disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button>
      </div>
    </Modal>
  );
}

/* ---------- layout bits ---------- */
export function PageHeader({ title, sub, icon: Icon, actions }: { title: string; sub?: string; icon?: LucideIcon; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <span className="size-11 rounded-xl bg-brand-50 text-brand-700 grid place-items-center shrink-0"><Icon className="size-6" /></span>}
        <div className="min-w-0">
          <h1 className="text-xl lg:text-2xl font-bold text-ink-900">{title}</h1>
          {sub && <p className="text-sm text-ink-500 mt-0.5">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, icon: Icon, action, children, className = '' }: { title: string; icon?: LucideIcon; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-4 lg:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="flex items-center gap-2 text-[17px] font-bold text-ink-900">
          {Icon && <Icon className="size-5 text-brand-600" />}{title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const TONES = {
  green: 'from-brand-700 to-brand-800',
  purple: 'from-plum-600 to-plum-700',
  gold: 'from-gold-500 to-gold-700',
  navy: 'from-navy-600 to-navy-700',
  dark: 'from-brand-900 to-brand-950',
};
export function StatTile({ label, value, icon: Icon, tone }: { label: string; value: ReactNode; icon: LucideIcon; tone: keyof typeof TONES }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-l ${TONES[tone]} text-white p-4 flex items-center justify-between gap-3 shadow-card min-w-0`}>
      <div className="min-w-0">
        <div className="text-lg xl:text-[22px] font-bold leading-tight">{value}</div>
        <div className="text-sm text-white/85 mt-0.5">{label}</div>
      </div>
      <span className="size-12 rounded-full bg-white/15 grid place-items-center shrink-0"><Icon className="size-6" /></span>
    </div>
  );
}

export function Field({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}{required && <span className="text-red-600 ms-1">*</span>}</span>
      {children}
      {hint && !error && <span className="block text-xs text-ink-500 mt-1">{hint}</span>}
      {error && <span className="block text-sm text-red-600 mt-1">{error}</span>}
    </label>
  );
}

export function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <span className="mx-auto size-14 rounded-2xl bg-ink-100 text-ink-500 grid place-items-center"><Icon className="size-7" /></span>
      <h3 className="mt-4 font-bold text-ink-900">{title}</h3>
      <p className="mt-1 text-sm text-ink-500 max-w-sm mx-auto leading-6">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) { return <div className={`skeleton ${className}`} />; }
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return <div className="space-y-3">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;
}

export function ErrorBox({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <div className="card p-6 text-center">
      <AlertCircle className="size-8 text-red-600 mx-auto" />
      <p className="mt-2 text-ink-700">{text}</p>
      {retry && <button className="btn-ghost mt-4" onClick={retry}>حاول مرة ثانية</button>}
    </div>
  );
}

export function Progress({ value, tone = 'bg-brand-600' }: { value: number; tone?: string }) {
  return (
    <div className="h-2 rounded-full bg-ink-100 overflow-hidden" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%`, transition: 'width 400ms cubic-bezier(.23,1,.32,1)' }} />
    </div>
  );
}

export function Ring({ value, size = 120, stroke = 12, color = '#1a7746', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1ef" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, value) / 100)} style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.23,1,.32,1)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { key: T; label: string; badge?: number }[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1" role="tablist">
      {items.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} className={`tab shrink-0 ${value === t.key ? 'tab-active' : 'bg-white border border-ink-200'}`} onClick={() => onChange(t.key)}>
          {t.label}{!!t.badge && <span className="ms-1.5 chip bg-red-600 text-white">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}
