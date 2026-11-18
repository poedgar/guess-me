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
import { buildJoinIndexById, sortParticipantsByJoin } from '@/utils/participants';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Animated, Clipboard, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { wrapScrollView } from '@/components/ui/scrollIntoView';
import { ActivePhase } from '@/components/game/mirror/ActivePhase';
import { BasketScreen } from '@/components/game/basket/BasketScreen';
import { ClashScreen } from '@/components/game/clash/ClashScreen';
import { IdeaScreen } from '@/components/game/ideas/IdeaScreen';
import { GameHeader } from './GameHeader';
import { GuessingPhase } from '@/components/game/mirror/GuessingPhase';
import { JoinScreen } from './JoinScreen';
import { ResultsPhase } from '@/components/game/mirror/ResultsPhase';
import { WaitingPhase } from '@/components/game/mirror/WaitingPhase';

// wrapScrollView reads the passed component's `.displayName`/`.name` as soon as it's
// called. Passing the `ScrollView` import binding directly would force React Native's
// lazily-exported `ScrollView` getter to resolve at module-import time, which (in this
// RN/jest-expo setup) breaks React Native Testing Library's own lazy `Switch` detection
// in every test file that imports this module. Wrapping it in a local forwardRef defers
// the real `ScrollView` reference to render time, same as the pre-existing JSX usage did.
const RawScrollView = React.forwardRef<ScrollView, React.ComponentProps<typeof ScrollView>>(
  (props, ref) => <ScrollView ref={ref} {...props} />
);
RawScrollView.displayName = 'RawScrollView';
const GameScrollView = wrapScrollView(RawScrollView);

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
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: false }),
        Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: false }),
      ]).start();
    }
  }, [currentGame?.status]);

  // Fancy alert state
  const [fancyVisible, setFancyVisible] = useState(false);
  const [fancyTitle, setFancyTitle] = useState<string | null>(null);
  const [fancyMessage, setFancyMessage] = useState<string | null>(null);
  const [fancyButtons, setFancyButtons] = useState<FancyAlertButton[]>([]);
  const [fancyCustomContent, setFancyCustomContent] = useState<React.ReactNode>();

  const [isLeaving, setIsLeaving] = useState(false);

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

  // Notify non-admin players exactly once when the admin abandons the game
  const adminLeftAlertShownForGame = useRef<string | null>(null);
  useEffect(() => {
    if (
      currentGame?.adminLeft &&
      !isAdmin &&
      adminLeftAlertShownForGame.current !== currentGame.id
    ) {
      adminLeftAlertShownForGame.current = currentGame.id;
      showFancyAlert(
        t('game.ui.adminLeftTitle', { locale }),
        t('game.ui.adminLeftMessage', { locale }),
        [{
          text: t('common.ok', { locale }),
          onPress: async () => { try { await leaveGame(); } catch (_) {} },
        }],
      );
    }
  }, [currentGame?.adminLeft, currentGame?.id, isAdmin, locale]);

  const getDisplayName = useCallback((fullName: string) => {
    if (currentGame?.showSurnames) return fullName;
    return fullName.split(' ')[0];
  }, [currentGame?.showSurnames]);

  const participantsByJoin = useMemo(
    () => sortParticipantsByJoin(currentGame?.participants || []),
    [currentGame?.participants],
  );

  const joinIndexById = useMemo(
    () => buildJoinIndexById(participantsByJoin),
    [participantsByJoin],
  );

  // Frozen-at-start numbers for the admin checklist and guess-picker only.
  // Falls back to the live joinIndexById for games created before this field existed.
  const playerNumbers = useMemo(
    () => currentGame?.playerNumbers ?? joinIndexById,
    [currentGame?.playerNumbers, joinIndexById],
  );

  const commentsForPlayer = currentGame?.guessingData?.commentsByTarget?.[user?.uid || ''] || [];

  const handleCopyGameId = async () => {
    if (!currentGame) return;
    try {
      await playSound('copy');
      Clipboard.setString(currentGame.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showFancyAlert(t('game.alerts.copiedTitle', { locale }), t('game.alerts.copiedMessage', { locale }));
    } catch {
      // silent fail
    }
  };

  const handleLeaveGame = async () => {
    if (isLeaving) return;
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
              setIsLeaving(true);
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await leaveGame();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showFancyAlert(t('game.alerts.leftGameTitle', { locale }));
            } catch (error: unknown) {
              console.error('handleLeaveGame error', error);
              showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.leaveGameFailed', { locale }));
            } finally {
              setIsLeaving(false);
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
    playerNumbers,
    getDisplayName,
    showFancyAlert,
    showFaceMessage,
    locale,
    isDark,
  };

  return (
    <ThemedView style={styles.container}>
      <GameScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>
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
              <>
                {currentGame.status === 'waiting' && (
                  <WaitingPhase {...sharedProps} onCopyGameId={handleCopyGameId} />
                )}

                {(currentGame.status === 'basket_writing' || currentGame.status === 'basket_guessing') && (
                  <BasketScreen
                    game={currentGame}
                    user={user}
                    isAdmin={isAdmin}
                    locale={locale}
                    isDark={isDark}
                    getDisplayName={getDisplayName}
                    showFancyAlert={showFancyAlert}
                    showFaceMessage={showFaceMessage}
                  />
                )}

                {(currentGame.status === 'clash_writing' || currentGame.status === 'clash_guessing') && (
                  <ClashScreen
                    game={currentGame}
                    user={user}
                    isAdmin={isAdmin}
                    locale={locale}
                    isDark={isDark}
                    getDisplayName={getDisplayName}
                    showFancyAlert={showFancyAlert}
                    showFaceMessage={showFaceMessage}
                  />
                )}

                {(currentGame.status === 'idea_writing' || currentGame.status === 'idea_rating') && (
                  <IdeaScreen
                    game={currentGame}
                    user={user}
                    isAdmin={isAdmin}
                    locale={locale}
                    isDark={isDark}
                    getDisplayName={getDisplayName}
                    showFancyAlert={showFancyAlert}
                    showFaceMessage={showFaceMessage}
                  />
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
              </>
            </Animated.View>

            <TouchableOpacity
              style={[styles.leaveButton, { borderColor: GameColors.danger }, isLeaving && { opacity: 0.6 }]}
              onPress={handleLeaveGame}
              disabled={isLeaving}
              activeOpacity={0.6}
              accessibilityLabel={t('game.ui.leaveGame', { locale })}
              accessibilityRole="button"
            >
              {isLeaving
                ? <ActivityIndicator size="small" color={GameColors.danger} />
                : <IconSymbol name="door.left.hand.open" size={13} color={GameColors.danger} />}
              <ThemedText style={[styles.leaveButtonLabel, { color: GameColors.danger }]}>{t('game.ui.leaveGame', { locale })}</ThemedText>
            </TouchableOpacity>
          </>
        )}
      </GameScrollView>

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
  leaveButton: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 6, marginTop: 16 },
  leaveButtonLabel: { fontWeight: '500', fontSize: 13 },
});
