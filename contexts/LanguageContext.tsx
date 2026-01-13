import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [locale, setLocale] = useState('en');

  useEffect(() => {
    const loadLocale = async () => {
      try {
        const savedLocale = await AsyncStorage.getItem('app_locale');
        if (savedLocale) {
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
