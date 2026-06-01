import React, { createContext, useContext, useState, useEffect } from 'react';
import { i18n, type SupportedLocale } from '@/i18n';

interface LanguageContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
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

  useEffect(() => {
    const savedLocale = localStorage.getItem('app_locale');
    if (savedLocale && (savedLocale === 'uk' || savedLocale === 'en')) {
      setLocale(savedLocale as SupportedLocale);
    }
  }, []);

  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>
      {children}
    </LanguageContext.Provider>
  );
};
