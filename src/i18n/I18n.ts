import type { Locale } from './types.ts';
import { uiString } from './ui-strings.ts';

const STORAGE_KEY = 'terra4-locale';

export class I18n {
  private _locale: Locale;

  constructor(initial?: Locale) {
    this._locale = initial ?? I18n.loadStoredLocale() ?? 'ru';
  }

  get locale(): Locale {
    return this._locale;
  }

  setLocale(locale: Locale): void {
    this._locale = locale;
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }

  t(key: Parameters<typeof uiString>[1], params?: Record<string, string | number>): string {
    return uiString(this._locale, key, params);
  }

  formatNumber(value: number): string {
    return value.toLocaleString(this._locale === 'ru' ? 'ru-RU' : 'en-US');
  }

  private static loadStoredLocale(): Locale | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'ru' || stored === 'en') return stored;
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function createI18n(): I18n {
  const i18n = new I18n();
  document.documentElement.lang = i18n.locale;
  return i18n;
}
