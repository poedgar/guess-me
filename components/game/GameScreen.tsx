import { ThemedView } from '@/components/themed-view';
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
import React, { useState } from 'react';
import { Clipboard, Platform, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
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

  // Fancy alert state
  const [fancyVisible, setFancyVisible] = useState(false);
  const [fancyTitle, setFancyTitle] = useState<string | null>(null);
  const [fancyMessage, setFancyMessage] = useState<string | null>(null);
  const [fancyButtons, setFancyButtons] = useState<FancyAlertButton[]>([]);
  const [fancyCustomContent, setFancyCustomContent] = useState<React.ReactNode>();

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
    locale,
    isDark,
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!isSignedIn || !currentGame ? (
          <JoinScreen isSignedIn={isSignedIn} isDark={isDark} showFancyAlert={showFancyAlert} />
        ) : (
          <>
            <GameHeader
              game={currentGame}
              isAdmin={isAdmin}
              onCopyGameId={handleCopyGameId}
            />

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

            <TouchableOpacity
              style={[styles.leaveButton, { backgroundColor: GameColors.danger, shadowColor: '#000' }]}
              onPress={handleLeaveGame}
              activeOpacity={0.8}
            >
              <IconSymbol name="door.left.hand.open" size={16} color="#fff" />
            </TouchableOpacity>
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
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' as const },
  scrollContent: { padding: 20, paddingBottom: 40 },
  leaveButton: { borderRadius: 999, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 16, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
});
