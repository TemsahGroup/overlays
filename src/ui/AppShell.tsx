import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from './i18n';
import type { StringKey } from './strings';

export type NavKey = 'home' | 'gifts' | 'leaderboards';

const NAV: { key: NavKey; href: string; icon: string; label: StringKey }[] = [
  { key: 'home', href: '#/', icon: '🏠', label: 'nav.home' },
  { key: 'gifts', href: '#/builder', icon: '🎁', label: 'nav.gifts' },
  { key: 'leaderboards', href: '#/leaderboards', icon: '🏆', label: 'nav.leaderboards' },
];

// ---------- Toasts ----------

type ToastKind = 'ok' | 'error' | 'info';
const ToastContext = createContext<(text: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

/**
 * Shared frame for the streamer-facing pages: brand, navigation, language
 * switch and toasts. Direction (RTL/LTR) is applied here only, so OBS overlay
 * pages are never affected.
 */
export function AppShell({ active, title, children }: { active: NavKey; title: string; children: ReactNode }) {
  const { t, lang, dir, setLang } = useI18n();
  const [toast, setToast] = useState<{ text: string; kind: ToastKind; id: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string, kind: ToastKind = 'ok') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ text, kind, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  // Hash navigation keeps the old scroll position; a new page should start at the top.
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }, [active]);

  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · ${t('brand.name')}`;
    return () => {
      document.title = previous;
    };
  }, [title, t]);

  return (
    <ToastContext.Provider value={show}>
      <div className="shell" dir={dir} lang={lang}>
        <header className="shell-bar">
          <a className="shell-brand" href="#/">
            <span className="shell-logo" aria-hidden="true">
              ✦
            </span>
            <span>
              <b>{t('brand.name')}</b>
              <small>{t('brand.tagline')}</small>
            </span>
          </a>
          <nav className="shell-nav" aria-label="Main">
            {NAV.map((n) => (
              <a key={n.key} href={n.href} className={active === n.key ? 'is-active' : ''} aria-current={active === n.key ? 'page' : undefined}>
                <span aria-hidden="true">{n.icon}</span> {t(n.label)}
              </a>
            ))}
          </nav>
          <button type="button" className="shell-lang" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} aria-label={t('lang.otherLabel')}>
            🌐 {t('lang.other')}
          </button>
        </header>
        <div className="shell-body">{children}</div>
        {toast && (
          <div key={toast.id} className={`toast toast--${toast.kind}`} role="status">
            {toast.text}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

// ---------- Small building blocks ----------

export function StepCard({ n, title, hint, children, disabled }: { n: number; title: string; hint?: string; children: ReactNode; disabled?: boolean }) {
  return (
    <fieldset className="step" disabled={disabled}>
      <legend className="step-head">
        <span className="step-n">{n}</span>
        <span>
          <span className="step-title">{title}</span>
          {hint && <span className="step-hint">{hint}</span>}
        </span>
      </legend>
      <div className="step-body">{children}</div>
    </fieldset>
  );
}

export function PageHead({ icon, title, subtitle, children }: { icon: string; title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="page-head">
      <span className="page-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="page-head-text">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'is-active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ColorList({ colors, max = 8, min = 1, onChange }: { colors: string[]; max?: number; min?: number; onChange: (c: string[]) => void }) {
  const { t } = useI18n();
  return (
    <div className="colors">
      {colors.map((c, i) => (
        <span key={i} className="color">
          <input type="color" value={c} onChange={(e) => onChange(colors.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`${t('common.colors')} ${i + 1}`} />
          {colors.length > min && (
            <button type="button" className="color-x" onClick={() => onChange(colors.filter((_, j) => j !== i))} aria-label={t('common.removeColor')}>
              ×
            </button>
          )}
        </span>
      ))}
      {colors.length < max && (
        <button type="button" className="color-add" onClick={() => onChange([...colors, '#ffffff'])} aria-label={t('common.addColor')}>
          +
        </button>
      )}
    </div>
  );
}

export function Notice({ kind, children }: { kind: 'info' | 'error' | 'ok'; children: ReactNode }) {
  return <p className={`notice notice--${kind}`}>{children}</p>;
}
