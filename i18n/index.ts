import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';

import en from '@/locales/en.json';
import uk from '@/locales/uk.json';

export type SupportedLocale = 'uk' | 'en';

const SUPPORTED: SupportedLocale[] = ['uk', 'en'];

function detectLocale(): SupportedLocale {
  const tag = getLocales()[0]?.languageCode ?? '';
  return SUPPORTED.includes(tag as SupportedLocale) ? (tag as SupportedLocale) : 'uk';
}

export const i18n = new I18n({ en, uk });

i18n.defaultLocale = 'uk';
i18n.enableFallback = true;
i18n.locale = detectLocale();

export const t = (scope: string, options?: Record<string, any>) => i18n.t(scope, options);
