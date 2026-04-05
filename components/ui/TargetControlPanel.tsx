import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts, GameColors } from '@/constants/theme';
import { useGame } from '@/contexts/GameContext';
import { useSound } from '@/contexts/SoundContext';
// import { t } from '@/i18n';
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
      showFancyAlert('Успіх', 'Налаштування цілей скинуто!');
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert('Помилка', error.message || 'Не вдалося скинути налаштування');
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
      showFancyAlert('Успіх', 'Цільового гравця для наступного раунду встановлено!');
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert('Помилка', error.message || 'Не вдалося встановити ціль');
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
      showFancyAlert('Успіх', 'Гравця пропущено з вибору цілі!');
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert('Помилка', error.message || 'Не вдалося пропустити гравця');
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
        Керування цільовими гравцями
      </ThemedText>
      
      <View style={styles.statusContainer}>
        {preferredTarget && (
          <View style={styles.statusItem}>
            <IconSymbol name="star.fill" size={16} color={GameColors.green} />
            <ThemedText style={styles.statusText}>
              Наступна ціль: {currentGame.participants.find(p => p.userId === preferredTarget)?.userName}
            </ThemedText>
          </View>
        )}
        
        {skippedTargets.length > 0 && (
          <View style={styles.statusItem}>
            <IconSymbol name="hourglass" size={16} color={GameColors.danger} />
            <ThemedText style={styles.statusText}>
              Пропущено: {skippedTargets.length} гравців
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
          <IconSymbol name="hourglass" size={16} color="#fff" />
        ) : (
          <IconSymbol name="arrow.up.circle.fill" size={16} color="#fff" />
        )}
        <ThemedText style={styles.resetButtonText}>Скинути</ThemedText>
      </TouchableOpacity>

      <ScrollView style={styles.participantsList} showsVerticalScrollIndicator={false}>
        {currentGame.participants.map((participant) => {
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
                  <ThemedText style={styles.currentLabel}>Поточна ціль</ThemedText>
                )}
                {isPreferred && (
                  <ThemedText style={styles.preferredLabel}>Наступна ціль</ThemedText>
                )}
                {isSkipped && (
                  <ThemedText style={styles.skippedLabel}>Пропущено</ThemedText>
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
                    <IconSymbol name="hourglass" size={16} color="#fff" />
                  ) : (
                    <IconSymbol name="star.fill" size={16} color="#fff" />
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
                    <IconSymbol name="hourglass" size={16} color="#fff" />
                  ) : (
                    <IconSymbol name="door.left.hand.open" size={16} color="#fff" />
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
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#ccc',
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
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
});
