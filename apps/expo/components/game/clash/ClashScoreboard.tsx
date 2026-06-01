import { ThemedText } from '@/components/themed-text';
import { Fonts, GameColors } from '@/constants/theme';
import { t } from '@/i18n';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  scoreA: number;
  scoreB: number;
  locale: string;
}

export const ClashScoreboard: React.FC<Props> = ({ scoreA, scoreB, locale }) => (
  <View style={styles.row}>
    <ThemedText style={styles.score}>
      {t('game.ui.clash.teamScore', { locale, a: scoreA, b: scoreB })}
    </ThemedText>
  </View>
);

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: GameColors.clashWritingTint,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GameColors.clashWritingTintBorder,
  },
  score: { fontSize: 14, fontWeight: '700', fontFamily: Fonts.sans },
});
