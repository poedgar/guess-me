import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import type { SupportedLocale } from '@/i18n';

export const LanguageSelector: React.FC = () => {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="flex gap-2">
      {(['uk', 'en'] as SupportedLocale[]).map((lang) => (
        <button type="button"
          key={lang}
          onClick={() => setLocale(lang)}
          data-cy="language-button"
          data-cy-lang={lang}
          className={`px-3 py-2 rounded-lg font-semibold transition-all ${
            locale === lang
              ? 'bg-game-blue text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
};
