import { getLocales } from 'expo-localization';
import { i18n, t, SUPPORTED_LOCALES, type SupportedLocale } from '@mirror/shared';

function detectLocale(): SupportedLocale {
  const tag = getLocales()[0]?.languageCode ?? '';
  return SUPPORTED_LOCALES.includes(tag as SupportedLocale) ? (tag as SupportedLocale) : 'uk';
}

i18n.locale = detectLocale();

export { i18n, t, type SupportedLocale };
