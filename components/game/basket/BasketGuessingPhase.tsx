import { ThemedText } from '@/components/themed-text';
import type { Game } from '@/contexts/GameContext';
import { useGame } from '@/contexts/GameContext';
import { GameColors } from '@/constants/theme';
import { t } from '@/i18n';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface Props {
  game: Game;
  user: { uid: string } | null;
  isAdmin: boolean;
  locale: string;
  isDark: boolean;
  getDisplayName: (name: string) => string;
}

export const BasketGuessingPhase: React.FC<Props> = ({
  game, user, isAdmin, locale, isDark, getDisplayName,
}) => {
  const { submitBasketCommentGuess, submitBasketAuthorGuess, startNextBasketRound } = useGame();
  const [selectedWriterId, setSelectedWriterId] = useState<string | null>(null);
  const [isCommentCorrect, setIsCommentCorrect] = useState<boolean | null>(null);
  const [authorSubmitted, setAuthorSubmitted] = useState(false);

  const { schedule, currentRoundIndex, currentRoundComments, currentRoundGuesses } = game.basketData!;
  const guesserId = user?.uid ?? '';
  const isLastRound = currentRoundIndex + 1 >= schedule.length;

  const existingGuess = currentRoundGuesses.find(g => g.guesserId === guesserId);

  // The comment written about the current user
  const actualComment = currentRoundComments.find(c => c.subjectId === guesserId);

  const handleCommentSelect = async (commentWriterId: string) => {
    if (selectedWriterId !== null) return;
    setSelectedWriterId(commentWriterId);
    const correct = actualComment?.writerId === commentWriterId;
    setIsCommentCorrect(correct);
    await submitBasketCommentGuess(commentWriterId);
  };

  const handleAuthorSelect = async (authorId: string) => {
    if (authorSubmitted) return;
    setAuthorSubmitted(true);
    await submitBasketAuthorGuess(authorId);
  };

  // Other players (exclude self) shown as author candidates
  const otherPlayers = game.participants.filter(p => p.userId !== guesserId);

  // Determine the effective correctness (from state or from existing guess)
  const effectiveCorrect = isCommentCorrect !== null
    ? isCommentCorrect
    : (existingGuess?.commentCorrect ?? null);

  // Show author prompt when correct guess and author not yet submitted
  const showAuthorPrompt =
    effectiveCorrect === true &&
    !authorSubmitted &&
    (existingGuess?.authorGuessId === undefined);

  // Wrong guess — show wrong message state
  const showWrongState =
    effectiveCorrect === false && selectedWriterId !== null;

  return (
    <View style={styles.container}>
      {showWrongState ? (
        <View style={styles.resultSection}>
          <ThemedText style={styles.wrong}>{t('game.ui.basket.wrong', { locale })}</ThemedText>
        </View>
      ) : showAuthorPrompt ? (
        <View style={styles.authorSection}>
          <ThemedText style={styles.correct}>{t('game.ui.basket.correct', { locale })}</ThemedText>
          <ThemedText style={styles.prompt}>{t('game.ui.basket.whoWroteIt', { locale })}</ThemedText>
          {otherPlayers.map(p => (
            <TouchableOpacity
              key={p.userId}
              style={styles.authorCard}
              onPress={() => handleAuthorSelect(p.userId)}
              activeOpacity={0.8}
            >
              <ThemedText>{getDisplayName(p.userName)}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      ) : !authorSubmitted && !existingGuess ? (
        <View>
          <ThemedText style={styles.prompt}>{t('game.ui.basket.whichIsAboutYou', { locale })}</ThemedText>
          {currentRoundComments.map(comment => (
            <TouchableOpacity
              key={comment.writerId}
              style={styles.commentCard}
              onPress={() => handleCommentSelect(comment.writerId)}
              activeOpacity={0.8}
            >
              <ThemedText>{comment.text}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.doneSection}>
          <ThemedText style={styles.waiting}>
            {t('game.ui.basket.waitingForGuesses', {
              locale,
              count: currentRoundGuesses.length,
              total: game.participants.length,
            })}
          </ThemedText>
        </View>
      )}

      {isAdmin && (
        <View style={styles.adminSection}>
          {isLastRound && (
            <ThemedText style={styles.finishLabel}>
              {t('game.ui.basket.finishGame', { locale })}
            </ThemedText>
          )}
          <TouchableOpacity
            style={styles.nextButton}
            onPress={startNextBasketRound}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.nextText}>
              {t('game.ui.basket.nextRound', { locale })}
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12, paddingVertical: 8 },
  prompt: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  commentCard: {
    backgroundColor: GameColors.cardBg,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    shadowColor: GameColors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  authorSection: { gap: 8 },
  authorCard: {
    backgroundColor: GameColors.cardBg,
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
  },
  resultSection: { alignItems: 'center', paddingVertical: 8 },
  doneSection: { alignItems: 'center' },
  correct: { color: GameColors.correct, fontWeight: '700', fontSize: 15 },
  wrong: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  waiting: { textAlign: 'center', opacity: 0.7, marginVertical: 12 },
  adminSection: { gap: 8, marginTop: 8 },
  finishLabel: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
    opacity: 0.8,
  },
  nextButton: {
    backgroundColor: GameColors.blue,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  nextText: { color: GameColors.white, fontWeight: '600' },
});
