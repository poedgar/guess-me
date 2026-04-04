import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';
import { Comment, Game, Participant, useGame } from '@/contexts/GameContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ShowFancyAlertFn } from './GameHeader';
import PostGuessingPointsPanel from './PostGuessingPointsPanel';

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
  getDisplayName,
  commentsForPlayer,
  showFancyAlert,
  locale,
}) => {
  const { playSound } = useSound();
  const { loading, submitGuess, markPlayerGuessesSubmitted, finalizeGuessingPhase, startNextRound } = useGame();

  const [selectedGuesses, setSelectedGuesses] = useState<{ [commentId: string]: string }>({});
  const [hasSubmittedGuesses, setHasSubmittedGuesses] = useState(false);
  const hasSubmittedGuessesRef = useRef(false);
  const [guessResultModal, setGuessResultModal] = useState<GuessResult[] | null>(null);
  const [isSubmittingGuesses, setIsSubmittingGuesses] = useState(false);
  const [isFinalizingGuesses, setIsFinalizingGuesses] = useState(false);

  // Reset submission state when entering guessing phase
  useEffect(() => {
    setHasSubmittedGuesses(false);
    hasSubmittedGuessesRef.current = false;
    setGuessResultModal(null);
  }, []);

  const allCommentsHaveGuesses = commentsForPlayer.length === 0 || commentsForPlayer.every(c => !!selectedGuesses[c.id]);

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
    const actualAuthorName = getDisplayName(actualAuthor?.userName || 'Unknown');
    const guessedAuthorName = getDisplayName(guessedAuthor?.userName || 'Unknown');
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
        hasSubmittedGuessesRef.current = true;
        setHasSubmittedGuesses(true);
        await markPlayerGuessesSubmitted();
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
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error?.message || t('game.alerts.submitGuessesFailed', { locale }));
    } finally {
      setIsSubmittingGuesses(false);
    }
  };

  const handleFinalizeGuessingPhase = async () => {
    if (!isAdmin || !game) return;
    try {
      setIsFinalizingGuesses(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await finalizeGuessingPhase();
      await playSound('gameOver');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert(t('common.success', { locale }), t('game.alerts.guessingPhaseCompleteGameFinished', { locale }));
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.finalizeGuessingFailed', { locale }));
    } finally {
      setIsFinalizingGuesses(false);
    }
  };

  const handleFinalizeAndNextRound = async () => {
    if (!isAdmin || !game) return;
    try {
      setIsFinalizingGuesses(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await finalizeGuessingPhase();
      await playSound('roundComplete');
      try {
        await startNextRound();
      } catch (e) {
        console.warn('startNextRound after finalize failed or game finished', e);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.finishAndStartNextRoundFailed', { locale }));
    } finally {
      setIsFinalizingGuesses(false);
    }
  };

  if (!game.guessingData) return null;

  return (
    <>
      {/* Status badge */}
      <View style={styles.gameStatusContainer}>
        <ThemedText style={styles.statusLabel}>{t('game.ui.statusLabel', { locale })}</ThemedText>
        <View style={[styles.statusBadge, { backgroundColor: '#9C27B0' }]}>
          <ThemedText style={styles.statusText}>
            {t('game.ui.statusGuessing', { locale })}
          </ThemedText>
        </View>
      </View>

      <View style={styles.gameFlowContainer}>
        <View style={styles.roundInfo}>
          <ThemedText type="subtitle" style={styles.roundTitle}>
            {t('game.ui.guessAuthorsTitle', { locale })}
          </ThemedText>
          <ThemedText style={styles.targetText}>
            {t('game.ui.guessAuthorsSubtitle', { locale })}
          </ThemedText>
        </View>

        {game.guessingData.playersWhoSubmittedGuesses?.includes(user?.uid || '') ? (
          (() => {
            const playerResult = game.guessResults?.[user?.uid ?? ''];
            if (playerResult) {
              return (
                <View style={styles.guessResultsContainer}>
                  <ThemedText type="subtitle" style={styles.guessResultsTitle}>
                    Результати вгадування
                  </ThemedText>
                  <View style={styles.guessResultCard}>
                    <ThemedText style={styles.guessResultText}>
                      Ви правильно вгадали {playerResult.correctGuesses || 0} з {commentsForPlayer.length} коментарів!
                    </ThemedText>
                    <ThemedText style={styles.guessResultDetail}>
                      Ви отримали {playerResult.correctGuesses || 0} балів за правильні відповіді.
                    </ThemedText>
                  </View>
                </View>
              );
            }
            return (
              <View style={styles.guessResultsContainer}>
                <ThemedText type="subtitle" style={styles.guessResultsTitle}>
                  {t('game.ui.guessResultsTitle', { locale })}
                </ThemedText>
                <ThemedText style={styles.waitingText}>
                  {t('game.ui.waitingForAdminToComplete', { locale })}
                </ThemedText>
                {isAdmin && !game.guessingData.allPlayersSubmitted && (
                  <ThemedText style={styles.waitingText}>
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
              {commentsForPlayer.map((comment) => {
                const guessResult = getGuessResultDisplay(comment.id);
                return (
                  <View key={comment.id} style={styles.guessCard}>
                    <ThemedText style={styles.commentText}>"{comment.text}"</ThemedText>
                    <ThemedText style={styles.guessPrompt}>
                      {t('game.ui.guessPrompt', { locale })}
                    </ThemedText>
                    <View style={styles.authorOptionsContainer}>
                      {(game.guessingData?.possibleAuthors || []).map((author) => (
                        <TouchableOpacity
                          key={author.userId}
                          style={[
                            styles.authorOption,
                            selectedGuesses[comment.id] === author.userId && styles.selectedAuthorOption,
                          ]}
                          onPress={() => handleGuessSelect(comment.id, author.userId)}
                        >
                          <ThemedText style={[
                            styles.authorName,
                            selectedGuesses[comment.id] === author.userId && styles.selectedAuthorName,
                          ]}>
                            {joinIndexById[author.userId] ? `${joinIndexById[author.userId]}. ` : ''}{getDisplayName(author.userName)}
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
                <ThemedText style={{ textAlign: 'center', color: '#999', marginBottom: 8 }}>
                  {t('game.alerts.selectAuthorForEachCommentToEnableSubmit', { locale })}
                </ThemedText>
              )}
              {commentsForPlayer.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.submitGuessButton,
                    { backgroundColor: '#9C27B0', shadowColor: '#000' },
                    (isSubmittingGuesses || !allCommentsHaveGuesses) && styles.buttonDisabled,
                  ]}
                  onPress={handleSubmitGuesses}
                  disabled={isSubmittingGuesses || !allCommentsHaveGuesses}
                  activeOpacity={0.8}
                >
                  {isSubmittingGuesses ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <IconSymbol name="arrow.up.circle.fill" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ThemedText style={styles.waitingText}>
              {t('game.ui.waitingForAdminToStartGuessing', { locale })}
            </ThemedText>
          )
        )}

        {isAdmin && (
          (() => {
            const singleTargetId = game.guessingData?.singleRoundTargetId;
            const targetSubmitted = singleTargetId
              ? game.guessingData?.playersWhoSubmittedGuesses?.includes(singleTargetId)
              : false;

            if (singleTargetId && targetSubmitted) {
              return (
                <View style={styles.adminControls}>
                  <TouchableOpacity
                    style={[
                      styles.adminButton,
                      { backgroundColor: '#4CAF50', shadowColor: '#000' },
                      isFinalizingGuesses && styles.buttonDisabled,
                    ]}
                    onPress={handleFinalizeAndNextRound}
                    disabled={isFinalizingGuesses}
                    activeOpacity={0.8}
                  >
                    {isFinalizingGuesses ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <IconSymbol name="forward.end.fill" size={16} color="#fff" />
                    )}
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
                      { backgroundColor: '#4CAF50', shadowColor: '#000' },
                      isFinalizingGuesses && styles.buttonDisabled,
                    ]}
                    onPress={handleFinalizeGuessingPhase}
                    disabled={isFinalizingGuesses}
                    activeOpacity={0.8}
                  >
                    {isFinalizingGuesses ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <IconSymbol name="flag.checkered" size={16} color="#fff" />
                    )}
                  </TouchableOpacity>
                </View>
              );
            }

            return null;
          })()
        )}
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
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>
              {t('game.ui.guessResultsTitle', { locale })}
            </ThemedText>
            <ScrollView style={{ maxHeight: 400, width: '100%' }}>
              {guessResultModal.map((result, index) => (
                <View
                  key={index}
                  style={{
                    backgroundColor: result.correct ? '#E8F5E8' : '#FFEBEE',
                    borderColor: result.correct ? '#34C759' : '#FF3B30',
                    borderWidth: 1,
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  <ThemedText style={{
                    fontSize: 16, fontWeight: '600', marginBottom: 8, textAlign: 'center',
                    color: result.correct ? '#34C759' : '#FF3B30',
                  }}>
                    {result.correct ? t('game.ui.correct', { locale }) : t('game.ui.incorrect', { locale })}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 14, fontStyle: 'italic', marginBottom: 12, textAlign: 'center' }}>
                    "{result.commentText}"
                  </ThemedText>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <ThemedText style={{ fontSize: 14, opacity: 0.7 }}>
                      {t('game.ui.actualAuthor', { locale })}:
                    </ThemedText>
                    <ThemedText style={{ fontSize: 14, fontWeight: '600', color: result.correct ? '#34C759' : '#FF3B30' }}>
                      {result.actualAuthorName}
                    </ThemedText>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
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
                style={[styles.modalButton, { backgroundColor: '#34C759' }]}
                onPress={() => setGuessResultModal(null)}
              >
                <ThemedText style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>OK</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  gameStatusContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  statusLabel: { marginRight: 12, fontSize: 16, fontFamily: Fonts.sans },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  gameFlowContainer: { marginTop: 24, marginBottom: 24 },
  roundInfo: { marginBottom: 20, padding: 16, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)' },
  roundTitle: { marginBottom: 8, textAlign: 'center', fontFamily: Fonts.sans },
  targetText: { textAlign: 'center', fontSize: 18, fontWeight: '600', fontFamily: Fonts.sans },
  waitingText: { textAlign: 'center', opacity: 0.7, fontSize: 16, marginVertical: 16, fontFamily: Fonts.sans },
  guessingContainer: { marginTop: 16 },
  guessingInstructions: { fontSize: 16, marginBottom: 20, lineHeight: 24, fontFamily: Fonts.sans },
  guessCard: { padding: 16, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)', marginBottom: 20 },
  commentText: { fontSize: 16, marginBottom: 12, lineHeight: 22, fontFamily: Fonts.sans },
  guessPrompt: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 8, color: '#555', fontFamily: Fonts.sans },
  authorOptionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  authorOption: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(0, 0, 0, 0.05)', borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.1)' },
  selectedAuthorOption: { backgroundColor: '#4285F4', borderColor: '#4285F4' },
  authorName: { fontSize: 14, fontWeight: '500' },
  selectedAuthorName: { color: '#fff' },
  submitGuessButton: { borderRadius: 999, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', alignSelf: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  buttonDisabled: { opacity: 0.6 },
  guessResultsContainer: { marginTop: 16, alignItems: 'center' },
  guessResultsTitle: { marginBottom: 16, textAlign: 'center' },
  guessResultCard: { padding: 20, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)', alignItems: 'center', width: '100%' },
  guessResultText: { fontSize: 18, fontWeight: '600', textAlign: 'center', color: '#4CAF50', marginBottom: 8 },
  guessResultDetail: { fontSize: 14, textAlign: 'center', opacity: 0.8 },
  guessResultContainer: { marginTop: 16, alignItems: 'center' },
  guessResultCorrect: { color: '#4CAF50' },
  guessResultIncorrect: { color: '#F44336' },
  adminControls: { marginTop: 24 },
  adminButton: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12, paddingVertical: 16, paddingHorizontal: 16, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  modalOverlay: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 },
  modalContent: { width: '85%', backgroundColor: '#fff', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, minWidth: 80, alignItems: 'center' },
});
