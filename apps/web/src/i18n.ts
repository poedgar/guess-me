import { i18n, SUPPORTED_LOCALES, type SupportedLocale, t } from '@mirror/shared';

function detectLocale(): SupportedLocale {
  const tag = navigator.language.split('-')[0];
  return SUPPORTED_LOCALES.includes(tag as SupportedLocale) ? (tag as SupportedLocale) : 'uk';
}

i18n.locale = detectLocale();

export { i18n, t, type SupportedLocale };
