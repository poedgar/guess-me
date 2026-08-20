import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import uk from './locales/uk.json';

export function createAppI18n(initialLocale) {
    return createI18n({
        legacy: false,
        locale: initialLocale ?? 'uk',
        fallbackLocale: 'en',
        messages: { en, uk },
    });
}
