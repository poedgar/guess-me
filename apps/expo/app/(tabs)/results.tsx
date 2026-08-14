import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HeaderLogo } from '@/components/ui/HeaderLogo';
import { IdeaLeaderboard } from '@/components/game/ideas/IdeaLeaderboard';
import { GameColors } from '@/constants/theme';
import type { Comment, Round } from '@/contexts/GameContext';
import { useGame } from '@/contexts/GameContext';
import { buildJoinIndexById, sortParticipantsByJoin } from '@/utils/participants';
import { toSafeDate } from '@/utils/dates';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/i18n';

export default function TabTwoScreen() {
  const { currentGame } = useGame();
  const { locale } = useLanguage();

  const participantsByJoin = sortParticipantsByJoin(currentGame?.participants || []);

  const joinIndexById = buildJoinIndexById(participantsByJoin);

  const displayedScores =
    currentGame?.status === 'finished'
      ? currentGame?.scores
      : (currentGame?.roundStartScores ?? currentGame?.scores);
  const displayedGuessResults =
    currentGame?.status === 'finished'
      ? currentGame?.guessResults
      : (currentGame?.roundStartGuessResults ?? currentGame?.guessResults);

  const participantsWithScores = (currentGame?.participants || []).map(p => {
    const gamePoints = displayedScores?.[p.userId] || 0;
    const guessPoints = displayedGuessResults?.[p.userId]?.correctGuesses || 0;
    return { ...p, gamePoints, guessPoints, totalPoints: gamePoints + guessPoints };
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <HeaderLogo />

      {/* Show no game message when no game exists */}
      {(!currentGame || currentGame.status == 'waiting') && (
        <View style={styles.noResultsContainer}>
          <ThemedText style={styles.noResultsTitle}>
            🎯 {t('results.noResultsTitle', { locale })}
          </ThemedText>
          <ThemedText style={styles.noResultsMessage}>
            {t('results.noResultsMessage', { locale })}
          </ThemedText>
        </View>
      )}

      {/* Show participants and leaderboard here when game is started */}
      {currentGame && currentGame.status !== 'waiting' && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          {currentGame.gameType === 'ideas' ? (
            <IdeaLeaderboard
              ideas={currentGame.ideaData?.ideas ?? []}
              locale={locale}
              title={`🏆 ${t('game.ui.ideas.finalLeaderboardTitle', { locale })}`}
              scrollHeight={260}
            />
          ) : (
            <>
              <ThemedText type="subtitle" style={{ marginTop: 16, marginBottom: 8 }}>
                🏆 {t('results.leaderboardTitle', { locale })}
              </ThemedText>

              <ScrollView style={styles.leaderboardScroll}>
                {participantsWithScores.map((p, idx) => (
                  <View key={p.userId} style={styles.leaderboardRow}>
                    <ThemedText style={styles.leaderboardName}>{idx < 3 ? ['🥇','🥈','🥉'][idx] : `#${idx+1}`} {joinIndexById[p.userId] ? `${joinIndexById[p.userId]}. ` : ''}{p.userName}</ThemedText>
                    <ThemedText style={styles.points}>
                      {p.totalPoints}
                      {p.guessPoints ? ` (${p.guessPoints})` : ''}
                    </ThemedText>
                  </View>
                ))}
              </ScrollView>
            </>
          )}

          {/* Round History */}
          {(() => {
            const allRounds = currentGame.rounds || [];
            const sortedRounds = [...allRounds].sort((a, b) => a.roundNumber - b.roundNumber);
            const completedRounds = sortedRounds.filter(
              (round) => round.commentsVisible && round.pointsGiven
            );
            return completedRounds.length > 0 ? (
              <View style={styles.roundHistoryContainer}>
                <ThemedText type="subtitle" style={styles.roundHistoryTitle}>
                  📜 {t('results.roundHistoryTitle', { locale })} ({completedRounds.length})
                </ThemedText>
                {completedRounds.map((round: Round) => (
                  <View key={round.roundNumber} style={styles.roundHistoryItem}>
                    <View style={styles.roundHistoryHeader}>
                      <ThemedText style={styles.roundHistoryRoundNumber}>
                        {t('results.round', { locale })} {round.roundNumber}
                      </ThemedText>
                      <ThemedText style={styles.roundHistoryTarget}>
                        {t('results.target', { locale })}: {round && joinIndexById[round.targetUserId] ? `${joinIndexById[round.targetUserId]}. ` : ''}{round.targetUserName}
                      </ThemedText>
                      {(() => {
                        const targetPoints = round.targetPointsGivenBy?.length ?? 0;
                        return (
                          <ThemedText style={styles.roundHistoryTargetPoints}>
                                {t('results.targetPoints', { locale })}: +{targetPoints}
                              </ThemedText>
                        );
                      })()}
                    </View>
                    <View style={styles.roundHistoryComments}>
                      <ThemedText style={styles.roundHistoryCommentsTitle}>
                        {t('results.comments', { locale })} ({round.comments?.length || 0}):
                      </ThemedText>
                      {round.comments && round.comments.length > 0 ? (
                        round.comments.map((comment: Comment) => (
                          <View key={comment.id} style={styles.roundHistoryComment}>
                            <ThemedText style={styles.roundHistoryCommentText}>
                              "{comment.text}"
                            </ThemedText>
                            {comment.points !== undefined && (
                              <View style={styles.roundHistoryCommentPoints}>
                                <ThemedText style={[
                                  styles.roundHistoryPointsValue,
                                  comment.points < 0 && styles.roundHistoryPointsValueNegative
                                ]}>
                                  {comment.points > 0 ? '+' : ''}{comment.points} pts
                                </ThemedText>
                              </View>
                            )}
                          </View>
                        ))
                      ) : (
                        <ThemedText style={styles.noCommentsText}>{t('results.noComments', { locale })}</ThemedText>
                      )}

                      {/* Admin Awards Section */}
                      {currentGame?.adminAwards && Object.keys(currentGame.adminAwards).length > 0 && (() => {
                        const allAdminAwards = Object.entries(currentGame.adminAwards)
                          .flatMap(([awarderId, awards]) => 
                            awards.map(award => ({ ...award, awarderName: participantsByJoin.find(p => p.userId === awarderId)?.userName || 'Unknown' }))
                          );
                        
                        const roundAwards = allAdminAwards.filter(award => {
                          // Check if this award was given during this round (approximate by checking if award time is after round started)
                          return toSafeDate(award.awardedAt) >= toSafeDate(round.startedAt);
                        });
                        
                        return roundAwards.length > 0 ? (
                          <View style={styles.adminAwardsSection}>
                            <ThemedText style={styles.adminAwardsTitle}>
                              {t('results.adminAwardsTitle', { locale, count: roundAwards.length })}
                            </ThemedText>
                            {roundAwards.map((award, index) => (
                              <View key={index} style={styles.adminAwardItem}>
                                <ThemedText style={styles.adminAwardText}>
                                  {t('results.adminAwardText', { locale, awarder: award.awarderName, recipient: participantsByJoin.find((p: any) => p.userId === award.recipientId)?.userName || t('common.unknown', { locale }) })}
                                  <ThemedText style={[
                                    styles.adminAwardPoints,
                                    award.points < 0 && styles.adminAwardPointsNegative
                                  ]}>
                                    {' '}{award.points > 0 ? '+' : ''}{award.points} pts
                                  </ThemedText>
                                </ThemedText>
                              </View>
                            ))}
                          </View>
                        ) : null;
                      })()}
                    </View>
                  </View>
                ))}
              </View>
            ) : null;
          })()}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  headerImage: {
    color: GameColors.neutral,
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  userContainer: {
    padding: 16,
    marginVertical: 12,
    borderRadius: 8,
    backgroundColor: GameColors.lightPageBg,
  },
  button: {
    backgroundColor: GameColors.blue,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 12,
  },
  buttonText: {
    color: GameColors.white,
    fontWeight: 'bold',
  },
  participantsScroll: { maxHeight: 260 },
  participantRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: GameColors.cardBg },
  participantName: { fontSize: 16, fontWeight: '600' },
  leaderboardScroll: { maxHeight: 260 },
  leaderboardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: GameColors.cardBg },
  leaderboardName: { fontSize: 16, fontWeight: '600' },
  points: { fontSize: 16, fontWeight: '700', color: GameColors.green },
  // Round History styles
  roundHistoryContainer: { marginBottom: 24, marginTop: 8 },
  roundHistoryTitle: { marginBottom: 16, textAlign: 'center' },
  roundHistoryItem: { marginBottom: 20, padding: 16, borderRadius: 8, backgroundColor: GameColors.cardBg, borderWidth: 1, borderColor: GameColors.cardBorder },
  roundHistoryHeader: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: GameColors.cardBorder },
  roundHistoryRoundNumber: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  roundHistoryTarget: { fontSize: 16, opacity: 0.7 },
  roundHistoryTargetPoints: { marginTop: 6, fontSize: 14, fontWeight: '700', color: GameColors.green },
  roundHistoryComments: { marginTop: 8 },
  roundHistoryCommentsTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, opacity: 0.8 },
  roundHistoryComment: { padding: 12, marginBottom: 8, borderRadius: 6, backgroundColor: 'rgba(255, 255, 255, 0.5)' },
  roundHistoryCommentText: { fontSize: 14, lineHeight: 20, marginBottom: 8, fontStyle: 'italic' },
  roundHistoryCommentPoints: { alignSelf: 'flex-end' },
  roundHistoryPointsValue: { fontSize: 14, fontWeight: '600', color: GameColors.green },
  roundHistoryPointsValueNegative: { color: GameColors.negative },
  // Admin Awards styles
  adminAwardsSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: GameColors.cardBorder },
  adminAwardsTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, opacity: 0.8 },
  adminAwardItem: { padding: 8, marginBottom: 4, borderRadius: 4, backgroundColor: GameColors.goldTint },
  adminAwardText: { fontSize: 13, lineHeight: 18 },
  adminAwardPoints: { fontSize: 13, fontWeight: '700', color: GameColors.green },
  adminAwardPointsNegative: { color: GameColors.negative },
  noCommentsText: { textAlign: 'center', opacity: 0.5, fontSize: 14, fontStyle: 'italic', padding: 8 },
  // No results styles
  noResultsContainer: { 
    alignItems: 'center', 
    padding: 40, 
    marginTop: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GameColors.cardBorder
  },
  noResultsTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
    color: GameColors.textMedium
  },
  noResultsMessage: { 
    fontSize: 16, 
    textAlign: 'center', 
    lineHeight: 24,
    color: GameColors.neutral,
    maxWidth: 300
  },
});
