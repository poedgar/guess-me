import { ThemedText } from '@/components/themed-text';
import { Fonts, GameColors } from '@/constants/theme';
import { gameStyles } from './gameStyles';
import { Game } from '@/contexts/GameContext';
import { t } from '@/i18n';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Leaderboard } from './Leaderboard';

interface Props {
  game: Game;
  user: { uid: string } | null;
  joinIndexById: Record<string, number>;
  getDisplayName: (name: string) => string;
  locale: string;
}

export const ResultsPhase: React.FC<Props> = ({ game, user, joinIndexById, getDisplayName, locale }) => {
  return (
    <View style={[gameStyles.gameFlowContainer, styles.phaseWrapper]}>
      {game.adminLeft ? (
        <>
          <ThemedText type="title" style={styles.finishedTitle}>
            {t('game.ui.adminLeftTitle', { locale })}
          </ThemedText>
          <ThemedText style={styles.finishedText}>
            {t('game.ui.adminLeftMessage', { locale })}
          </ThemedText>
        </>
      ) : (
        <>
          <ThemedText type="title" style={styles.finishedTitle}>
            {t('game.ui.gameFinishedTitle', { locale })}
          </ThemedText>
          <ThemedText style={styles.finishedText}>
            {t('game.ui.gameFinishedMessage', { locale })}
          </ThemedText>
          <Leaderboard
            game={game}
            user={user}
            joinIndexById={joinIndexById}
            getDisplayName={getDisplayName}
            locale={locale}
            title={t('game.ui.finalLeaderboardTitle', { locale })}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  phaseWrapper: { backgroundColor: GameColors.resultsTint, borderWidth: 1, borderColor: GameColors.resultsTintBorder, borderRadius: 16, padding: 16, marginBottom: 8 },
  finishedTitle: { textAlign: 'center', marginBottom: 12, fontFamily: Fonts.sans },
  finishedText: { textAlign: 'center', opacity: 0.7, fontSize: 16, fontFamily: Fonts.sans },
});
