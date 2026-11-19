import { ThemedText } from '@/components/themed-text';
import { WithAnonymousAvatar } from '@/components/ui/AnonymousAvatar';
import { assignAnonymousAvatars } from '@/utils/avatars';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TargetControlPanel } from '@/components/ui/TargetControlPanel';
import { Fonts, GameColors, StatusColors } from '@/constants/theme';
import { gameStyles } from '../gameStyles';
import { Comment, Game, Participant, useGame } from '@/contexts/GameContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { ShowFancyAlertFn } from '../GameHeader';
import PostGuessingPointsPanel from './PostGuessingPointsPanel';
import { AdminRoundTools } from '@/components/game/AdminRoundTools';
import { ScrollIntoView } from '@/components/ui/scrollIntoView';
import { SCROLL_INSETS } from '@/constants/scroll';
import { usePulseBorderOnChange } from '@/hooks/usePulseBorderOnChange';

interface GuessResult {
  correct: boolean;
  message: string;
  details: string;
  commentText: string;
  actualAuthorName: string;
  guessedAuthorName: string;
  guessPoints: number;
  commentPoints: number;
  totalPoints: number;
}

interface Props {
  game: Game;
  isAdmin: boolean;
  user: { uid: string } | null;
  participantsByJoin: Participant[];
  joinIndexById: Record<string, number>;
  playerNumbers?: Record<string, number>;
  getDisplayName: (name: string) => string;
  commentsForPlayer: Comment[];
  showFancyAlert: ShowFancyAlertFn;
  locale: string;
}

