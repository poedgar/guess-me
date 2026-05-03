import { ThemedText } from '@/components/themed-text';
import type { Game } from '@/contexts/GameContext';
import { t } from '@/i18n';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  game: Game;
  user: { uid: string } | null;
  locale: string;
}

export const BasketScreen: React.FC<Props> = ({ locale }) => (
  <View style={styles.container}>
    <ThemedText style={styles.title}>
      {t('game.ui.gameTypeBasket', { locale })}
    </ThemedText>
    <ThemedText style={styles.subtitle}>Coming soon</ThemedText>
  </View>
);

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 16, opacity: 0.6 },
});
