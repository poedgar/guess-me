safe to I what do I import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { Comment, Round } from '@/contexts/GameContext';
import { Participant, useGame } from '@/contexts/GameContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/i18n';
import { Image as ExpoImage } from 'expo-image';
import { Platform } from 'react-native';

const HEADER_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><defs><linearGradient id="mysteryGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6a11cb;stop-opacity:1" /><stop offset="100%" style="stop-color:#2575fc;stop-opacity:1" /></linearGradient></defs><g transform="translate(512 512) scale(5) translate(0 -70)"><path d="M-25,-20 C-45,-20 -60,-5 -60,20 C-60,45 -40,55 -25,70 C-15,80 -5,95 0,110" fill="none" stroke="url(#mysteryGradient)" stroke-width="16" stroke-linecap="round"/><path d="M-25,-20 C-5,-20 25,-15 40,5 C55,25 50,50 30,70 C15,85 -10,95 -15,120" fill="none" stroke="url(#mysteryGradient)" stroke-width="16" stroke-linecap="round"/><circle cx="0" cy="155" r="12" fill="url(#mysteryGradient)"/></g></svg>`;

function HeaderLogo() {
  const source =
    Platform.OS === 'web'
      ? { uri: `data:image/svg+xml;utf8,${encodeURIComponent(HEADER_LOGO_SVG)}` }
      : require('../../assets/images/icon.png');

  return (
    <View style={styles.headerLogoContainer}>
      <ExpoImage 
        source={source} 
        style={styles.headerLogo} 
        contentFit="contain" 
      />
    </View>
  );
}

export default function TabTwoScreen() {
  const { currentGame } = useGame();
  const { locale } = useLanguage();

  const participantsByJoin = (currentGame?.participants || [])
    .slice()
    .sort((a: Participant, b: Participant) => (a.joinedAt || 0) - (b.joinedAt || 0));

  const joinIndexById: Record<string, number> = {};
  participantsByJoin.forEach((p, i) => (joinIndexById[p.userId] = i + 1));

  const participantsWithScores = (currentGame?.participants || []).map(p => {
    const gamePoints = currentGame?.scores?.[p.userId] || 0;
    const guessPoints = currentGame?.guessResults?.[p.userId]?.correctGuesses || 0;
    return { ...p, gamePoints, guessPoints, totalPoints: gamePoints + guessPoints };
  }).sort((a, b) => b.totalPoints - a.totalPoints);
  
  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <HeaderLogo />

      {/* Show participants and leaderboard here when game is started */}
      {currentGame && currentGame.status !== 'waiting' && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <ThemedText type="subtitle" style={{ marginTop: 16, marginBottom: 8 }}>
            🏆 {t('results.leaderboardTitle', { locale })}
          </ThemedText>
          <ScrollView style={styles.leaderboardScroll}>
            {participantsWithScores.map((p, idx) => (
              <View key={p.userId} style={styles.leaderboardRow}>
                <ThemedText style={styles.leaderboardName}>{idx < 3 ? ['🥇','🥈','🥉'][idx] : `#${idx+1}`} {joinIndexById[p.userId] ? `${joinIndexById[p.userId]}. ` : ''}{p.userName}</ThemedText>
                <ThemedText style={styles.points}>{p.totalPoints}</ThemedText>
              </View>
            ))}
          </ScrollView>
          
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
                                <ThemedText style={styles.roundHistoryPointsValue}>
                                  +{comment.points} pts
                                </ThemedText>
                              </View>
                            )}
                          </View>
                        ))
                      ) : (
                        <ThemedText style={styles.noCommentsText}>{t('results.noComments', { locale })}</ThemedText>
                      )}
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
  headerLogoContainer: { 
    height: 60, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  headerLogo: {
    width: 40,
    height: 40,
  },
  headerImage: {
    color: '#808080',
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
    backgroundColor: '#f0f0f0',
  },
  button: {
    backgroundColor: '#4285F4',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  participantsScroll: { maxHeight: 260 },
  participantRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  participantName: { fontSize: 16, fontWeight: '600' },
  leaderboardScroll: { maxHeight: 260 },
  leaderboardRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  leaderboardName: { fontSize: 16, fontWeight: '600' },
  points: { fontSize: 16, fontWeight: '700', color: '#4CAF50' },
  // Round History styles
  roundHistoryContainer: { marginBottom: 24, marginTop: 8 },
  roundHistoryTitle: { marginBottom: 16, textAlign: 'center' },
  roundHistoryItem: { marginBottom: 20, padding: 16, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)', borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.1)' },
  roundHistoryHeader: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 0, 0, 0.1)' },
  roundHistoryRoundNumber: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  roundHistoryTarget: { fontSize: 16, opacity: 0.7 },
  roundHistoryTargetPoints: { marginTop: 6, fontSize: 14, fontWeight: '700', color: '#4CAF50' },
  roundHistoryComments: { marginTop: 8 },
  roundHistoryCommentsTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, opacity: 0.8 },
  roundHistoryComment: { padding: 12, marginBottom: 8, borderRadius: 6, backgroundColor: 'rgba(255, 255, 255, 0.5)' },
  roundHistoryCommentText: { fontSize: 14, lineHeight: 20, marginBottom: 8, fontStyle: 'italic' },
  roundHistoryCommentPoints: { alignSelf: 'flex-end' },
  roundHistoryPointsValue: { fontSize: 14, fontWeight: '600', color: '#4CAF50' },
  noCommentsText: { textAlign: 'center', opacity: 0.5, fontSize: 14, fontStyle: 'italic', padding: 8 },
});
