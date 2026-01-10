import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { Participant, useGame } from '@/contexts/GameContext';

export default function TabTwoScreen() {
  const { currentGame } = useGame();

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
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="chevron.left.forwardslash.chevron.right"
          style={styles.headerImage}
        />
      }>

      {/* Show participants and leaderboard here when game is started */}
      {currentGame && currentGame.status !== 'waiting' && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <ThemedText type="subtitle" style={{ marginTop: 16, marginBottom: 8 }}>
            🏆 Таблиця лідерів
          </ThemedText>
          <ScrollView style={styles.leaderboardScroll}>
            {participantsWithScores.map((p, idx) => (
              <View key={p.userId} style={styles.leaderboardRow}>
                <ThemedText style={styles.leaderboardName}>{idx < 3 ? ['🥇','🥈','🥉'][idx] : `#${idx+1}`} {joinIndexById[p.userId] ? `${joinIndexById[p.userId]}. ` : ''}{p.userName}</ThemedText>
                <ThemedText style={styles.points}>{p.totalPoints}</ThemedText>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
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
});
