import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Lang } from '../../lib/settings';
import { ar } from './ar';
import { ckb } from './ckb';
import { de } from './de';
import { en, type StringKey, type Strings } from './en';
import { fa } from './fa';
import { fr } from './fr';
import { it } from './it';
import { pt } from './pt';

export type LangCode = Exclude<Lang, 'auto'>;

export const LANGUAGES: { code: LangCode; name: string; rtl: boolean; locale: string }[] = [
  { code: 'en', name: 'English', rtl: false, locale: 'en' },
  { code: 'fa', name: 'فارسی', rtl: true, locale: 'fa-IR' },
  { code: 'ckb', name: 'کوردی (سۆرانی)', rtl: true, locale: 'ckb-IQ' },
  { code: 'ar', name: 'العربية', rtl: true, locale: 'ar' },
  { code: 'de', name: 'Deutsch', rtl: false, locale: 'de' },
  { code: 'fr', name: 'Français', rtl: false, locale: 'fr' },
  { code: 'it', name: 'Italiano', rtl: false, locale: 'it' },
  { code: 'pt', name: 'Português', rtl: false, locale: 'pt-BR' },
];

const DICTS: Record<LangCode, Strings> = { en, fa, ckb, ar, de, fr, it, pt };

export function resolveLang(setting: Lang | undefined): LangCode {
  if (setting && setting !== 'auto' && DICTS[setting as LangCode]) return setting as LangCode;
  for (const l of navigator.languages ?? [navigator.language]) {
    const code = l.toLowerCase();
    if (code.startsWith('ckb') || code === 'ku-iq' || code.startsWith('ku-arab')) return 'ckb';
    const base = code.split('-')[0] as LangCode;
    if (DICTS[base]) return base;
  }
  return 'en';
}

export type Vars = Record<string, string | number>;

export interface I18n {
  lang: LangCode;
  rtl: boolean;
  locale: string;
  t: (key: StringKey, vars?: Vars) => string;
  num: (n: number) => string;
  date: (ms: number) => string;
  ago: (ms: number) => string;
}

export function makeI18n(lang: LangCode): I18n {
  const meta = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  const dict = DICTS[lang];
  let numFmt: Intl.NumberFormat;
  let dateFmt: Intl.DateTimeFormat;
  try {
    numFmt = new Intl.NumberFormat(meta.locale);
    dateFmt = new Intl.DateTimeFormat(meta.locale, { dateStyle: 'medium' });
  } catch {
    numFmt = new Intl.NumberFormat('en');
    dateFmt = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });
  }
  const num = (n: number) => numFmt.format(n);
  const t = (key: StringKey, vars?: Vars) => {
    let s = dict[key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(typeof v === 'number' ? num(v) : v);
    return s;
  };
  return {
    lang,
    rtl: meta.rtl,
    locale: meta.locale,
    t,
    num,
    date: (ms) => (ms ? dateFmt.format(ms) : ''),
    ago: (ms) => {
      if (!ms) return t('never');
      const m = Math.round((Date.now() - ms) / 60_000);
      if (m < 1) return t('justNow');
      if (m < 60) return t('minutesAgo', { n: m });
      const h = Math.round(m / 60);
      if (h < 24) return t('hoursAgo', { n: h });
      const d = Math.round(h / 24);
      if (d < 30) return t('daysAgo', { n: d });
      return dateFmt.format(ms);
    },
  };
}

const Ctx = createContext<I18n>(makeI18n('en'));

export function I18nProvider({ lang, children }: { lang: LangCode; children: ReactNode }) {
  const value = useMemo(() => makeI18n(lang), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  return useContext(Ctx);
}

export type { StringKey };
