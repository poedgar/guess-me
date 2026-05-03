import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ShowFancyAlertFn } from '@/components/game/GameHeader';
import { gameStyles } from '@/components/game/gameStyles';
import { Fonts, GameColors, StatusColors } from '@/constants/theme';
import type { Game } from '@/contexts/GameContext';
import { useGame } from '@/contexts/GameContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

interface Props {
  game: Game;
  user: { uid: string } | null;
  isAdmin: boolean;
  locale: string;
  isDark: boolean;
  getDisplayName: (name: string) => string;
  showFancyAlert?: ShowFancyAlertFn;
  showFaceMessage?: (message: string, face?: string) => void;
}

export const BasketGuessingPhase: React.FC<Props> = ({
  game, user, isAdmin, locale, getDisplayName, showFancyAlert,
}) => {
  const { submitBasketCommentGuess, submitBasketAuthorGuess, startNextBasketRound } = useGame();
  const { playSound } = useSound();

  const [selectedWriterId, setSelectedWriterId] = useState<string | null>(null);
  const [isCommentCorrect, setIsCommentCorrect] = useState<boolean | null>(null);
  const [authorSubmitted, setAuthorSubmitted] = useState(false);
  const [isSubmittingGuess, setIsSubmittingGuess] = useState(false);
  const [isSubmittingAuthor, setIsSubmittingAuthor] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const { schedule, currentRoundIndex, currentRoundComments, currentRoundGuesses } = game.basketData!;
  const totalRounds = schedule.length;
  const guesserId = user?.uid ?? '';
  const isLastRound = currentRoundIndex + 1 >= schedule.length;

  const existingGuess = currentRoundGuesses.find(g => g.guesserId === guesserId);
  const actualComment = currentRoundComments.find(c => c.subjectId === guesserId);
  const otherPlayers = game.participants.filter(p => p.userId !== guesserId);

  const effectiveCorrect = isCommentCorrect !== null
    ? isCommentCorrect
    : (existingGuess?.commentCorrect ?? null);

  const showAuthorPrompt =
    effectiveCorrect === true &&
    !authorSubmitted &&
    existingGuess?.authorGuessId === undefined;

  const isDone =
    authorSubmitted ||
    (existingGuess && (!existingGuess.commentCorrect || existingGuess.authorGuessId !== undefined));

  const showWrong = effectiveCorrect === false && selectedWriterId !== null;

  const handleCommentSelect = async (commentWriterId: string) => {
    if (selectedWriterId !== null || isSubmittingGuess) return;
    try {
      setIsSubmittingGuess(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const correct = actualComment?.writerId === commentWriterId;
      setSelectedWriterId(commentWriterId);
      setIsCommentCorrect(correct);
      await submitBasketCommentGuess(commentWriterId);
      if (correct) {
        await playSound('correctGuess');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await playSound('wrongGuess');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: unknown) {
      await playSound('error');
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsSubmittingGuess(false);
    }
  };

  const handleAuthorSelect = async (authorId: string) => {
    if (authorSubmitted || isSubmittingAuthor) return;
    try {
      setIsSubmittingAuthor(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await submitBasketAuthorGuess(authorId);
      setAuthorSubmitted(true);
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      await playSound('error');
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsSubmittingAuthor(false);
    }
  };

  const handleNextRound = async () => {
    try {
      setIsAdvancing(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startNextBasketRound();
      await playSound(isLastRound ? 'gameOver' : 'roundComplete');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      await playSound('error');
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <View style={styles.phaseWrapper}>
      <View style={styles.statusRow}>
        <ThemedText style={gameStyles.statusLabel}>{t('game.ui.statusLabel', { locale })}</ThemedText>
        <View style={[gameStyles.statusBadge, { backgroundColor: StatusColors.basket_guessing }]}>
          <ThemedText style={gameStyles.statusText}>
            {t('game.ui.basket.round', { locale, current: currentRoundIndex + 1, total: totalRounds })}
          </ThemedText>
        </View>
      </View>

      <View style={gameStyles.gameFlowContainer}>
        {isDone || showWrong ? (
          <View style={styles.doneCard}>
            {showWrong && (
              <ThemedText style={styles.wrongText}>{t('game.ui.basket.wrong', { locale })}</ThemedText>
            )}
            <ThemedText style={styles.waitingText}>
              {t('game.ui.basket.waitingForGuesses', {
                locale,
                count: currentRoundGuesses.length,
                total: game.participants.length,
              })}
            </ThemedText>
          </View>
        ) : showAuthorPrompt ? (
          <View style={styles.authorSection}>
            <ThemedText style={styles.correctText}>{t('game.ui.basket.correct', { locale })}</ThemedText>
            <ThemedText style={styles.sectionTitle}>{t('game.ui.basket.whoWroteIt', { locale })}</ThemedText>
            {otherPlayers.map(p => (
              <TouchableOpacity
                key={p.userId}
                style={styles.authorCard}
                onPress={() => handleAuthorSelect(p.userId)}
                disabled={isSubmittingAuthor}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.authorName}>{getDisplayName(p.userName)}</ThemedText>
              </TouchableOpacity>
            ))}
            {isSubmittingAuthor && <ActivityIndicator style={{ marginTop: 8 }} color={GameColors.purple} />}
          </View>
        ) : (
          <View>
            <ThemedText style={styles.sectionTitle}>{t('game.ui.basket.whichIsAboutYou', { locale })}</ThemedText>
            {currentRoundComments.map(comment => (
              <TouchableOpacity
                key={comment.writerId}
                style={[
                  styles.commentCard,
                  selectedWriterId === comment.writerId && styles.commentCardSelected,
                ]}
                onPress={() => handleCommentSelect(comment.writerId)}
                disabled={selectedWriterId !== null || isSubmittingGuess}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.commentText}>{comment.text}</ThemedText>
              </TouchableOpacity>
            ))}
            {isSubmittingGuess && <ActivityIndicator style={{ marginTop: 8 }} color={GameColors.blue} />}
          </View>
        )}

        {isAdmin && (
          <View style={styles.adminSection}>
            {isLastRound && (
              <ThemedText style={styles.finishLabel}>{t('game.ui.basket.finishGame', { locale })}</ThemedText>
            )}
            <TouchableOpacity
              style={[
                styles.wideButton,
                { backgroundColor: isLastRound ? GameColors.green : GameColors.blue, shadowColor: GameColors.shadow },
                isAdvancing && gameStyles.buttonDisabled,
              ]}
              onPress={handleNextRound}
              disabled={isAdvancing}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {isAdvancing
                ? <ActivityIndicator size="small" color={GameColors.white} />
                : <IconSymbol name={isLastRound ? 'flag.checkered' : 'forward.end.fill'} size={16} color={GameColors.white} />}
              <ThemedText style={styles.wideButtonText}>{t('game.ui.basket.nextRound', { locale })}</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  phaseWrapper: {
    backgroundColor: 'rgba(175,82,222,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(175,82,222,0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12, fontFamily: Fonts.sans },
  commentCard: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: GameColors.cardBg,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: GameColors.cardBorder,
    ...Platform.select({
      ios: { shadowColor: GameColors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  commentCardSelected: { borderColor: GameColors.blue, borderWidth: 2 },
  commentText: { fontSize: 16, lineHeight: 22, fontFamily: Fonts.sans },
  authorSection: { gap: 8 },
  authorCard: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: GameColors.cardBg,
    borderWidth: 1,
    borderColor: GameColors.cardBorder,
    marginBottom: 6,
  },
  authorName: { fontSize: 15, fontWeight: '500', fontFamily: Fonts.sans },
  correctText: { color: GameColors.correct, fontWeight: '700', fontSize: 16, marginBottom: 8, fontFamily: Fonts.sans },
  wrongText: { color: GameColors.incorrect, fontWeight: '700', fontSize: 16, textAlign: 'center', marginBottom: 8, fontFamily: Fonts.sans },
  doneCard: {
    padding: 24,
    borderRadius: 8,
    backgroundColor: GameColors.cardBg,
    alignItems: 'center',
  },
  waitingText: { textAlign: 'center', opacity: 0.7, fontSize: 16, fontFamily: Fonts.sans },
  adminSection: { marginTop: 24, alignItems: 'center', gap: 6 },
  wideButton: {
    flexDirection: 'row',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  wideButtonText: { color: GameColors.white, fontWeight: '600', fontSize: 15, fontFamily: Fonts.sans },
  finishLabel: { fontSize: 13, color: GameColors.green, fontWeight: '600', opacity: 0.85, fontFamily: Fonts.sans },
});
