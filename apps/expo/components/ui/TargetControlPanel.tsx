import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts, GameColors } from '@/constants/theme';
import { useGame } from '@/contexts/GameContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

interface Props {
  locale: string;
  showFancyAlert: (title: string, message?: string) => void;
}

export function TargetControlPanel({ locale, showFancyAlert }: Props) {
  const { currentGame, setNextRoundTarget, skipNextRoundTarget, resetTargetControls } = useGame();
  const { playSound } = useSound();
  const [settingTarget, setSettingTarget] = useState<string | null>(null);
  const [skippingTarget, setSkippingTarget] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    try {
      setIsResetting(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await resetTargetControls();
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert(t('common.success', { locale }), t('game.alerts.resetTargetSuccess', { locale }));
    } catch (error: unknown) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.resetTargetFailed', { locale }));
    } finally {
      setIsResetting(false);
    }
  };

  const handleSetTarget = async (participantId: string) => {
    try {
      setSettingTarget(participantId);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await setNextRoundTarget(participantId);
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert(t('common.success', { locale }), t('game.alerts.setTargetSuccess', { locale }));
    } catch (error: unknown) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.setTargetFailed', { locale }));
    } finally {
      setSettingTarget(null);
    }
  };

  const handleSkipTarget = async (participantId: string) => {
    try {
      setSkippingTarget(participantId);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await skipNextRoundTarget(participantId);
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert(t('common.success', { locale }), t('game.alerts.skipTargetSuccess', { locale }));
    } catch (error: unknown) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.skipTargetFailed', { locale }));
    } finally {
      setSkippingTarget(null);
    }
  };

  if (!currentGame) return null;

  const preferredTarget = currentGame.adminNextTargetPreference;
  const skippedTargets = currentGame.adminSkippedTargets || [];

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        {t('game.ui.targetControl.title', { locale })}
      </ThemedText>

      <View style={styles.statusContainer}>
        {preferredTarget && (
          <View style={styles.statusItem}>
            <IconSymbol name="star.fill" size={16} color={GameColors.green} />
            <ThemedText style={styles.statusText}>
              {t('game.ui.targetControl.nextTarget', { locale, name: currentGame.participants.find(p => p.userId === preferredTarget)?.userName })}
            </ThemedText>
          </View>
        )}

        {skippedTargets.length > 0 && (
          <View style={styles.statusItem}>
            <IconSymbol name="hourglass" size={16} color={GameColors.danger} />
            <ThemedText style={styles.statusText}>
              {t('game.ui.targetControl.skippedCount', { locale, count: skippedTargets.length })}
            </ThemedText>
          </View>
        )}
      </View>

      {/* Reset Button */}
      <TouchableOpacity
        style={[
          styles.resetButton,
          isResetting && styles.disabledButton,
        ]}
        onPress={handleReset}
        disabled={isResetting}
        activeOpacity={0.8}
      >
        {isResetting ? (
          <IconSymbol name="hourglass" size={16} color={GameColors.white} />
        ) : (
          <IconSymbol name="arrow.up.circle.fill" size={16} color={GameColors.white} />
        )}
        <ThemedText style={styles.resetButtonText}>{t('game.ui.targetControl.reset', { locale })}</ThemedText>
      </TouchableOpacity>

      <ScrollView style={styles.participantsList} showsVerticalScrollIndicator={false}>
        {currentGame.participants
          .filter((p) => (currentGame.adminWritesComments ?? false) || p.userId !== currentGame.adminId)
          .map((participant) => {
          const isPreferred = preferredTarget === participant.userId;
          const isSkipped = skippedTargets.includes(participant.userId);
          const isCurrentTarget = currentGame.currentRound?.targetUserId === participant.userId;

          return (
            <View key={participant.userId} style={[
              styles.participantItem,
              isPreferred && styles.preferredItem,
              isSkipped && styles.skippedItem,
              isCurrentTarget && styles.currentTargetItem,
            ]}>
              <View style={styles.participantInfo}>
                <ThemedText style={styles.participantName}>
                  {participant.userName}
                </ThemedText>
                {isCurrentTarget && (
                  <ThemedText style={styles.currentLabel}>{t('game.ui.targetControl.currentTarget', { locale })}</ThemedText>
                )}
                {isPreferred && (
                  <ThemedText style={styles.preferredLabel}>{t('game.ui.targetControl.nextTargetLabel', { locale })}</ThemedText>
                )}
                {isSkipped && (
                  <ThemedText style={styles.skippedLabel}>{t('game.ui.targetControl.skippedLabel', { locale })}</ThemedText>
                )}
              </View>
              
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.setButton,
                    isPreferred && styles.disabledButton,
                    isCurrentTarget && styles.disabledButton,
                  ]}
                  onPress={() => handleSetTarget(participant.userId)}
                  disabled={!!isPreferred || !!isCurrentTarget || settingTarget === participant.userId}
                  activeOpacity={0.8}
                >
                  {settingTarget === participant.userId ? (
                    <IconSymbol name="hourglass" size={16} color={GameColors.white} />
                  ) : (
                    <IconSymbol name="star.fill" size={16} color={GameColors.white} />
                  )}
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.skipButton,
                    isSkipped && styles.disabledButton,
                    isCurrentTarget && styles.disabledButton,
                  ]}
                  onPress={() => handleSkipTarget(participant.userId)}
                  disabled={!!isSkipped || !!isCurrentTarget || skippingTarget === participant.userId}
                  activeOpacity={0.8}
                >
                  {skippingTarget === participant.userId ? (
                    <IconSymbol name="hourglass" size={16} color={GameColors.white} />
                  ) : (
                    <IconSymbol name="door.left.hand.open" size={16} color={GameColors.white} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: GameColors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: Fonts.sans,
  },
  statusContainer: {
    marginBottom: 16,
    gap: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    opacity: 0.8,
    fontFamily: Fonts.sans,
  },
  participantsList: {
    maxHeight: 300,
  },
  participantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: GameColors.white,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  preferredItem: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderWidth: 1,
    borderColor: GameColors.green,
  },
  skippedItem: {
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderWidth: 1,
    borderColor: GameColors.danger,
  },
  currentTargetItem: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderWidth: 1,
    borderColor: GameColors.blue,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
  currentLabel: {
    fontSize: 12,
    color: GameColors.blue,
    marginTop: 2,
    fontFamily: Fonts.sans,
  },
  preferredLabel: {
    fontSize: 12,
    color: GameColors.green,
    marginTop: 2,
    fontFamily: Fonts.sans,
  },
  skippedLabel: {
    fontSize: 12,
    color: GameColors.danger,
    marginTop: 2,
    fontFamily: Fonts.sans,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  setButton: {
    backgroundColor: GameColors.green,
  },
  skipButton: {
    backgroundColor: GameColors.danger,
  },
  disabledButton: {
    backgroundColor: GameColors.cardBorder,
    opacity: 0.6,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GameColors.neutral,
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  resetButtonText: {
    color: GameColors.white,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
});
