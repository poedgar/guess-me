import { ThemedText } from '@/components/themed-text';
import { Fonts, GameColors } from '@/constants/theme';
import { gameStyles } from '../gameStyles';
import { Game } from '@/contexts/GameContext';
import { t } from '@/i18n';
import { calculateSimilarPairs } from '@/utils/playerSimilarity';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Leaderboard } from '../Leaderboard';

interface Props {
  game: Game;
  user: { uid: string } | null;
  joinIndexById: Record<string, number>;
  getDisplayName: (name: string) => string;
  locale: string;
}

export const ResultsPhase: React.FC<Props> = ({ game, user, joinIndexById, getDisplayName, locale }) => {
  const similarPairs = calculateSimilarPairs(
    game.rounds ?? [],
    game.adminAwards,
    game.participants ?? [],
    3,
  );

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
          <View style={styles.alignmentSection}>
            <ThemedText type="subtitle" style={styles.alignmentTitle}>
              {t('game.ui.mostAlignedTitle', { locale })}
            </ThemedText>
            <ThemedText style={styles.alignmentSubtitle}>
              {t('game.ui.mostAlignedSubtitle', { locale })}
            </ThemedText>
            {similarPairs.length === 0 ? (
              <ThemedText style={styles.noData}>
                {t('game.ui.notEnoughDataForAlignment', { locale })}
              </ThemedText>
            ) : (
              similarPairs.map((pair, idx) => (
                <View key={`${pair.userAId}-${pair.userBId}`} style={styles.pairCard}>
                  <View style={styles.pairRank}>
                    <ThemedText style={styles.pairRankText}>{idx + 1}</ThemedText>
                  </View>
                  <View style={styles.pairInfo}>
                    <ThemedText style={styles.pairNames}>
                      {t('game.ui.mostAlignedPair', { locale, a: getDisplayName(pair.userAName), b: getDisplayName(pair.userBName) })}
                    </ThemedText>
                    <ThemedText style={styles.pairMeta}>
                      {t('game.ui.mostAlignedDiff', { locale, diff: pair.averageDiff.toFixed(1) })}
                      {'  ·  '}
                      {t('game.ui.mostAlignedRatings', { locale, count: pair.commonRatings })}
                    </ThemedText>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  phaseWrapper: { backgroundColor: GameColors.resultsTint, borderWidth: 1, borderColor: GameColors.resultsTintBorder, borderRadius: 16, padding: 16, marginBottom: 8 },
  finishedTitle: { textAlign: 'center', marginBottom: 12, fontFamily: Fonts.sans },
  finishedText: { textAlign: 'center', opacity: 0.7, fontSize: 16, fontFamily: Fonts.sans },
  alignmentSection: { marginTop: 24 },
  alignmentTitle: { fontFamily: Fonts.sans, marginBottom: 4 },
  alignmentSubtitle: { opacity: 0.6, fontSize: 13, fontFamily: Fonts.sans, marginBottom: 12 },
  noData: { opacity: 0.5, fontSize: 14, fontFamily: Fonts.sans, textAlign: 'center', paddingVertical: 8 },
  pairCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: GameColors.cardBg, borderRadius: 10, padding: 12, marginBottom: 8, gap: 12 },
  pairRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: GameColors.green, alignItems: 'center', justifyContent: 'center' },
  pairRankText: { color: GameColors.white, fontSize: 13, fontWeight: '700', fontFamily: Fonts.sans },
  pairInfo: { flex: 1 },
  pairNames: { fontSize: 15, fontWeight: '600', fontFamily: Fonts.sans, marginBottom: 2 },
  pairMeta: { fontSize: 12, opacity: 0.6, fontFamily: Fonts.sans },
});
