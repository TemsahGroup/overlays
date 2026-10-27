import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ar, en, type StringKey } from './strings';

export type Lang = 'ar' | 'en';
const STORAGE_KEY = 'ui:lang';
const DICTS: Record<Lang, Record<StringKey, string>> = { ar, en };

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    /* storage blocked */
  }
  return 'ar';
}

export type Translate = (key: StringKey, vars?: Record<string, string | number>) => string;

interface I18n {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: Translate;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* keep for this page only */
    }
  }, []);
  const t = useCallback<Translate>(
    (key, vars) => {
      const text = DICTS[lang][key] ?? en[key];
      return vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text;
    },
    [lang],
  );
  const value = useMemo<I18n>(() => ({ lang, dir: lang === 'ar' ? 'rtl' : 'ltr', t, setLang }), [lang, t, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
