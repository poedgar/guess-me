import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useLanguage } from '@/contexts/LanguageContext';

export const LanguageSelector: React.FC = () => {
  const { locale, setLocale } = useLanguage();

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.pill, locale === 'uk' ? styles.pillActive : null]}
        onPress={() => setLocale('uk')}
      >
        <ThemedText style={[styles.pillText, locale === 'uk' ? styles.pillTextActive : null]}>UA</ThemedText>
      </Pressable>
      <Pressable
        style={[styles.pill, locale === 'en' ? styles.pillActive : null]}
        onPress={() => setLocale('en')}
      >
        <ThemedText style={[styles.pillText, locale === 'en' ? styles.pillTextActive : null]}>EN</ThemedText>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'center',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  pillActive: {
    backgroundColor: 'rgba(76, 175, 80, 0.25)',
    borderColor: 'rgba(76, 175, 80, 0.6)',
  },
  pillText: {
    fontWeight: '700',
  },
  pillTextActive: {
    fontWeight: '800',
  },
});
