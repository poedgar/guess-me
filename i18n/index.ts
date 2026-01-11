import { I18n } from 'i18n-js';

import en from '@/locales/en.json';
import uk from '@/locales/uk.json';

export type SupportedLocale = 'uk' | 'en';

export const i18n = new I18n({
  en,
  uk,
});

// Default language: Ukrainian
// (language can be changed at runtime via LanguageContext)
i18n.defaultLocale = 'uk';
i18n.enableFallback = true;

i18n.locale = 'uk';

export const t = (scope: string, options?: Record<string, any>) => i18n.t(scope, options);
