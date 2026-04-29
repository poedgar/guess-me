import AsyncStorage from '@react-native-async-storage/async-storage';
import { i18n } from '@/i18n';
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface LanguageContextType {
  locale: string;
  setLocale: (locale: string) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState(i18n.locale);

  useEffect(() => {
    const loadLocale = async () => {
      try {
        const savedLocale = await AsyncStorage.getItem('app_locale');
        if (savedLocale) {
          i18n.locale = savedLocale;
          setLocale(savedLocale);
        }
      } catch (error) {
        console.error('Failed to load locale:', error);
      }
    };

    loadLocale();
  }, []);

  const changeLanguage = async (newLocale: string) => {
    try {
      i18n.locale = newLocale;
      setLocale(newLocale);
      await AsyncStorage.setItem('app_locale', newLocale);
    } catch (error) {
      console.error('Failed to save locale:', error);
    }
  };

  const value: LanguageContextType = {
    locale,
    setLocale: changeLanguage,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
