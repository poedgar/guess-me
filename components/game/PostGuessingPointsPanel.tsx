import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SuccessAnimation } from '@/components/ui/SuccessAnimation';
import { Fonts, GameColors } from '@/constants/theme';
import { Game, Participant, useGame } from '@/contexts/GameContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ShowFancyAlertFn } from './GameHeader';

interface Props {
  game: Game;
  isAdmin: boolean;
  user: { uid: string } | null;
  participantsByJoin: Participant[];
  joinIndexById: Record<string, number>;
  getDisplayName: (name: string) => string;
  showFancyAlert: ShowFancyAlertFn;
  showFaceMessage: (message: string, face?: string) => void;
  locale: string;
}

const PostGuessingPointsPanel: React.FC<Props> = ({
  game,
  isAdmin,
  user,
  participantsByJoin,
  joinIndexById,
  getDisplayName,
  showFancyAlert,
  showFaceMessage,
  locale,
}) => {
  const { playSound } = useSound();
  const { startPostGuessingPointPhase, awardPointsToPlayers } = useGame();

  const [selectedPlayersForPoints, setSelectedPlayersForPoints] = useState<Record<string, number>>({});
  const [isAwardingPoints, setIsAwardingPoints] = useState(false);

  const handleStartPostGuessingPointPhase = async () => {
    if (!isAdmin) return;
    try {
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startPostGuessingPointPhase();
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFaceMessage(
        'Post-guessing point phase started!', 
        <View style={{ padding: 16 }}><SuccessAnimation /></View>
      );
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error.message || 'Failed to start point phase');
    }
  };

  const handlePlayerSelectForPoints = (playerId: string, points: number) => {
    setSelectedPlayersForPoints(prev => {
      if (prev[playerId] === points) {
        const newSelection = { ...prev };
        delete newSelection[playerId];
        return newSelection;
      } else {
        return { ...prev, [playerId]: points };
      }
    });
  };

  const handleAwardPointsToPlayers = async () => {
    if (!game || !user || !isAdmin) return;
    try {
      setIsAwardingPoints(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const awards = Object.entries(selectedPlayersForPoints).map(([playerId, points]) => ({
        recipientId: playerId,
        points,
      }));

      if (awards.length === 0) {
        showFancyAlert(t('common.error', { locale }), 'Please select at least one player to award points to');
        return;
      }

      await awardPointsToPlayers(awards);
      await playSound('points');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFaceMessage(
        'Points awarded successfully!',
        <View style={{ padding: 16 }}><SuccessAnimation /></View>
      );
      setSelectedPlayersForPoints({});
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error?.message || 'Failed to award points');
    } finally {
      setIsAwardingPoints(false);
    }
  };

  // Admin fallback: show "Start Point Awards" button when target submitted guesses but phase not started
  if (isAdmin && game.currentRound?.targetUserId && game.guessingData?.playersWhoSubmittedGuesses?.includes(game.currentRound.targetUserId) && !game.postGuessingPointPhase) {
    return (
      <View style={styles.gameFlowContainer}>
        {/* Admin Target Control */}
        <TargetControlPanel
          locale={locale}
          showFancyAlert={showFancyAlert}
        />
        
        <View style={styles.roundInfo}>
          <ThemedText type="subtitle" style={styles.roundTitle}>
            Admin: Start Point Awards
          </ThemedText>
          <ThemedText style={styles.targetText}>
            Target has submitted guesses. Start the point awarding phase to award points.
          </ThemedText>
        </View>
        <View style={styles.adminControls}>
          <TouchableOpacity
            style={[
              styles.adminButton,
              {
                backgroundColor: GameColors.admin,
                shadowColor: '#000',
              },
            ]}
            onPress={handleStartPostGuessingPointPhase}
            activeOpacity={0.8}
          >
            <IconSymbol name="star.fill" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Post-Guessing Point Awards Phase
  if (!game.postGuessingPointPhase) return null;

  if (!isAdmin) return null;

  return (
    <View style={styles.gameFlowContainer}>
      <View style={styles.roundInfo}>
        <ThemedText type="subtitle" style={styles.roundTitle}>
          Award Points to Players
        </ThemedText>
        <ThemedText style={styles.targetText}>
          Select players and award points for their performance
        </ThemedText>
      </View>

      {game.playersWhoAwardedPostGuessPoints?.includes(user?.uid || '') ? (
        <View style={styles.guessResultsContainer}>
          <ThemedText type="subtitle" style={styles.guessResultsTitle}>
            Points Already Awarded
          </ThemedText>
          <View style={styles.guessResultCard}>
            <ThemedText style={styles.guessResultText}>
              You have already awarded points in this phase.
            </ThemedText>
            <ThemedText style={styles.guessResultDetail}>
              Wait for the next round to award points again.
            </ThemedText>
          </View>
        </View>
      ) : (
        <View style={styles.postGuessingPointsContainer}>
          <ThemedText style={styles.guessingInstructions}>
            Select any number of players and award them points. You can do this only once per round.
          </ThemedText>

          <ScrollView style={styles.playersSelectionScroll} nestedScrollEnabled>
            <View style={styles.playersSelectionList}>
              {game.participants
                .filter(p => p.userId !== user?.uid)
                .map((participant) => {
                  const isSelected = selectedPlayersForPoints[participant.userId] !== undefined;
                  const selectedPoints = selectedPlayersForPoints[participant.userId] || 0;

                  return (
                    <View key={participant.userId} style={styles.playerSelectionItem}>
                      <View style={styles.playerSelectionInfo}>
                        <ThemedText style={styles.playerSelectionName}>
                          {joinIndexById[participant.userId] ? `${joinIndexById[participant.userId]}. ` : ''}
                          {getDisplayName(participant.userName)}
                          {participant.userId === game.adminId && ' 👑'}
                        </ThemedText>
                        <ThemedText style={styles.playerSelectionEmail}>
                          {participant.userEmail}
                        </ThemedText>
                      </View>

                      <View style={styles.pointButtonsContainer}>
                        {[-3, -2, -1, 1, 2, 3].map(points => (
                          <TouchableOpacity
                            key={points}
                            style={[
                              styles.pointButton,
                              points < 0 && styles.pointButtonNegative,
                              isSelected && selectedPoints === points && (points < 0 ? styles.pointButtonNegativeSelected : styles.pointButtonSelected),
                            ]}
                            onPress={() => handlePlayerSelectForPoints(participant.userId, points)}
                            activeOpacity={0.8}
                          >
                            <ThemedText style={[
                              styles.pointButtonText,
                              points < 0 && { color: '#dc2626' },
                              isSelected && selectedPoints === points && styles.pointButtonTextSelected,
                            ]}>
                              {points}
                            </ThemedText>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                })}
            </View>
          </ScrollView>

          {Object.keys(selectedPlayersForPoints).length > 0 && (
            <TouchableOpacity
              style={[
                styles.submitGuessButton,
                {
                  backgroundColor: GameColors.green,
                  shadowColor: '#000',
                },
                isAwardingPoints && styles.buttonDisabled,
              ]}
              onPress={handleAwardPointsToPlayers}
              disabled={isAwardingPoints}
              activeOpacity={0.8}
            >
              {isAwardingPoints ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <IconSymbol name="star.fill" size={16} color="#fff" />
                  <ThemedText style={styles.buttonText}>
                    Award Points ({Object.values(selectedPlayersForPoints).reduce((sum, points) => sum + points, 0)} total)
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

export default PostGuessingPointsPanel;

const styles = StyleSheet.create({
  gameFlowContainer: { marginTop: 24, marginBottom: 24 },
  roundInfo: { marginBottom: 20, padding: 16, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)' },
  roundTitle: { marginBottom: 8, textAlign: 'center', fontFamily: Fonts.sans },
  targetText: { textAlign: 'center', fontSize: 18, fontWeight: '600', fontFamily: Fonts.sans },
  adminControls: { marginTop: 24 },
  adminButton: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12, paddingVertical: 16, paddingHorizontal: 16, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  guessResultsContainer: { marginTop: 16, alignItems: 'center' },
  guessResultsTitle: { marginBottom: 16, textAlign: 'center' },
  guessResultCard: { padding: 20, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)', alignItems: 'center', width: '100%' },
  guessResultText: { fontSize: 18, fontWeight: '600', textAlign: 'center', color: GameColors.green, marginBottom: 8 },
  guessResultDetail: { fontSize: 14, textAlign: 'center', opacity: 0.8 },
  postGuessingPointsContainer: { marginTop: 16 },
  guessingInstructions: { fontSize: 16, marginBottom: 20, lineHeight: 24, fontFamily: Fonts.sans },
  playersSelectionScroll: { maxHeight: 300, marginTop: 8 },
  playersSelectionList: { gap: 12 },
  playerSelectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginBottom: 8,
  },
  playerSelectionInfo: { flex: 1, marginRight: 16 },
  playerSelectionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  playerSelectionEmail: {
    fontSize: 14,
    opacity: 0.7,
  },
  pointButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  pointButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointButtonSelected: {
    backgroundColor: GameColors.green,
    borderColor: GameColors.green,
  },
  pointButtonNegative: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderColor: 'rgba(255, 0, 0, 0.3)',
  },
  pointButtonNegativeSelected: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  pointButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  pointButtonTextSelected: {
    color: '#fff',
  },
  submitGuessButton: { borderRadius: 999, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', alignSelf: 'center', flexDirection: 'row', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
});
