import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PlayerAvatar } from '@/components/ui/PlayerAvatar';
import { TargetControlPanel } from '@/components/ui/TargetControlPanel';
import { ClashSetupPanel } from '@/components/game/clash/ClashSetupPanel';
import { Fonts, GameColors, StatusColors } from '@/constants/theme';
import { Game, Participant, useGame } from '@/contexts/GameContext';
import { gameStyles } from '../gameStyles';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Leaderboard } from '../Leaderboard';
import { ShowFancyAlertFn } from '../GameHeader';
import { ScrollIntoView } from 'react-native-scroll-into-view';
import { SCROLL_INSETS } from '@/constants/scroll';
import { usePulseBorderOnChange } from '@/hooks/usePulseBorderOnChange';

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
  const { loading, startGame, startBasketGame, startClashGame, startIdeaGame, updateAdminWritesComments, updateShowSurnames, updateTargetSelectionMode, updateShowGuessResults, updateIdeaIncognitoMode, setGameType } = useGame();

  const [isCopied, setIsCopied] = useState(false);
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const clashSetupPulse = usePulseBorderOnChange(`clashSetup:${game.gameType}`, GameColors.admin);
  const waitingPulse = usePulseBorderOnChange(`${isAdmin}:${game.gameType ?? 'mirror'}`, GameColors.admin);

  const handleCopyGameId = async () => {
    await onCopyGameId();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  const prevParticipantCount = useRef(game.participants.length);
  useEffect(() => {
    const prev = prevParticipantCount.current;
    prevParticipantCount.current = game.participants.length;
    if (isAdmin && prev < 2 && game.participants.length >= 2) {
      playSound('notification').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [game.participants.length]);

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
    } catch (error: unknown) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.updateSettingsFailed', { locale }));
    }
  };

  const handleToggleAdminComments = makeSettingToggler(
    () => !(game.adminWritesComments ?? false),
    updateAdminWritesComments
  );

  const handleToggleShowSurnames = makeSettingToggler(
    () => !(game.showSurnames ?? false),
    updateShowSurnames
  );

  const handleToggleTargetSelectionMode = makeSettingToggler(
    () => ((game.targetSelectionMode ?? 'random') === 'random' ? 'chronological' : 'random') as 'random' | 'chronological',
    updateTargetSelectionMode
  );

  const handleToggleShowGuessResults = makeSettingToggler(
    () => !(game.showGuessResults ?? false),
    updateShowGuessResults
  );

  const handleToggleIdeaIncognitoMode = makeSettingToggler(
    () => !(game.ideaIncognitoMode ?? true),
    updateIdeaIncognitoMode
  );

  const handleStartGame = async () => {
    if (isMounted.current === false) return;
    try {
      await playSound('gameStart');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (game.gameType === 'basket') {
        await startBasketGame();
      } else if (game.gameType === 'clash') {
        await startClashGame();
      } else if (game.gameType === 'ideas') {
        await startIdeaGame();
      } else {
        await startGame();
      }
      playSound('success').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error: unknown) {
      if (!isMounted.current) return;
      playSound('error').catch(() => {});
      showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.startGameFailed', { locale }));
    }
  };

  const totalTargets = game.participants?.filter(p => p.userId !== game.adminId).length ?? 0;

  return (
    <View style={styles.phaseWrapper}>
      {/* Game ID + QR */}
      <View style={{ display: 'flex', flexDirection: 'row' }}>
        <View style={styles.gameIdContainer}>
          <ThemedText type="subtitle" style={styles.gameIdLabel}>
            {t('game.ui.gameIdLabel', { locale })}
          </ThemedText>
          <TouchableOpacity
            onPress={handleCopyGameId}
            disabled={isCopied}
            style={styles.gameIdBox}
            accessibilityLabel={t('game.alerts.copyId', { locale })}
            accessibilityRole="button"
          >
            <ThemedText style={styles.gameIdText}>{game.id}</ThemedText>
            {isCopied
              ? <IconSymbol name="checkmark.circle.fill" size={14} color={GameColors.green} />
              : <ThemedText style={styles.copyHint}>{t('game.ui.tapToCopy', { locale })}</ThemedText>
            }
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
                color={isDark ? GameColors.white : GameColors.shadow}
                backgroundColor={isDark ? GameColors.inputDark : GameColors.white}
              />
            </View>
          </View>
        )}
      </View>

      {/* Status */}
      <View style={styles.gameStatusContainer}>
        <ThemedText style={gameStyles.statusLabel}>{t('game.ui.statusLabel', { locale })}</ThemedText>
        <View style={[gameStyles.statusBadge, { backgroundColor: StatusColors.waiting, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
          <ThemedText style={gameStyles.statusText}>
            {t('game.ui.statusWaiting', { locale })}
          </ThemedText>

          {/* <LiquidLoaderAnimation /> */}
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
            <Switch
              value={game.adminWritesComments ?? false}
              onValueChange={handleToggleAdminComments}
              trackColor={{ false: GameColors.neutral, true: GameColors.green }}
              thumbColor={GameColors.white}
              ios_backgroundColor={GameColors.neutral}
            />
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
            <Switch
              value={game.showSurnames ?? false}
              onValueChange={handleToggleShowSurnames}
              trackColor={{ false: GameColors.neutral, true: GameColors.green }}
              thumbColor={GameColors.white}
              ios_backgroundColor={GameColors.neutral}
            />
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
            <Switch
              value={(game.targetSelectionMode ?? 'random') === 'chronological'}
              onValueChange={handleToggleTargetSelectionMode}
              trackColor={{ false: GameColors.neutral, true: GameColors.green }}
              thumbColor={GameColors.white}
              ios_backgroundColor={GameColors.neutral}
            />
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
            <Switch
              value={game.showGuessResults ?? false}
              onValueChange={handleToggleShowGuessResults}
              trackColor={{ false: GameColors.neutral, true: GameColors.green }}
              thumbColor={GameColors.white}
              ios_backgroundColor={GameColors.neutral}
            />
          </View>

          <View style={styles.toggleContainer}>
            <View style={styles.toggleInfo}>
              <ThemedText style={styles.toggleLabel}>
                {t('game.ui.gameTypeLabel', { locale })}
              </ThemedText>
            </View>
            <View style={styles.gameTypeButtons}>
              <TouchableOpacity
                style={[
                  styles.gameTypeButton,
                  (game.gameType ?? 'mirror') === 'mirror' && styles.gameTypeButtonActive,
                ]}
                onPress={() => setGameType('mirror').catch(() => {})}
                activeOpacity={0.8}
              >
                <ThemedText style={[
                  styles.gameTypeButtonText,
                  (game.gameType ?? 'mirror') === 'mirror' && styles.gameTypeButtonTextActive,
                ]}>
                  {t('game.ui.gameTypeMirror', { locale })}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.gameTypeButton,
                  game.gameType === 'basket' && styles.gameTypeButtonActive,
                ]}
                onPress={() => setGameType('basket').catch(() => {})}
                activeOpacity={0.8}
              >
                <ThemedText style={[
                  styles.gameTypeButtonText,
                  game.gameType === 'basket' && styles.gameTypeButtonTextActive,
                ]}>
                  {t('game.ui.gameTypeBasket', { locale })}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.gameTypeButton,
                  game.gameType === 'clash' && styles.gameTypeButtonActive,
                ]}
                onPress={() => setGameType('clash').catch(() => {})}
                activeOpacity={0.8}
              >
                <ThemedText style={[
                  styles.gameTypeButtonText,
                  game.gameType === 'clash' && styles.gameTypeButtonTextActive,
                ]}>
                  {t('game.ui.gameTypeClash', { locale })}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.gameTypeButton,
                  game.gameType === 'ideas' && styles.gameTypeButtonActive,
                ]}
                onPress={() => setGameType('ideas').catch(() => {})}
                activeOpacity={0.8}
              >
                <ThemedText style={[
                  styles.gameTypeButtonText,
                  game.gameType === 'ideas' && styles.gameTypeButtonTextActive,
                ]}>
                  {t('game.ui.gameTypeIdeas', { locale })}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {game.gameType === 'ideas' && (
            <View style={styles.toggleContainer}>
              <View style={styles.toggleInfo}>
                <ThemedText style={styles.toggleLabel}>
                  {t('game.ui.ideas.ideaIncognitoModeTitle', { locale })}
                </ThemedText>
                <ThemedText style={styles.toggleDescription}>
                  {t('game.ui.ideas.ideaIncognitoModeDescription', { locale })}
                </ThemedText>
              </View>
              <Switch
                value={game.ideaIncognitoMode ?? true}
                onValueChange={handleToggleIdeaIncognitoMode}
                trackColor={{ false: GameColors.neutral, true: GameColors.green }}
                thumbColor={GameColors.white}
                ios_backgroundColor={GameColors.neutral}
              />
            </View>
          )}
        </>
      )}

      {/* Admin Target Control */}
      {isAdmin && game.gameType !== 'clash' && (
        <TargetControlPanel
          locale={locale}
          showFancyAlert={showFancyAlert}
        />
      )}

      {/* Clash group setup */}
      {isAdmin && game.gameType === 'clash' && (
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`clashSetup:${game.gameType}`}
          align="center"
          animated
          insets={SCROLL_INSETS}
        >
          <Animated.View style={clashSetupPulse}>
            <ClashSetupPanel
              game={game}
              locale={locale}
              isDark={isDark}
              getDisplayName={getDisplayName}
              isAdmin={isAdmin}
              showFancyAlert={showFancyAlert}
            />
          </Animated.View>
        </ScrollIntoView>
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
              <PlayerAvatar name={participant.userName} photoURL={participant.photoURL} size={36} />
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
        <Leaderboard
          game={game}
          user={user}
          joinIndexById={joinIndexById}
          getDisplayName={getDisplayName}
          locale={locale}
          title={t('game.ui.leaderboardTitle', { locale })}
        />
      )}

      {/* Start Game / Waiting */}
      {/* Clash admins have their own controls in ClashSetupPanel above (wrapped separately) —
          this section renders an empty box for them, so keep it out of the auto-scroll pass. */}
      <ScrollIntoView
        enabled={!(isAdmin && game.gameType === 'clash')}
        scrollIntoViewKey={`${isAdmin}:${game.gameType ?? 'mirror'}`}
        align="center"
        animated
        insets={SCROLL_INSETS}
      >
        <Animated.View style={[gameStyles.gameFlowContainer, waitingPulse]}>
          {isAdmin && game.gameType !== 'clash' && (
            <TouchableOpacity
              style={[
                styles.startGameButton,
                { backgroundColor: GameColors.green, shadowColor: GameColors.shadow },
                (loading || game.participants.length < 2) && gameStyles.buttonDisabled,
              ]}
              onPress={handleStartGame}
              disabled={loading || game.participants.length < 2}
              activeOpacity={0.8}
              accessibilityLabel={t('game.ui.startGame', { locale })}
              accessibilityRole="button"
            >
              {loading
                ? <ActivityIndicator size="small" color={GameColors.white} />
                : <IconSymbol name="arrow.right.circle.fill" size={16} color={GameColors.white} />}
              <ThemedText style={styles.buttonText}>{t('game.ui.startGame', { locale })}</ThemedText>
            </TouchableOpacity>
          )}
          {!isAdmin && (
            <ThemedText style={styles.waitingText}>
              {t('game.ui.waitingForAdminStart', { locale })}
            </ThemedText>
          )}
        </Animated.View>
      </ScrollIntoView>
    </View>
  );
};

