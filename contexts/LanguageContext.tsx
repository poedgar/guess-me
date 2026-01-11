import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { i18n, SupportedLocale } from '@/i18n';

interface LanguageContextType {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => Promise<void>;
  ready: boolean;
}

const STORAGE_KEY = 'app.locale';

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [locale, setLocaleState] = useState<SupportedLocale>('uk');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const nextLocale: SupportedLocale = stored === 'en' || stored === 'uk' ? stored : 'uk';

        if (!mounted) return;

        i18n.locale = nextLocale;
        setLocaleState(nextLocale);
      } finally {
        if (mounted) setReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setLocale = async (nextLocale: SupportedLocale) => {
    i18n.locale = nextLocale;
    setLocaleState(nextLocale);
    await AsyncStorage.setItem(STORAGE_KEY, nextLocale);
  };

  const value = useMemo<LanguageContextType>(
    () => ({
      locale,
      setLocale,
      ready,
    }),
    [locale, ready]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
