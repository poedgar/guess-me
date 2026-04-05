import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts, GameColors, StatusColors } from '@/constants/theme';
import { Game, Participant, useGame } from '@/contexts/GameContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ShowFancyAlertFn } from './GameHeader';

interface Props {
  game: Game;
  isAdmin: boolean;
  user: { uid: string } | null;
  participantsByJoin: Participant[];
  joinIndexById: Record<string, number>;
  getDisplayName: (name: string) => string;
  showFancyAlert: ShowFancyAlertFn;
  locale: string;
  isDark: boolean;
  onCopyGameId: () => void;
}

export const WaitingPhase: React.FC<Props> = ({
  game,
  isAdmin,
  user,
  participantsByJoin,
  joinIndexById,
  getDisplayName,
  showFancyAlert,
  locale,
  isDark,
  onCopyGameId,
}) => {
  const { playSound } = useSound();
  const { loading, startGame, updateAdminWritesComments, updateShowSurnames, updateTargetSelectionMode, updateShowGuessResults } = useGame();

  const toggleAnimation = useRef(new Animated.Value(0)).current;
  const surnamesToggleAnimation = useRef(new Animated.Value(0)).current;
  const targetSelectionModeAnimation = useRef(new Animated.Value(0)).current;
  const showGuessResultsAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(toggleAnimation, {
      toValue: game.adminWritesComments ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [game.adminWritesComments]);

  useEffect(() => {
    Animated.timing(surnamesToggleAnimation, {
      toValue: game.showSurnames ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [game.showSurnames]);

  useEffect(() => {
    Animated.timing(targetSelectionModeAnimation, {
      toValue: game.targetSelectionMode === 'chronological' ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [game.targetSelectionMode]);

  useEffect(() => {
    Animated.timing(showGuessResultsAnimation, {
      toValue: game.showGuessResults ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [game.showGuessResults]);

  const makeSettingToggler = <T,>(
    getNewValue: () => T,
    updater: (v: T) => Promise<void>,
    getSuccessMessage?: (newValue: T) => string | undefined
  ) => async () => {
    try {
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newValue = getNewValue();
      await updater(newValue);
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const msg = getSuccessMessage?.(newValue);
      if (msg) showFancyAlert(t('common.success', { locale }), msg);
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.updateSettingsFailed', { locale }));
    }
  };

  const handleToggleAdminComments = makeSettingToggler(
    () => !game.adminWritesComments,
    updateAdminWritesComments
  );

  const handleToggleShowSurnames = makeSettingToggler(
    () => !game.showSurnames,
    updateShowSurnames
  );

  const handleToggleTargetSelectionMode = makeSettingToggler(
    () => (game.targetSelectionMode === 'random' ? 'chronological' : 'random') as 'random' | 'chronological',
    updateTargetSelectionMode
  );

  const handleToggleShowGuessResults = makeSettingToggler(
    () => !game.showGuessResults,
    updateShowGuessResults,
    (newValue) =>
      newValue
        ? t('game.alerts.showGuessResultsEnabled', { locale })
        : t('game.alerts.showGuessResultsDisabled', { locale })
  );

  const handleStartGame = async () => {
    try {
      await playSound('gameStart');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startGame();
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.startGameFailed', { locale }));
    }
  };

  const totalTargets = game.participants?.filter(p => p.userId !== game.adminId).length ?? 0;

  return (
    <>
      {/* Game ID + QR */}
      <View style={{ display: 'flex', flexDirection: 'row' }}>
        <View style={styles.gameIdContainer}>
          <ThemedText type="subtitle" style={styles.gameIdLabel}>
            {t('game.ui.gameIdLabel', { locale })}
          </ThemedText>
          <TouchableOpacity
            onPress={onCopyGameId}
            style={styles.gameIdBox}
          >
            <ThemedText style={styles.gameIdText}>{game.id}</ThemedText>
            <ThemedText style={styles.copyHint}>{t('game.ui.tapToCopy', { locale })}</ThemedText>
          </TouchableOpacity>
        </View>
        {isAdmin && (
          <View style={styles.qrCodeContainer}>
            <View style={[
              styles.qrCodeBox,
              isDark && styles.qrCodeBoxDark
            ]}>
              <QRCode
                value={game.id}
                size={75}
                color={isDark ? '#fff' : '#000'}
                backgroundColor={isDark ? GameColors.inputDark : '#fff'}
              />
            </View>
          </View>
        )}
      </View>

      {/* Status */}
      <View style={styles.gameStatusContainer}>
        <ThemedText style={styles.statusLabel}>{t('game.ui.statusLabel', { locale })}</ThemedText>
        <View style={[styles.statusBadge, { backgroundColor: StatusColors.waiting }]}>
          <ThemedText style={styles.statusText}>
            {t('game.ui.statusWaiting', { locale })}
          </ThemedText>
        </View>
      </View>

      {/* Admin Settings Toggles */}
      {isAdmin && (
        <>
          <View style={styles.toggleContainer}>
            <View style={styles.toggleInfo}>
              <ThemedText style={styles.toggleLabel}>
                {t('game.ui.adminWritesCommentsTitle', { locale })}
              </ThemedText>
              <ThemedText style={styles.toggleDescription}>
                {t('game.ui.adminWritesCommentsDescription', { locale })}
              </ThemedText>
            </View>
            <TouchableOpacity
              style={[styles.toggleButton, game.adminWritesComments && styles.toggleButtonActive]}
              onPress={handleToggleAdminComments}
              activeOpacity={0.8}
            >
              <Animated.View style={[
                styles.toggleThumb,
                game.adminWritesComments ? styles.toggleThumbActive : {},
                {
                  transform: [{
                    translateX: toggleAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 20],
                    })
                  }]
                }
              ] as any} />
            </TouchableOpacity>
          </View>

          <View style={styles.toggleContainer}>
            <View style={styles.toggleInfo}>
              <ThemedText style={styles.toggleLabel}>
                {t('game.ui.showSurnamesTitle', { locale })}
              </ThemedText>
              <ThemedText style={styles.toggleDescription}>
                {t('game.ui.showSurnamesDescription', { locale })}
              </ThemedText>
            </View>
            <TouchableOpacity
              style={[styles.toggleButton, game.showSurnames && styles.toggleButtonActive]}
              onPress={handleToggleShowSurnames}
              activeOpacity={0.8}
            >
              <Animated.View style={[
                styles.toggleThumb,
                game.showSurnames ? styles.toggleThumbActive : {},
                {
                  transform: [{
                    translateX: surnamesToggleAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 20],
                    })
                  }]
                }
              ] as any} />
            </TouchableOpacity>
          </View>

          <View style={styles.toggleContainer}>
            <View style={styles.toggleInfo}>
              <ThemedText style={styles.toggleLabel}>
                {t('game.ui.targetSelectionModeTitle', { locale })}
              </ThemedText>
              <ThemedText style={styles.toggleDescription}>
                {t('game.ui.targetSelectionModeDescription', { locale })}
              </ThemedText>
            </View>
            <TouchableOpacity
              style={[styles.toggleButton, game.targetSelectionMode === 'chronological' && styles.toggleButtonActive]}
              onPress={handleToggleTargetSelectionMode}
              activeOpacity={0.8}
            >
              <Animated.View style={[
                styles.toggleThumb,
                game.targetSelectionMode === 'chronological' ? styles.toggleThumbActive : {},
                {
                  transform: [{
                    translateX: targetSelectionModeAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 20],
                    })
                  }]
                }
              ] as any} />
            </TouchableOpacity>
          </View>

          <View style={styles.toggleContainer}>
            <View style={styles.toggleInfo}>
              <ThemedText style={styles.toggleLabel}>
                {t('game.ui.showGuessResultsTitle', { locale })}
              </ThemedText>
              <ThemedText style={styles.toggleDescription}>
                {t('game.ui.showGuessResultsDescription', { locale })}
              </ThemedText>
            </View>
            <TouchableOpacity
              style={[styles.toggleButton, game.showGuessResults && styles.toggleButtonActive]}
              onPress={handleToggleShowGuessResults}
              activeOpacity={0.8}
            >
              <Animated.View style={[
                styles.toggleThumb,
                game.showGuessResults ? styles.toggleThumbActive : {},
                {
                  transform: [{
                    translateX: showGuessResultsAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 20],
                    })
                  }]
                }
              ] as any} />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Participants list */}
      <View style={styles.participantsContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <ThemedText type="subtitle" style={styles.participantsTitle}>
            {t('game.ui.participants', { locale })} ({game.participants?.length || 0})
          </ThemedText>
        </View>
        <ScrollView style={styles.participantsScroll} nestedScrollEnabled>
          {participantsByJoin.map((participant: Participant, idx: number) => (
            <View
              key={participant.userId}
              style={[
                styles.participantItem,
                participant.userId === game.adminId && styles.adminParticipant,
              ]}
            >
              <View style={styles.participantInfo}>
                <ThemedText style={styles.participantName}>
                  {`${idx + 1}. `}{getDisplayName(participant.userName)}
                  {participant.userId === game.adminId && ' 👑'}
                </ThemedText>
                <ThemedText style={styles.participantEmail}>
                  {participant.userEmail}
                </ThemedText>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Leaderboard (if scores exist) */}
      {game.scores && (
        <View style={styles.scoresContainer}>
          <ThemedText type="subtitle" style={styles.scoresTitle}>
            {t('game.ui.leaderboardTitle', { locale })}
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
                        {index > 2 && (
                          <ThemedText style={styles.rankNumber}>#{index + 1}</ThemedText>
                        )}
                      </View>
                      <View style={styles.leaderboardInfo}>
                        <ThemedText style={styles.leaderboardName}>
                          {joinIndexById[participant.userId] ? `${joinIndexById[participant.userId]}. ` : `${getDisplayName(participant.userName)}`}
                          {participant.userId === game.adminId && ' 👑'}
                          {participant.userId === user?.uid && ` ${t('game.ui.youLabel', { locale })}`}
                        </ThemedText>
                        <View style={styles.pointsRow}>
                          <ThemedText style={styles.pointsDetail}>
                            {t('game.ui.pointsGame', { locale })}: {participant.gamePoints}
                          </ThemedText>
                          <ThemedText style={styles.pointsDetail}>
                            {t('game.ui.pointsGuessing', { locale })}: {participant.guessPoints}
                          </ThemedText>
                        </View>
                      </View>
                      <View style={styles.leaderboardPoints}>
                        <ThemedText style={styles.pointsValue}>
                          {participant.totalPoints}
                        </ThemedText>
                        <ThemedText style={styles.pointsLabel}>{t('game.ui.pointsTotal', { locale })}</ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            );
          })()}
        </View>
      )}

      {/* Start Game / Waiting */}
      <View style={styles.gameFlowContainer}>
        {isAdmin && (
          <TouchableOpacity
            style={[
              styles.startGameButton,
              {
                backgroundColor: GameColors.green,
                shadowColor: '#000',
              },
              (loading || game.participants.length < 2) && styles.buttonDisabled,
            ]}
            onPress={handleStartGame}
            disabled={loading || game.participants.length < 2}
            activeOpacity={0.8}
          >
            <IconSymbol name="arrow.right.circle.fill" size={16} color="#fff" />
          </TouchableOpacity>
        )}
        {!isAdmin && (
          <ThemedText style={styles.waitingText}>
            {t('game.ui.waitingForAdminStart', { locale })}
          </ThemedText>
        )}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  gameIdContainer: { marginBottom: 20 },
  gameIdLabel: { marginBottom: 8, opacity: 0.7 },
  gameIdBox: { backgroundColor: 'rgba(52, 199, 89, 0.1)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(52, 199, 89, 0.3)' },
  gameIdText: { fontSize: 14, fontWeight: '700', fontFamily: 'monospace', marginBottom: 4 },
  copyHint: { fontSize: 10, opacity: 0.6 },
  qrCodeContainer: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  qrCodeBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  qrCodeBoxDark: {
    backgroundColor: '#333',
  },
  gameStatusContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  statusLabel: { marginRight: 12, fontSize: 16, fontFamily: Fonts.sans },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: 16, backgroundColor: 'rgba(0, 0, 0, 0.05)', borderRadius: 8 },
  toggleInfo: { flex: 1, marginRight: 16 },
  toggleLabel: { fontSize: 16, fontWeight: '600', marginBottom: 4, fontFamily: Fonts.sans },
  toggleDescription: { fontSize: 14, opacity: 0.7, lineHeight: 20, fontFamily: Fonts.sans },
  toggleButton: { width: 51, height: 31, borderRadius: 15.5, backgroundColor: '#767577', padding: 2, position: 'relative' },
  toggleButtonActive: { backgroundColor: GameColors.green },
  toggleThumb: { width: 27, height: 27, borderRadius: 13.5, backgroundColor: '#f4f3f4', position: 'absolute', top: 2, left: 2 },
  toggleThumbActive: { backgroundColor: '#fff' },
  participantsContainer: { marginBottom: 24 },
  participantsTitle: { marginBottom: 12, fontFamily: Fonts.sans },
  participantItem: { padding: 12, borderRadius: 8, marginBottom: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)' },
  adminParticipant: { backgroundColor: 'rgba(255, 149, 0, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 149, 0, 0.3)' },
  participantInfo: { flex: 1 },
  participantName: { fontSize: 16, fontWeight: '600', marginBottom: 4, fontFamily: Fonts.sans },
  participantEmail: { fontSize: 14, opacity: 0.7, fontFamily: Fonts.sans },
  participantsScroll: { maxHeight: 160, marginTop: 8 },
  scoresContainer: { marginBottom: 24, marginTop: 8 },
  scoresTitle: { marginBottom: 16, textAlign: 'center', fontFamily: Fonts.sans },
  leaderboard: { borderRadius: 8, overflow: 'hidden' },
  leaderboardItem: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)' },
  leaderboardFirst: { backgroundColor: 'rgba(255, 215, 0, 0.2)', borderWidth: 2, borderColor: 'rgba(255, 215, 0, 0.5)' },
  leaderboardCurrentUser: { backgroundColor: 'rgba(0, 122, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(0, 122, 255, 0.3)' },
  leaderboardRank: { width: 40, alignItems: 'center', justifyContent: 'center' },
  rankEmoji: { fontSize: 24 },
  rankNumber: { fontSize: 14, fontWeight: '600', opacity: 0.6 },
  leaderboardInfo: { flex: 1, marginLeft: 12 },
  leaderboardName: { fontSize: 16, fontWeight: '600' },
  pointsRow: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap' },
  pointsDetail: { fontSize: 12, opacity: 0.8, marginRight: 8 },
  leaderboardPoints: { alignItems: 'flex-end' },
  pointsValue: { fontSize: 20, fontWeight: '700', color: GameColors.green },
  pointsLabel: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  leaderboardScroll: { maxHeight: 200, marginTop: 8 },
  gameFlowContainer: { marginTop: 24, marginBottom: 24 },
  startGameButton: { borderRadius: 999, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  buttonDisabled: { opacity: 0.6 },
  waitingText: { textAlign: 'center', opacity: 0.7, fontSize: 16, marginVertical: 16, fontFamily: Fonts.sans },
});
