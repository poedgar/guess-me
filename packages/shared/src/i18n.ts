import { I18n } from 'i18n-js';
import { ru as ruPlurals } from 'i18n-js/dist/require/pluralize/ru';
import en from './locales/en.json';
import uk from './locales/uk.json';

export type SupportedLocale = 'uk' | 'en';
export const SUPPORTED_LOCALES: SupportedLocale[] = ['uk', 'en'];

export const i18n = new I18n({ en, uk });
i18n.defaultLocale = 'uk';
i18n.enableFallback = true;
i18n.pluralization.register('uk', ruPlurals);

export const t = (scope: string, options?: Record<string, any>) => i18n.t(scope, options);