const styles = StyleSheet.create({
  phaseWrapper: { backgroundColor: GameColors.waitingTint, borderWidth: 1, borderColor: GameColors.waitingTintBorder, borderRadius: 16, padding: 16, marginBottom: 8 },
  gameIdContainer: { marginBottom: 20, width: '50%' },
  gameIdLabel: { marginBottom: 8, opacity: 0.7 },
  gameIdBox: { backgroundColor: GameColors.greenTint, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: GameColors.greenTint },
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
    backgroundColor: GameColors.white,
    shadowColor: GameColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  qrCodeBoxDark: {
    backgroundColor: GameColors.textDark,
  },
  gameStatusContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: 16, backgroundColor: GameColors.cardBg, borderRadius: 8 },
  toggleInfo: { flex: 1, marginRight: 16 },
  toggleLabel: { fontSize: 16, fontWeight: '600', marginBottom: 4, fontFamily: Fonts.sans },
  toggleDescription: { fontSize: 14, opacity: 0.7, lineHeight: 20, fontFamily: Fonts.sans },
  participantsContainer: { marginBottom: 24 },
  participantsTitle: { marginBottom: 12, fontFamily: Fonts.sans },
  participantItem: { padding: 12, borderRadius: 8, marginBottom: 8, backgroundColor: GameColors.cardBg },
  adminParticipant: { backgroundColor: 'rgba(255, 149, 0, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 149, 0, 0.3)' },
  participantInfo: { flex: 1 },
  participantName: { fontSize: 16, fontWeight: '600', marginBottom: 4, fontFamily: Fonts.sans },
  participantEmail: { fontSize: 14, opacity: 0.7, fontFamily: Fonts.sans },
  participantsScroll: { maxHeight: 160, marginTop: 8 },
  buttonWrapper: { alignItems: 'center', gap: 6 },
  gameTypeButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  gameTypeButton: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: GameColors.blue },
  gameTypeButtonActive: { backgroundColor: GameColors.blue },
  gameTypeButtonText: { fontSize: 14, fontWeight: '600', color: GameColors.blue },
  gameTypeButtonTextActive: { color: GameColors.white },
  startGameButton: { flexDirection: 'row', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 8, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  buttonText: { color: GameColors.white, fontWeight: '600', fontSize: 15, fontFamily: Fonts.sans },
  waitingText: { textAlign: 'center', opacity: 0.7, fontSize: 16, marginVertical: 16, fontFamily: Fonts.sans },
});
