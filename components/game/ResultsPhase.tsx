import { ThemedText } from '@/components/themed-text';
import { Fonts } from '@/constants/theme';
import { Game } from '@/contexts/GameContext';
import { t } from '@/i18n';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

interface Props {
  game: Game;
  user: { uid: string } | null;
  joinIndexById: Record<string, number>;
  getDisplayName: (name: string) => string;
  locale: string;
}

export const ResultsPhase: React.FC<Props> = ({ game, user, joinIndexById, getDisplayName, locale }) => {
  return (
    <View style={styles.gameFlowContainer}>
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
          <View style={styles.scoresContainer}>
            <ThemedText type="subtitle" style={styles.scoresTitle}>
              {t('game.ui.finalLeaderboardTitle', { locale })}
            </ThemedText>
            {(() => {
              const participantsWithScores = game.participants
                .map(p => {
                  const gamePoints = game.scores?.[p.userId] || 0;
                  const guessPoints = game.guessResults?.[p.userId]?.correctGuesses || 0;
                  const totalPoints = gamePoints + guessPoints;
                  return { ...p, gamePoints, guessPoints, totalPoints };
                })
                .sort((a, b) => b.totalPoints - a.totalPoints);
              return (
                <ScrollView style={styles.leaderboardScroll} nestedScrollEnabled>
                  <View style={styles.leaderboard}>
                    {participantsWithScores.map((participant, index) => (
                      <View
                        key={participant.userId}
                        style={[
                          styles.leaderboardItem,
                          index === 0 && styles.leaderboardFirst,
                          participant.userId === user?.uid && styles.leaderboardCurrentUser,
                        ]}
                      >
                        <View style={styles.leaderboardRank}>
                          {index === 0 && <ThemedText style={styles.rankEmoji}>🥇</ThemedText>}
                          {index === 1 && <ThemedText style={styles.rankEmoji}>🥈</ThemedText>}
                          {index === 2 && <ThemedText style={styles.rankEmoji}>🥉</ThemedText>}
                          {index > 2 && <ThemedText style={styles.rankNumber}>#{index + 1}</ThemedText>}
                        </View>
                        <View style={styles.leaderboardInfo}>
                          <ThemedText style={styles.leaderboardName}>
                            {joinIndexById[participant.userId] ? `${joinIndexById[participant.userId]}. ` : ''}
                            {getDisplayName(participant.userName)}
                            {participant.userId === game.adminId && ' 👑'}
                            {participant.userId === user?.uid && ' (Ви)'}
                          </ThemedText>
                          <View style={styles.pointsRow}>
                            <ThemedText style={styles.pointsDetail}>Гра: {participant.gamePoints}</ThemedText>
                            <ThemedText style={styles.pointsDetail}>Вгадування: {participant.guessPoints}</ThemedText>
                          </View>
                        </View>
                        <View style={styles.leaderboardPoints}>
                          <ThemedText style={styles.pointsValue}>{participant.totalPoints}</ThemedText>
                          <ThemedText style={styles.pointsLabel}>всього</ThemedText>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              );
            })()}
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  gameFlowContainer: { marginTop: 24, marginBottom: 24 },
  finishedTitle: { textAlign: 'center', marginBottom: 12, fontFamily: Fonts.sans },
  finishedText: { textAlign: 'center', opacity: 0.7, fontSize: 16, fontFamily: Fonts.sans },
  scoresContainer: { marginBottom: 24, marginTop: 8 },
  scoresTitle: { marginBottom: 16, textAlign: 'center', fontFamily: Fonts.sans },
  leaderboard: { borderRadius: 8, overflow: 'hidden' },
  leaderboardItem: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)' },
  leaderboardFirst: { backgroundColor: 'rgba(255, 215, 0, 0.2)', borderWidth: 2, borderColor: 'rgba(255, 215, 0, 0.5)' },
  leaderboardCurrentUser: { backgroundColor: 'rgba(66, 133, 244, 0.15)', borderWidth: 1, borderColor: 'rgba(66, 133, 244, 0.3)' },
  leaderboardRank: { width: 40, alignItems: 'center', justifyContent: 'center' },
  rankEmoji: { fontSize: 24 },
  rankNumber: { fontSize: 14, fontWeight: '600', opacity: 0.6 },
  leaderboardInfo: { flex: 1, marginLeft: 12 },
  leaderboardName: { fontSize: 16, fontWeight: '600' },
  pointsRow: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap' },
  pointsDetail: { fontSize: 12, opacity: 0.8, marginRight: 8 },
  leaderboardPoints: { alignItems: 'flex-end' },
  pointsValue: { fontSize: 20, fontWeight: '700', color: '#4CAF50' },
  pointsLabel: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  leaderboardScroll: { maxHeight: 200, marginTop: 8 },
});
