import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FaceMessage } from '@/components/ui/FaceMessage';
import { FancyAlert, FancyAlertButton } from '@/components/ui/FancyAlert';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GameColors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useGame } from '@/contexts/GameContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSound } from '@/contexts/SoundContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated, Clipboard, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivePhase } from './ActivePhase';
import { GameHeader } from './GameHeader';
import { GuessingPhase } from './GuessingPhase';
import { JoinScreen } from './JoinScreen';
import { ResultsPhase } from './ResultsPhase';
import { WaitingPhase } from './WaitingPhase';

export const GameScreen: React.FC = () => {
  const { user, isSignedIn } = useAuth();
  const { locale } = useLanguage();
  const { playSound } = useSound();
  const { currentGame, leaveGame } = useGame();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const prevStatus = useRef(currentGame?.status);
  useEffect(() => {
    if (prevStatus.current !== currentGame?.status) {
      prevStatus.current = currentGame?.status;
      fadeAnim.setValue(0);
      slideAnim.setValue(24);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    }
  }, [currentGame?.status]);

  // Fancy alert state
  const [fancyVisible, setFancyVisible] = useState(false);
  const [fancyTitle, setFancyTitle] = useState<string | null>(null);
  const [fancyMessage, setFancyMessage] = useState<string | null>(null);
  const [fancyButtons, setFancyButtons] = useState<FancyAlertButton[]>([]);
  const [fancyCustomContent, setFancyCustomContent] = useState<React.ReactNode>();

  const [faceMessage, setFaceMessage] = useState<{ visible: boolean; message: string; face?: string }>({
    visible: false,
    message: '',
    face: '😊',
  });

  // Add function after showFancyAlert
  const showFaceMessage = (message: string, face?: React.ReactNode) => {
    setFaceMessage({ visible: true, message, face });
  };
  
  const closeFaceMessage = () => {
    setFaceMessage(prev => ({ ...prev, visible: false }));
  };

  const showFancyAlert = (title: string, message?: string | null, buttons?: FancyAlertButton[], customContent?: React.ReactNode) => {
    setFancyTitle(title);
    setFancyMessage(message ?? null);
    setFancyButtons(buttons && buttons.length > 0 ? buttons : [{ text: t('common.ok', { locale }) }]);
    setFancyCustomContent(customContent);
    setFancyVisible(true);
  };

  const closeFancyAlert = () => setFancyVisible(false);

  // Shared computed values
  const isAdmin = currentGame?.adminId === user?.uid;

  const getDisplayName = (fullName: string) => {
    if (currentGame?.showSurnames) return fullName;
    return fullName.split(' ')[0];
  };

  const participantsByJoin = (currentGame?.participants || []).slice().sort((a, b) => {
    const aMillis = a.joinedAt && typeof (a.joinedAt as any)?.toDate === 'function'
      ? (a.joinedAt as any).toDate().getTime()
      : new Date(a.joinedAt).getTime();
    const bMillis = b.joinedAt && typeof (b.joinedAt as any)?.toDate === 'function'
      ? (b.joinedAt as any).toDate().getTime()
      : new Date(b.joinedAt).getTime();
    return aMillis - bMillis;
  });

  const joinIndexById: Record<string, number> = Object.fromEntries(
    participantsByJoin.map((p, i) => [p.userId, i + 1])
  );

  const commentsForPlayer = currentGame?.guessingData?.commentsByTarget?.[user?.uid || ''] || [];

  const handleCopyGameId = async () => {
    if (currentGame) {
      await playSound('copy');
      Clipboard.setString(currentGame.id);
      showFancyAlert(t('game.alerts.copiedTitle', { locale }), t('game.alerts.copiedMessage', { locale }));
    }
  };

  const handleLeaveGame = async () => {
    await playSound('click');
    showFancyAlert(
      t('game.alerts.leaveGameTitle', { locale }),
      t('game.alerts.leaveGameMessage', { locale }),
      [
        { text: t('common.cancel', { locale }), style: 'cancel' },
        {
          text: t('game.alerts.confirmLeave', { locale }),
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await leaveGame();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showFancyAlert(t('game.alerts.leftGameTitle', { locale }));
            } catch (error: any) {
              console.error('handleLeaveGame error', error);
              showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.leaveGameFailed', { locale }));
            }
          },
        },
      ]
    );
  };

  const sharedProps = {
    game: currentGame!,
    isAdmin,
    user,
    participantsByJoin,
    joinIndexById,
    getDisplayName,
    showFancyAlert,
    showFaceMessage,
    locale,
    isDark,
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>
        {!isSignedIn || !currentGame ? (
          <JoinScreen isSignedIn={isSignedIn} isDark={isDark} showFancyAlert={showFancyAlert} showFaceMessage={showFaceMessage} />
        ) : (
          <>
            <GameHeader
              game={currentGame}
              isAdmin={isAdmin}
              onCopyGameId={handleCopyGameId}
            />

            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
              {currentGame.status === 'waiting' && (
                <WaitingPhase {...sharedProps} onCopyGameId={handleCopyGameId} />
              )}

              {currentGame.status === 'active' && currentGame.currentRound && (
                <ActivePhase {...sharedProps} />
              )}

              {currentGame.status === 'guessing_phase' && (
                <GuessingPhase {...sharedProps} commentsForPlayer={commentsForPlayer} />
              )}

              {currentGame.status === 'finished' && (
                <ResultsPhase
                  game={currentGame}
                  user={user}
                  joinIndexById={joinIndexById}
                  getDisplayName={getDisplayName}
                  locale={locale}
                />
              )}
            </Animated.View>

            <View style={styles.leaveButtonWrapper}>
              <TouchableOpacity
                style={[styles.leaveButton, { backgroundColor: GameColors.danger, shadowColor: GameColors.shadow }]}
                onPress={handleLeaveGame}
                activeOpacity={0.8}
              >
                <IconSymbol name="door.left.hand.open" size={16} color={GameColors.white} />
              </TouchableOpacity>
              <ThemedText style={styles.leaveButtonLabel}>{t('game.ui.leaveGame', { locale })}</ThemedText>
            </View>
          </>
        )}
      </ScrollView>

      <FancyAlert
        visible={fancyVisible}
        title={fancyTitle}
        message={fancyMessage}
        buttons={fancyButtons}
        onClose={closeFancyAlert}
        customContent={fancyCustomContent}
      />

      <FaceMessage
        visible={faceMessage.visible}
        message={faceMessage.message}
        face={faceMessage.face}
        onComplete={() => setFaceMessage(prev => ({ ...prev, visible: false }))}
      />
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' as const },
  scrollContent: { padding: 20, paddingBottom: 40 },
  leaveButtonWrapper: { alignItems: 'center', gap: 6, marginTop: 16 },
  leaveButton: { borderRadius: 999, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  leaveButtonLabel: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
