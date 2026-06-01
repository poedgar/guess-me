import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { i18n, type SupportedLocale } from '@/i18n';

interface LanguageContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (scope: string, options?: Record<string, any>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>(i18n.locale as SupportedLocale);

  const setLocale = (newLocale: SupportedLocale) => {
    i18n.locale = newLocale;
    setLocaleState(newLocale);
    localStorage.setItem('app_locale', newLocale);
  };

  // Re-created on every locale change — forces consumers to re-render
  const t = useCallback(
    (scope: string, options?: Record<string, any>) => i18n.t(scope, { ...options }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );

  useEffect(() => {
    const savedLocale = localStorage.getItem('app_locale');
    if (savedLocale && (savedLocale === 'uk' || savedLocale === 'en')) {
      setLocale(savedLocale as SupportedLocale);
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