export const GuessingPhase: React.FC<Props> = ({
  game,
  isAdmin,
  user,
  participantsByJoin,
  joinIndexById,
  playerNumbers,
  getDisplayName,
  commentsForPlayer,
  showFancyAlert,
  locale,
}) => {
  const { playSound } = useSound();
  const { loading, submitGuess, markPlayerGuessesSubmitted, finalizeGuessingPhase, startNextRound, restartMirrorRound, skipMirrorRound } = useGame();

  const [selectedGuesses, setSelectedGuesses] = useState<{ [commentId: string]: string }>({});
  const [hasSubmittedGuesses, setHasSubmittedGuesses] = useState(false);
  const hasSubmittedGuessesRef = useRef(false);
  const [guessResultModal, setGuessResultModal] = useState<GuessResult[] | null>(null);
  const [isSubmittingGuesses, setIsSubmittingGuesses] = useState(false);
  const [isFinalizingGuesses, setIsFinalizingGuesses] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  // Reset submission state when entering guessing phase
  useEffect(() => {
    setHasSubmittedGuesses(false);
    hasSubmittedGuessesRef.current = false;
    setGuessResultModal(null);
  }, []);

  // Same seed as the active phase, so a comment keeps its avatar.
  const commentAvatars = assignAnonymousAvatars(
    commentsForPlayer.map(c => c.id),
    `${game.id}:mirror:${user?.uid ?? ''}`,
  );
  const allCommentsHaveGuesses = commentsForPlayer.length === 0 || commentsForPlayer.every(c => !!selectedGuesses[c.id]);

  const singleTargetId = game.guessingData?.singleRoundTargetId;
  const targetSubmitted = singleTargetId
    ? game.guessingData?.playersWhoSubmittedGuesses?.includes(singleTargetId)
    : false;
  const canProceed = singleTargetId ? !!targetSubmitted : !!game.guessingData?.allPlayersSubmitted;

  const prevCanProceed = useRef(false);
  useEffect(() => {
    if (isAdmin && canProceed && !prevCanProceed.current) {
      playSound('notification').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    prevCanProceed.current = canProceed;
  }, [canProceed]);

  const isGuessCorrect = (commentId: string, guessedAuthorId: string): boolean => {
    const comment = commentsForPlayer.find(c => c.id === commentId);
    return comment ? comment.authorId === guessedAuthorId : false;
  };

  const getGuessResultDisplay = (commentId: string): GuessResult | null => {
    if (!hasSubmittedGuessesRef.current) return null;
    const guessedAuthorId = selectedGuesses[commentId];
    if (!guessedAuthorId) return null;
    const comment = commentsForPlayer.find(c => c.id === commentId);
    if (!comment) return null;
    const correct = isGuessCorrect(commentId, guessedAuthorId);
    const actualAuthor = game.participants.find(p => p.userId === comment.authorId);
    const guessedAuthor = game.participants.find(p => p.userId === guessedAuthorId);
    const actualAuthorName = getDisplayName(actualAuthor?.userName || t('common.unknown', { locale }));
    const guessedAuthorName = getDisplayName(guessedAuthor?.userName || t('common.unknown', { locale }));
    const guessPoints = correct ? 1 : 0;
    const commentPoints = comment.points || 0;
    const message = correct
      ? t('game.ui.guessCorrect', { locale })
      : t('game.ui.guessIncorrect', { locale });
    const details = correct
      ? t('game.ui.guessCorrectDetails', { locale, actual: actualAuthorName, guessed: guessedAuthorName })
      : t('game.ui.guessIncorrectDetails', { locale, actual: actualAuthorName, guessed: guessedAuthorName });
    return {
      correct,
      message,
      details,
      commentText: comment?.text || '',
      actualAuthorName,
      guessedAuthorName,
      guessPoints,
      commentPoints,
      totalPoints: guessPoints + commentPoints,
    };
  };

  // Trigger modal when first guess result is available after submission
  useEffect(() => {
    if (hasSubmittedGuessesRef.current && commentsForPlayer.length > 0) {
      const commentsWithGuesses = commentsForPlayer.filter(comment => selectedGuesses[comment.id]);
      if (commentsWithGuesses.length > 0 && !guessResultModal) {
        const allResults = commentsWithGuesses
          .map(comment => getGuessResultDisplay(comment.id))
          .filter((result): result is GuessResult => result !== null);
        if (allResults.length > 0) {
          setGuessResultModal(allResults);
        }
      }
    }
  }, [hasSubmittedGuessesRef.current, selectedGuesses, commentsForPlayer, guessResultModal]);

  const handleGuessSelect = (commentId: string, authorId: string) => {
    playSound('click');
    setSelectedGuesses(prev => ({ ...prev, [commentId]: authorId }));
  };

  const handleSubmitGuesses = async () => {
    if (!game || !user) return;
    try {
      setIsSubmittingGuesses(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const commentsForPlayerLocal = game.guessingData?.commentsByTarget?.[user?.uid || ''] || [];
      const missing = commentsForPlayerLocal.filter(c => !selectedGuesses[c.id]);
      if (missing.length > 0) {
        showFancyAlert(t('game.alerts.incomplete', { locale }), t('game.alerts.selectAuthorForEachComment', { locale }));
        setIsSubmittingGuesses(false);
        return;
      }

      const failures: { commentId: string; error: any }[] = [];
      for (const comment of commentsForPlayerLocal) {
        const selectedAuthorId = selectedGuesses[comment.id];
        if (!selectedAuthorId) continue;

        let roundContaining = game.rounds?.find(r => r.comments?.some(c => c.id === comment.id));
        if (!roundContaining && game.currentRound?.comments?.some(c => c.id === comment.id)) {
          roundContaining = game.currentRound;
        }
        if (!roundContaining) {
          failures.push({ commentId: comment.id, error: 'Round not found' });
          continue;
        }

        try {
          await submitGuess(roundContaining.roundNumber, comment.id, selectedAuthorId);
        } catch (err) {
          failures.push({ commentId: comment.id, error: err });
        }
      }

      try {
        // Compute correct count locally — we have all the data right here and this
        // avoids any Firestore read-after-write race in markPlayerGuessesSubmitted.
        const correctGuessCount = commentsForPlayerLocal.filter(c => {
          const guessedAuthorId = selectedGuesses[c.id];
          return guessedAuthorId !== undefined && guessedAuthorId === c.authorId;
        }).length;

        hasSubmittedGuessesRef.current = true;
        setHasSubmittedGuesses(true);
        await markPlayerGuessesSubmitted(undefined, correctGuessCount);
      } catch (err) {
        console.warn('Failed to mark player as submitted', err);
      }

      if (failures.length > 0) {
        const failedIds = failures.map(f => f.commentId).join(', ');
        showFancyAlert(t('game.alerts.partialError', { locale }), `${t('game.alerts.failedToSubmitGuessesForComments', { locale })}: ${failedIds}`);
      } else {
        await playSound('correctGuess');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSelectedGuesses({});
      }
    } catch (error: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.submitGuessesFailed', { locale }));
    } finally {
      setIsSubmittingGuesses(false);
    }
  };

  const handleFinalizeGuessingPhase = async () => {
    if (!isAdmin || !game || isFinalizingGuesses) return;
    try {
      setIsFinalizingGuesses(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await finalizeGuessingPhase();
      playSound('gameOver').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error: unknown) {
      if (!isMounted.current) return;
      playSound('error').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.finalizeGuessingFailed', { locale }));
    } finally {
      if (isMounted.current) setIsFinalizingGuesses(false);
    }
  };

  const handleFinalizeAndNextRound = async () => {
    if (!isAdmin || !game || isFinalizingGuesses) return;
    try {
      setIsFinalizingGuesses(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await finalizeGuessingPhase();
      playSound('roundComplete').catch(() => {});
      try {
        await startNextRound();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } catch (error: unknown) {
        // startNextRound() resolves normally (no throw) when the game
        // legitimately ends — a throw here is always a real failure
        // (e.g. network/Firestore error), so surface it rather than
        // swallowing it. ActivePhase shows a retry control for this state.
        // Do not fire the success haptic below on this path.
        if (isMounted.current) {
          showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.startNextRoundFailed', { locale }));
        }
      }
    } catch (error: unknown) {
      if (!isMounted.current) return;
      playSound('error').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.finishAndStartNextRoundFailed', { locale }));
    } finally {
      if (isMounted.current) setIsFinalizingGuesses(false);
    }
  };

  const playerPulse = usePulseBorderOnChange(
    `${singleTargetId ?? 'legacy'}:${hasSubmittedGuesses || (game.guessingData?.playersWhoSubmittedGuesses?.includes(user?.uid || '') ?? false)}`,
    GameColors.purple,
  );
  const adminPulse = usePulseBorderOnChange(
    `${singleTargetId ?? 'legacy'}:${targetSubmitted}:${game.guessingData?.allPlayersSubmitted ?? false}`,
    GameColors.purple,
  );

  if (!game.guessingData) return null;

  return (
    <View style={styles.phaseWrapper}>
      {/* Status badge */}
      <View style={styles.gameStatusContainer}>
        <ThemedText style={gameStyles.statusLabel}>{t('game.ui.statusLabel', { locale })}</ThemedText>
        <View style={[gameStyles.statusBadge, { backgroundColor: StatusColors.guessing_phase }]}>
          <ThemedText style={gameStyles.statusText}>
            {t('game.ui.statusGuessing', { locale })}
          </ThemedText>
        </View>
      </View>

      <View style={gameStyles.gameFlowContainer}>
        <View style={styles.roundInfo}>
          <ThemedText type="subtitle" style={styles.roundTitle}>
            {t('game.ui.guessAuthorsTitle', { locale })}
          </ThemedText>
          <ThemedText style={styles.targetText}>
            {singleTargetId
              ? t('game.ui.guessingCommentsAbout', {
                  locale,
                  name: getDisplayName(
                    game.participants.find(p => p.userId === singleTargetId)?.userName || '',
                  ),
                })
              : t('game.ui.guessAuthorsSubtitle', { locale })}
          </ThemedText>
        </View>

        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${singleTargetId ?? 'legacy'}:${hasSubmittedGuesses || game.guessingData.playersWhoSubmittedGuesses?.includes(user?.uid || '')}`}
          align="top"
          animated
          insets={SCROLL_INSETS}
        >
        <Animated.View style={playerPulse}>
        {(hasSubmittedGuesses || game.guessingData.playersWhoSubmittedGuesses?.includes(user?.uid || '')) ? (
          (() => {
            const playerResult = game.guessResults?.[user?.uid ?? ''];
            if (playerResult && game.showGuessResults) {
              return (
                <View style={styles.guessResultsContainer}>
                  <ThemedText type="subtitle" style={styles.guessResultsTitle}>
                    {t('game.ui.guessResultsHeader', { locale })}
                  </ThemedText>
                  <View style={styles.guessResultCard}>
                    <ThemedText style={styles.guessResultText}>
                      {t('game.ui.guessCorrectCount', { locale, correct: playerResult.correctGuesses || 0, total: commentsForPlayer.length })}
                    </ThemedText>
                    <ThemedText style={styles.guessResultDetail}>
                      {t('game.ui.guessPointsEarned', { locale, points: playerResult.correctGuesses || 0 })}
                    </ThemedText>
                  </View>
                </View>
              );
            }
            return (
              <View style={styles.submittedBanner}>
                <ThemedText style={styles.submittedBannerIcon}>✅</ThemedText>
                <ThemedText style={styles.submittedBannerTitle}>
                  {t('game.ui.guessResultsTitle', { locale })}
                </ThemedText>
                <ThemedText style={styles.submittedBannerMessage}>
                  {t('game.ui.waitingForAdminToComplete', { locale })}
                </ThemedText>
                {isAdmin && !game.guessingData.allPlayersSubmitted && (
                  <ThemedText style={styles.submittedBannerMessage}>
                    {t('game.ui.waitingForAllPlayers', { locale })}
                  </ThemedText>
                )}
              </View>
            );
          })()
        ) : (
          commentsForPlayer.length > 0 ? (
            <View style={styles.guessingContainer}>
              <ThemedText style={styles.guessingInstructions}>
                {t('game.ui.guessingInstructions', { locale })}
              </ThemedText>
              <ThemedText style={styles.guessPrompt}>
                {t('game.ui.guessPrompt', { locale })}
              </ThemedText>
              {commentsForPlayer.map((comment) => {
                const guessResult = getGuessResultDisplay(comment.id);
                return (
                  <View key={comment.id} style={styles.guessCard}>
                    <WithAnonymousAvatar avatarId={commentAvatars[comment.id]}>
                      <ThemedText style={styles.commentText}>"{comment.text}"</ThemedText>
                    </WithAnonymousAvatar>
                    <View style={styles.authorOptionsContainer}>
                      {/* The viewer is always guessing comments written about
                          themselves — they can never be the author, since
                          self-comments are blocked at submission time. */}
                      {(game.guessingData?.possibleAuthors || [])
                        .filter((author) => author.userId !== user?.uid)
                        .map((author) => (
                        <TouchableOpacity
                          key={author.userId}
                          style={[
                            styles.authorOption,
                            selectedGuesses[comment.id] === author.userId && styles.selectedAuthorOption,
                          ]}
                          onPress={() => handleGuessSelect(comment.id, author.userId)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: selectedGuesses[comment.id] === author.userId }}
                        >
                          <ThemedText style={[
                            styles.authorName,
                            selectedGuesses[comment.id] === author.userId && styles.selectedAuthorName,
                          ]}>
                            {(() => {
                              const numbers = playerNumbers ?? joinIndexById;
                              return numbers[author.userId] ? `${numbers[author.userId]}. ` : '';
                            })()}{getDisplayName(author.userName)}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {guessResult && (
                      <View style={styles.guessResultContainer}>
                        <ThemedText style={[
                          styles.guessResultText,
                          guessResult.correct ? styles.guessResultCorrect : styles.guessResultIncorrect,
                        ]}>
                          {guessResult.message}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                );
              })}
              {commentsForPlayer.length > 0 && !allCommentsHaveGuesses && (
                <ThemedText style={{ textAlign: 'center', color: GameColors.placeholderLight, marginBottom: 8 }}>
                  {t('game.alerts.selectAuthorForEachCommentToEnableSubmit', { locale })}
                </ThemedText>
              )}
              {commentsForPlayer.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.submitGuessButton,
                    { backgroundColor: GameColors.purple, shadowColor: GameColors.shadow },
                    (isSubmittingGuesses || !allCommentsHaveGuesses) && gameStyles.buttonDisabled,
                  ]}
                  onPress={handleSubmitGuesses}
                  disabled={isSubmittingGuesses || !allCommentsHaveGuesses}
                  activeOpacity={0.8}
                  accessibilityLabel={t('game.ui.submitGuesses', { locale })}
                  accessibilityRole="button"
                >
                  {isSubmittingGuesses
                    ? <ActivityIndicator size="small" color={GameColors.white} />
                    : <IconSymbol name="arrow.up.circle.fill" size={16} color={GameColors.white} />}
                  <ThemedText style={styles.buttonText}>{t('game.ui.submitGuesses', { locale })}</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ThemedText style={styles.waitingText}>
              {t('game.ui.waitingForAdminToStartGuessing', { locale })}
            </ThemedText>
          )
        )}
        </Animated.View>
        </ScrollIntoView>

        {/* Admin Target Control */}
        {isAdmin && (
          <TargetControlPanel
            locale={locale}
            showFancyAlert={showFancyAlert}
          />
        )}

        {isAdmin && (
          <ScrollIntoView
            enabled
            scrollIntoViewKey={`${singleTargetId ?? 'legacy'}:${targetSubmitted}:${game.guessingData.allPlayersSubmitted}`}
            align="center"
            animated
            insets={SCROLL_INSETS}
          >
          <Animated.View style={adminPulse}>
          {(() => {
            if (singleTargetId && targetSubmitted) {
              return (
                <View style={styles.adminControls}>
                  <TouchableOpacity
                    style={[
                      styles.adminButton,
                      { backgroundColor: GameColors.green, shadowColor: GameColors.shadow },
                      isFinalizingGuesses && gameStyles.buttonDisabled,
                    ]}
                    onPress={handleFinalizeAndNextRound}
                    disabled={isFinalizingGuesses}
                    activeOpacity={0.8}
                    accessibilityLabel={t('game.ui.finishAndStartNextRound', { locale })}
                    accessibilityRole="button"
                  >
                    {isFinalizingGuesses
                    ? <ActivityIndicator size="small" color={GameColors.white} />
                    : <IconSymbol name="forward.end.fill" size={16} color={GameColors.white} />}
                  <ThemedText style={styles.buttonText}>{t('game.ui.nextRound', { locale })}</ThemedText>
                  </TouchableOpacity>
                </View>
              );
            }

            if (game.guessingData.allPlayersSubmitted) {
              return (
                <View style={styles.adminControls}>
                  <TouchableOpacity
                    style={[
                      styles.adminButton,
                      { backgroundColor: GameColors.green, shadowColor: GameColors.shadow },
                      isFinalizingGuesses && gameStyles.buttonDisabled,
                    ]}
                    onPress={handleFinalizeGuessingPhase}
                    disabled={isFinalizingGuesses}
                    activeOpacity={0.8}
                    accessibilityLabel={t('game.ui.finalizeGuessingPhase', { locale })}
                    accessibilityRole="button"
                  >
                    {isFinalizingGuesses
                    ? <ActivityIndicator size="small" color={GameColors.white} />
                    : <IconSymbol name="flag.checkered" size={16} color={GameColors.white} />}
                  <ThemedText style={styles.buttonText}>{t('game.ui.finalize', { locale })}</ThemedText>
                  </TouchableOpacity>
                </View>
              );
            }

            const forceHandler = singleTargetId
              ? handleFinalizeAndNextRound
              : handleFinalizeGuessingPhase;
            return (
              <View style={styles.adminControls}>
                <TouchableOpacity
                  style={[
                    styles.adminButton,
                    { backgroundColor: GameColors.neutral, shadowColor: GameColors.shadow },
                    isFinalizingGuesses && gameStyles.buttonDisabled,
                  ]}
                  onPress={() => {
                    Alert.alert(
                      t('game.ui.forceFinalizeTitle', { locale }),
                      t('game.ui.forceFinalizeMessage', { locale }),
                      [
                        { text: t('common.cancel', { locale }), style: 'cancel' },
                        { text: t('game.ui.finalizeAnyway', { locale }), onPress: () => { void forceHandler(); } },
                      ]
                    );
                  }}
                  disabled={isFinalizingGuesses}
                  activeOpacity={0.8}
                  accessibilityLabel={t('game.ui.forceFinalizeTitle', { locale })}
                  accessibilityRole="button"
                >
                  {isFinalizingGuesses
                    ? <ActivityIndicator size="small" color={GameColors.white} />
                    : <IconSymbol name="flag.checkered" size={16} color={GameColors.white} />}
                  <ThemedText style={styles.buttonText}>{t('game.ui.finalize', { locale })}</ThemedText>
                </TouchableOpacity>
              </View>
            );
          })()}
          </Animated.View>
          </ScrollIntoView>
        )}
        <AdminRoundTools
          isAdmin={isAdmin}
          locale={locale}
          showFancyAlert={showFancyAlert}
          onRestart={restartMirrorRound}
          onSkip={skipMirrorRound}
        />
      </View>

      {/* Post-Guessing Point Panel */}
      <PostGuessingPointsPanel
        game={game}
        isAdmin={isAdmin}
        user={user}
        participantsByJoin={participantsByJoin}
        joinIndexById={joinIndexById}
        getDisplayName={getDisplayName}
        showFancyAlert={showFancyAlert}
        locale={locale}
      />

      {/* Guess Result Modal */}
      {guessResultModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent} accessibilityViewIsModal={true}>
            <ThemedText style={styles.modalTitle}>
              {t('game.ui.guessResultsTitle', { locale })}
            </ThemedText>
            <ScrollView style={{ maxHeight: 400, width: '100%' }}>
              {guessResultModal.map((result, index) => (
                <View
                  key={index}
                  style={[
                    styles.guessResultItem,
                    result.correct ? styles.guessResultItemCorrect : styles.guessResultItemIncorrect,
                  ]}
                >
                  <ThemedText style={[styles.guessResultLabel, result.correct ? styles.guessResultCorrect : styles.guessResultIncorrect]}>
                    {result.correct ? t('game.ui.correct', { locale }) : t('game.ui.incorrect', { locale })}
                  </ThemedText>
                  <ThemedText style={styles.guessResultComment}>
                    "{result.commentText}"
                  </ThemedText>
                  <View style={[styles.guessResultRow, { marginBottom: 6 }]}>
                    <ThemedText style={{ fontSize: 14, opacity: 0.7 }}>
                      {t('game.ui.actualAuthor', { locale })}:
                    </ThemedText>
                    <ThemedText style={[{ fontSize: 14, fontWeight: '600' }, result.correct ? styles.guessResultCorrect : styles.guessResultIncorrect]}>
                      {result.actualAuthorName}
                    </ThemedText>
                  </View>
                  <View style={[styles.guessResultRow, { marginBottom: 8 }]}>
                    <ThemedText style={{ fontSize: 14, opacity: 0.7 }}>
                      {t('game.ui.yourGuess', { locale })}:
                    </ThemedText>
                    <ThemedText style={{ fontSize: 14, fontWeight: '600' }}>
                      {result.guessedAuthorName}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: GameColors.correct }]}
                onPress={() => setGuessResultModal(null)}
                accessibilityLabel={t('game.ui.closeGuessResults', { locale })}
                accessibilityRole="button"
              >
                <ThemedText style={styles.modalButtonText}>{t('common.ok', { locale })}</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  phaseWrapper: { backgroundColor: GameColors.guessingTint, borderWidth: 1, borderColor: GameColors.guessingTintBorder, borderRadius: 16, padding: 16, marginBottom: 8 },
  buttonText: { color: GameColors.white, fontWeight: '600', fontSize: 15, fontFamily: Fonts.sans },
  gameStatusContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  roundInfo: { marginBottom: 20, padding: 16, borderRadius: 8, backgroundColor: GameColors.cardBg },
  roundTitle: { marginBottom: 8, textAlign: 'center', fontFamily: Fonts.sans },
  targetText: { textAlign: 'center', fontSize: 18, fontWeight: '600', fontFamily: Fonts.sans },
  waitingText: { textAlign: 'center', opacity: 0.7, fontSize: 16, marginVertical: 16, fontFamily: Fonts.sans },
  guessingContainer: { marginTop: 16 },
  guessingInstructions: { fontSize: 16, marginBottom: 20, lineHeight: 24, fontFamily: Fonts.sans },
  guessCard: { padding: 16, borderRadius: 8, backgroundColor: GameColors.cardBg, marginBottom: 20 },
  commentText: { fontSize: 16, marginBottom: 12, lineHeight: 22, fontFamily: Fonts.sans },
  guessPrompt: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 8, color: GameColors.textLight, fontFamily: Fonts.sans },
  authorOptionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  authorOption: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: GameColors.cardBg, borderWidth: 1, borderColor: GameColors.cardBorder },
  selectedAuthorOption: { backgroundColor: GameColors.blue, borderColor: GameColors.blue },
  authorName: { fontSize: 14, fontWeight: '500' },
  selectedAuthorName: { color: GameColors.white },
  submitGuessButton: { flexDirection: 'row', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 8, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },

  guessResultsContainer: { marginTop: 16, alignItems: 'center' },
  guessResultsTitle: { marginBottom: 16, textAlign: 'center' },
  guessResultCard: { padding: 20, borderRadius: 8, backgroundColor: GameColors.cardBg, alignItems: 'center', width: '100%' },
  guessResultText: { fontSize: 18, fontWeight: '600', textAlign: 'center', color: GameColors.green, marginBottom: 8 },
  guessResultDetail: { fontSize: 14, textAlign: 'center', opacity: 0.8 },
  guessResultContainer: { marginTop: 16, alignItems: 'center' },
  guessResultCorrect: { color: GameColors.correct },
  guessResultIncorrect: { color: GameColors.incorrect },
  adminControls: { marginTop: 24, alignItems: 'center', gap: 6 },
  adminButton: { flexDirection: 'row', borderRadius: 999, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 24, gap: 8, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  modalOverlay: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: GameColors.overlayBg, alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 },
  modalContent: { width: '85%', backgroundColor: GameColors.white, borderRadius: 12, padding: 20, shadowColor: GameColors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  modalButtonText: { color: GameColors.white, fontSize: 16, fontWeight: '600' as const },
  guessResultItem: { borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 12 },
  guessResultItemCorrect: { backgroundColor: GameColors.correctBg, borderColor: GameColors.correct },
  guessResultItemIncorrect: { backgroundColor: GameColors.incorrectBg, borderColor: GameColors.incorrect },
  guessResultLabel: { fontSize: 16, fontWeight: '600' as const, marginBottom: 8, textAlign: 'center' as const },
  guessResultComment: { fontSize: 14, fontStyle: 'italic' as const, marginBottom: 12, textAlign: 'center' as const },
  guessResultRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  submittedBanner: { marginVertical: 16, padding: 24, borderRadius: 16, backgroundColor: GameColors.cardBg, borderWidth: 1, borderColor: GameColors.correct, alignItems: 'center', gap: 8 },
  submittedBannerIcon: { fontSize: 40 },
  submittedBannerTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', fontFamily: Fonts.sans },
  submittedBannerMessage: { fontSize: 14, textAlign: 'center', opacity: 0.75, fontFamily: Fonts.sans },
});
